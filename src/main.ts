import { Notice, Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { DEFAULT_SETTINGS, JwPluginSettings, JwSettingTab } from './settings';
import { SourceRouter } from './parser/SourceRouter';
import { NoteBuilder } from './builder/NoteBuilder';
import { ImportModal } from './ui/ImportModal';
import { BibleReader } from './bible/BibleReader';
import { BibleVerseModal } from './ui/BibleVerseModal';
import { ScriptureNormalizer } from './normalizer/ScriptureNormalizer';
import { Scripture } from './models/congress';
import { L } from './i18n';
// esbuild's "binary" loader embeds this as base64 in main.js and decodes it to a
// Uint8Array at bundle time — no separate file needs to ship alongside main.js.
import sqlWasmBinary from 'sql.js/dist/sql-wasm.wasm';

// Matches both markdown link syntax (used in per-item notes) and the raw HTML
// anchors the overview note uses for scripture links (see NoteBuilder) — Live
// Preview shows the *source* text for whichever form is actually written, so
// both patterns need to be recognised here.
const MARKDOWN_LINK_RE = /\[[^\]]*\]\((jwlibrary:\/\/[^)\s]*)\)/g;
const HTML_LINK_RE = /<a\s+href="(jwlibrary:\/\/[^"]*)"/g;

const BIBLE_FILE_NAME = 'bible-cache.jwpub';

export default class JwCongregationPlugin extends Plugin {
	settings!: JwPluginSettings;
	readonly sqlWasmBinary = sqlWasmBinary;

	// Lazily loaded on first scripture-link click, then cached for the rest of
	// the session — decrypting/indexing a full Bible file (up to ~125 MB for the
	// Study Edition) on every click would be far too slow.
	private bibleReader: BibleReader | null = null;
	private bibleReaderLoading: Promise<BibleReader | null> | null = null;

	private get tr() {
		return L[this.settings.lang];
	}

	async onload() {
		await this.loadSettings();
		await this.notifyOnUpdate();

		this.addRibbonIcon('book-open', this.tr.importCommand, () => {
			new ImportModal(this.app, this).open();
		});

		this.addCommand({
			id: 'import-congress-program',
			name: this.tr.importCommand,
			callback: () => new ImportModal(this.app, this).open(),
		});

		this.addSettingTab(new JwSettingTab(this.app, this));

		// WINDOW-level, CAPTURE-phase listeners handle both Reading View (real
		// <a href> elements) and Live Preview (links rendered as decoration
		// spans, e.g. span.cm-underline inside span.cm-link — no real href).
		//
		// Registered on the *window*, not just `document`: inspecting Obsidian's
		// own bundled app code (obsidian.asar) shows external-link clicks in
		// Reading View are handled by a delegated click listener on the rendered
		// content's container element, which calls `window.open(href)` directly —
		// not the browser's native link default action, so `preventDefault()`
		// alone cannot stop it; only intercepting before that handler runs can.
		// Capture on window strictly precedes any bubble-phase handler anywhere.
		//
		// The touch listeners are the MOBILE half of the story: on iOS/Android,
		// Obsidian does not wait for a click at all — its bundled tap helper
		// listens for `touchend`, applies its own tap heuristic (< 600 ms, < 5 px
		// movement) and then calls the link handler DIRECTLY with a synthetic
		// MouseEvent (`t(l, e.target)` — never `dispatchEvent`), so that synthetic
		// "click" is invisible to every DOM listener, ours included; the real
		// click that would follow is suppressed via preventDefault on the
		// touchend. Confirmed by real-device testing: editing view on iPhone
		// opened JW Library with no popup, while our click interception worked
		// everywhere on desktop. The counter-move is the same trick one level
		// earlier: our capture-phase `touchend` on window fires before Obsidian's
		// bubble-phase one, replicates the same tap heuristic, and for scripture
		// links stops propagation (kills Obsidian's tap helper) + prevents
		// default (kills the native synthetic click) and opens the popup itself.
		this.registerDomEvent(activeWindow, 'touchstart', this.onDocumentTouchStart.bind(this), true);
		this.registerDomEvent(activeWindow, 'touchend', this.onDocumentTouchEnd.bind(this), true);
		this.registerDomEvent(activeWindow, 'click', this.onDocumentClick.bind(this), true);
	}

	onunload() {}

	private touchStart: { x: number; y: number; time: number } | null = null;
	// Set whenever a touchend was handled (intercepted OR hint-counted) — the
	// browser may still deliver a synthetic click afterwards on some platforms,
	// which must not trigger a second popup / a second hint count.
	private lastTouchHandled = 0;

	private onDocumentTouchStart(evt: TouchEvent): void {
		if (evt.touches.length !== 1) {
			this.touchStart = null;
			return;
		}
		const touch = evt.touches[0]!;
		this.touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };

		// Disarm Obsidian's own touch handling for scripture links right at the
		// START of the gesture, not only at its end: Obsidian's tap helper arms
		// its touchend listener during touchstart, and its long-press link menu
		// is a ~400 ms timer started on touchstart whose CANCEL also lives in a
		// touchend listener. Stopping only the touchend (as the first version of
		// this fix did) therefore killed the cancel too — the orphaned timer
		// fired moments after our popup opened and the "open in browser / edit
		// link / copy URL" sheet appeared on a plain tap (confirmed on a real
		// iPhone). Deliberately NO preventDefault here: native scrolling that
		// happens to start on a link must keep working. Long-pressing a
		// scripture link consequently does nothing at all now — acceptable,
		// since every action in that sheet targets the raw URL, which is
		// meaningless for these generated deep links.
		if (this.settings.bibleFileLoaded && this.findScriptureLinkForEvent(evt)) {
			evt.stopImmediatePropagation();
		}
	}

	private onDocumentTouchEnd(evt: TouchEvent): void {
		const start = this.touchStart;
		this.touchStart = null;
		if (!start) return;
		const touch = evt.changedTouches[0];
		if (!touch) return;
		// Same tap heuristic as Obsidian's own tap helper — anything longer or
		// further is a scroll/long-press and must never be hijacked.
		if (Date.now() - start.time > 600) return;
		if (Math.abs(touch.clientX - start.x) > 5 || Math.abs(touch.clientY - start.y) > 5) return;
		if (this.handleLinkActivation(evt)) {
			this.lastTouchHandled = Date.now();
		}
	}

	private onDocumentClick(evt: MouseEvent): void {
		// A tap this listener already handled via touchend may still produce a
		// trailing synthetic click — ignore it instead of double-firing.
		if (Date.now() - this.lastTouchHandled < 500) return;
		this.handleLinkActivation(evt);
	}

	/** Returns true when the event targeted a scripture link (whether it opened the popup or counted a hint). */
	private handleLinkActivation(evt: MouseEvent | TouchEvent): boolean {
		const found = this.findScriptureLinkForEvent(evt);
		if (!found) return false;

		if (!this.settings.bibleFileLoaded) {
			// No Bible file: leave the click/tap to Obsidian (JW Library opens as
			// usual), but occasionally point out that the in-app popup exists.
			void this.maybeShowBibleHint();
			return true;
		}

		evt.preventDefault();
		evt.stopImmediatePropagation(); // belt-and-braces: also stop any other handler on this node/phase
		new BibleVerseModal(this.app, found.scripture, this.settings.lang, () => this.getBibleReader()).open();
		return true;
	}

	// Shown on the first three scripture clicks and every 20th one after that —
	// often enough to be discovered, rare enough not to nag. Clicking the
	// notice jumps straight to the plugin's settings tab, where the Bible file
	// can be picked.
	private async maybeShowBibleHint(): Promise<void> {
		const count = ++this.settings.bibleHintClickCount;
		await this.saveSettings();
		if (count <= 3 || count % 20 === 0) {
			// noticeEl (not the 1.8.7+ messageEl): minAppVersion is 1.6.6, where
			// messageEl does not exist yet — the deprecation warning is deliberate.
			const notice = new Notice(this.tr.noticeBibleHint, 12000);
			notice.noticeEl.addEventListener('click', () => this.openOwnSettingsTab());
		}
	}

	// `app.setting` is real but undocumented (not in obsidian.d.ts) — the
	// de-facto standard way plugins deep-link into their own settings tab.
	// Optional chaining keeps this a silent no-op if a future Obsidian version
	// removes it; the notice text alone still tells the user where to go.
	private openOwnSettingsTab(): void {
		const app = this.app as typeof this.app & {
			setting?: { open(): void; openTabById(id: string): void };
		};
		app.setting?.open();
		app.setting?.openTabById(this.manifest.id);
	}

	/** Finds the jwlibrary:// scripture link (if any) that an event's target is part of — Reading View
	 *  (a real `<a href>`) or Live Preview (a decoration span; resolved via the CM6 EditorView's raw source text). */
	private findScriptureLinkForEvent(evt: Event): { scripture: Scripture; href: string } | undefined {
		const target = evt.target;
		if (!target || !(target instanceof HTMLElement)) return undefined;

		// Reading View: a real <a href="jwlibrary://...">.
		const link = target.closest<HTMLAnchorElement>('a[href^="jwlibrary://"]');
		if (link) {
			const scripture = this.parseScriptureFromHref(link.href);
			return scripture ? { scripture, href: link.href } : undefined;
		}

		// Live Preview: no real <a> to find. Only react when the click landed on
		// a RENDERED link decoration — when the cursor is on the line, CM6 shows
		// the raw markdown source instead, and a click there must keep its normal
		// meaning (placing the cursor, e.g. to edit the link) rather than being
		// hijacked into opening the popup.
		if (!target.closest('.cm-underline, .cm-link')) return undefined;

		// Resolve the click position via the CM6 EditorView the click landed in
		// (if any), then read the raw markdown source text at that position
		// instead of the rendered (label-only) text.
		const view = EditorView.findFromDOM(target);
		if (!view) return undefined;

		let pos: number;
		try {
			pos = view.posAtDOM(target);
		} catch {
			return undefined;
		}

		const line = view.state.doc.lineAt(pos);
		return this.findScriptureLinkInText(line.text, pos - line.from);
	}

	/** Finds a jwlibrary:// scripture link (markdown or raw-HTML form) whose span covers `offset` within `text`. */
	private findScriptureLinkInText(text: string, offset: number): { scripture: Scripture; href: string } | undefined {
		for (const re of [MARKDOWN_LINK_RE, HTML_LINK_RE]) {
			re.lastIndex = 0;
			let m: RegExpExecArray | null;
			while ((m = re.exec(text))) {
				if (offset >= m.index && offset <= m.index + m[0].length) {
					const href = m[1];
					if (!href) continue;
					const scripture = this.parseScriptureFromHref(href);
					if (scripture) return { scripture, href };
				}
			}
		}
		return undefined;
	}

	private parseScriptureFromHref(href: string): Scripture | undefined {
		try {
			const bibleParam = new URL(href).searchParams.get('bible');
			if (!bibleParam) return undefined;
			return ScriptureNormalizer.fromRtf(bibleParam);
		} catch {
			return undefined;
		}
	}

	private bibleFilePath(): string {
		return normalizePath(`${this.manifest.dir}/${BIBLE_FILE_NAME}`);
	}

	async setBibleFile(data: Uint8Array): Promise<void> {
		const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
		await this.app.vault.adapter.writeBinary(this.bibleFilePath(), arrayBuffer);
		this.settings.bibleFileLoaded = true;
		await this.saveSettings();
		this.bibleReader = null; // force a reload with the new file on next use
		new Notice(this.tr.noticeBibleSaved);
	}

	async removeBibleFile(): Promise<void> {
		const path = this.bibleFilePath();
		if (await this.app.vault.adapter.exists(path)) {
			await this.app.vault.adapter.remove(path);
		}
		this.settings.bibleFileLoaded = false;
		await this.saveSettings();
		this.bibleReader = null;
	}

	private async getBibleReader(): Promise<BibleReader | null> {
		if (!this.settings.bibleFileLoaded) return null;
		if (this.bibleReader) return this.bibleReader;
		if (this.bibleReaderLoading) return this.bibleReaderLoading;

		this.bibleReaderLoading = (async () => {
			try {
				// Missing file gets its own, actionable message: data.json (with
				// bibleFileLoaded: true) syncs between devices, the Bible file in
				// the plugin folder does not necessarily — so this is the expected
				// state on a freshly synced second device, not an exotic error.
				const path = this.bibleFilePath();
				if (!(await this.app.vault.adapter.exists(path))) {
					new Notice(this.tr.noticeBibleMissingOnDevice, 0);
					return null;
				}
				const data = await this.app.vault.adapter.readBinary(path);
				const reader = new BibleReader(this.sqlWasmBinary);
				await reader.load(new Uint8Array(data));
				this.bibleReader = reader;
				return reader;
			} catch (err) {
				new Notice(this.tr.noticeBibleLoadFailed(String(err)));
				return null;
			} finally {
				this.bibleReaderLoading = null;
			}
		})();
		return this.bibleReaderLoading;
	}

	// Imported notes with writing space are deliberately never auto-updated on
	// re-import (see GeneratedNote.regenerate), so improvements to the note
	// templates don't reach existing congress folders on their own — after an
	// update, the user has to delete and re-import to pick them up. This shows
	// that hint exactly once per new version (sticky Notice, dismissed by
	// clicking). Only a genuinely fresh install records the version silently —
	// detected via hadStoredSettings, NOT via a missing lastVersion: everyone
	// updating from a version predating this feature is missing lastVersion too,
	// and those users are exactly the ones with stale imported notes.
	private async notifyOnUpdate(): Promise<void> {
		const current = this.manifest.version;
		if (this.settings.lastVersion === current) return;
		const isUpdate = this.settings.lastVersion !== '' || this.hadStoredSettings;
		this.settings.lastVersion = current;
		await this.saveSettings();
		if (isUpdate) {
			new Notice(this.tr.noticeUpdated(current), 0);
		}
	}

	/** True when data.json existed before this load — i.e. anything but a fresh install. */
	private hadStoredSettings = false;

	async loadSettings() {
		const stored = (await this.loadData()) as Partial<JwPluginSettings> | null;
		this.hadStoredSettings = stored != null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async importFile(filename: string, data: Uint8Array, targetFolder?: string): Promise<void> {
		const router = new SourceRouter(this.sqlWasmBinary);
		// No lang here: generated notes follow the imported FILE's language
		// (Congress.lang, auto-detected by the parser) — settings.lang only
		// drives the Bible-verse popup.
		const builder = new NoteBuilder({
			scriptureLinks: this.settings.scriptureLinks,
			reviewNote: this.settings.reviewNote,
			showTagField: this.settings.showTagField,
			showTimeField: this.settings.showTimeField,
			showScriptureField: this.settings.showScriptureField,
			showSpeakerField: this.settings.showSpeakerField,
			extraFields: this.settings.extraFields,
			frontmatter: this.settings.frontmatter,
		});

		let result;
		try {
			result = await router.route(filename, data);
		} catch (err) {
			new Notice(this.tr.noticeImportFailed(String(err)));
			return;
		}

		if (result.source === 'rtf' && result.fallback) {
			new Notice(this.tr.noticeRtfFallback);
		}

		const { congressFolder, notes, attachments } = builder.buildNotes(result.congress);
		// '' means vault root — no wrapper folder, the congress gets its own
		// top-level folder directly. `??` (not `||`) so an explicit empty string
		// (root, chosen deliberately in the modal) isn't overridden by the saved
		// default.
		const rawBase = (targetFolder ?? this.settings.targetFolder).trim();
		const baseFolder = rawBase ? normalizePath(rawBase) : '';
		const congressPath = baseFolder ? normalizePath(`${baseFolder}/${congressFolder}`) : normalizePath(congressFolder);

		// Track only the notes/attachments actually created in this run, so a failure
		// partway through can be rolled back without touching folders/files that
		// already existed before the import (e.g. a reused target folder). Updates to
		// already-existing "regenerate" files aren't rolled back on a later failure —
		// they're purely derived content anyway, so a stale-but-valid version from
		// before the failed run is a low-risk trade-off against the complexity of
		// snapshotting old content just to restore it.
		const createdPaths: string[] = [];
		let updated = 0;
		let skipped = 0;

		const total = notes.length + attachments.length;
		let done = 0;
		const progress = total > 3 ? new Notice(this.tr.noticeImportProgress(0, total), 0) : null;

		try {
			if (baseFolder) await this.ensureFolder(baseFolder);
			await this.ensureFolder(congressPath);

			for (const note of notes) {
				const notePath = await this.resolvePath(congressPath, note.dayFolder, note.filename);
				const existing = this.app.vault.getAbstractFileByPath(notePath);
				if (existing) {
					if (note.regenerate && existing instanceof TFile) {
						await this.app.vault.modify(existing, note.content);
						updated++;
					} else {
						skipped++;
					}
				} else {
					await this.app.vault.create(notePath, note.content);
					createdPaths.push(notePath);
				}
				done++;
				progress?.setMessage(this.tr.noticeImportProgress(done, total));
			}

			for (const attachment of attachments) {
				const attachPath = await this.resolvePath(congressPath, attachment.dayFolder, attachment.filename);
				const existing = this.app.vault.getAbstractFileByPath(attachPath);
				const buf = attachment.data;
				const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
				if (existing) {
					if (attachment.regenerate && existing instanceof TFile) {
						await this.app.vault.modifyBinary(existing, arrayBuffer);
						updated++;
					} else {
						skipped++;
					}
				} else {
					await this.app.vault.createBinary(attachPath, arrayBuffer);
					createdPaths.push(attachPath);
				}
				done++;
				progress?.setMessage(this.tr.noticeImportProgress(done, total));
			}

			progress?.hide();
			// The success notice doubles as a shortcut: clicking it opens the first
			// day's overview note, so the freshly imported congress is one tap away.
			const overviewName = `${L[result.congress.lang].overviewBase}.md`;
			const firstDay = result.congress.days[0];
			const overviewPath = result.congress.type === 'CO' && firstDay
				? normalizePath(`${congressPath}/${firstDay.weekday}/${overviewName}`)
				: normalizePath(`${congressPath}/${overviewName}`);
			const summary = this.tr.noticeImportResult(congressFolder, createdPaths.length, updated, skipped);
			const resultNotice = new Notice(`${summary}\n${this.tr.noticeOpenOverviewHint}`, 10000);
			resultNotice.noticeEl.addEventListener('click', () => {
				const file = this.app.vault.getAbstractFileByPath(overviewPath);
				if (file instanceof TFile) void this.app.workspace.getLeaf().openFile(file);
			});
		} catch (err) {
			progress?.hide();
			for (const path of createdPaths.reverse()) {
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file) await this.app.fileManager.trashFile(file);
			}
			new Notice(this.tr.noticeImportRolledBack(String(err)));
		}
	}

	private async resolvePath(congressPath: string, dayFolder: string | undefined, filename: string): Promise<string> {
		if (!dayFolder) return normalizePath(`${congressPath}/${filename}`);
		const dayPath = normalizePath(`${congressPath}/${dayFolder}`);
		await this.ensureFolder(dayPath);
		return normalizePath(`${dayPath}/${filename}`);
	}

	private async ensureFolder(path: string): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (!existing) {
			await this.app.vault.createFolder(path);
		} else if (!(existing instanceof TFolder)) {
			throw new Error(this.tr.noticeNotAFolder(path));
		}
	}
}
