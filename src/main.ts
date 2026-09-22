import { Editor, Notice, Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { DEFAULT_SCRIPTURE_SUGGEST_ACTIONS, DEFAULT_SETTINGS, JwPluginSettings, JwSettingTab } from './settings';
import { SourceRouter } from './parser/SourceRouter';
import { GeneratedAttachment, GeneratedNote, NoteBuilder } from './builder/NoteBuilder';
import { ImportModal } from './ui/ImportModal';
import { MwbSourceRouter } from './parser/MwbSourceRouter';
import { MwbNoteBuilder } from './builder/MwbNoteBuilder';
import { ImportMwbModal } from './ui/ImportMwbModal';
import { UpdateMwbNotesModal } from './ui/UpdateMwbNotesModal';
import { BibleReader } from './bible/BibleReader';
import { BibleVerseModal } from './ui/BibleVerseModal';
import { ScriptureEditorSuggest } from './ui/ScriptureEditorSuggest';
import { BookNameEditorSuggest } from './ui/BookNameEditorSuggest';
import { Congress, Scripture } from './models/congress';
import { CongressLang } from './normalizer/bookNames';
import { L, NL } from './i18n';
import { cutSpan, findFirstScriptureLinkInText, findScriptureLinkInText, findScriptureLinkSpanAt, parseScriptureFromHref, QUOTE_CALLOUT_START_RE } from './util/scriptureLinkScan';
import { diffNoteContent, hasNoMarkers, mergeNoteContent, NoteChange } from './util/noteMerge';
import { UpdateNotesModal } from './ui/UpdateNotesModal';
import { BulkUpdateNotesModal } from './ui/BulkUpdateNotesModal';
import { SpeakerLinkModal } from './ui/SpeakerLinkModal';
import { findSpeakerValue, groupSpeakerVariants, replaceSpeakerValue, speakerLink, SpeakerGroup, SpeakerOccurrence } from './util/speakerNames';
import { applyLegacyCorrections, findLegacyCorrections, LegacyFieldCorrection } from './util/legacyFieldPatch';
import { LegacyMigrationCandidate, LegacyMigrationModal } from './ui/LegacyMigrationModal';
import { ParseError } from './util/parseErrors';
// esbuild's "binary" loader embeds this as base64 in main.js and decodes it to a
// Uint8Array at bundle time — no separate file needs to ship alongside main.js.
import sqlWasmBinary from 'sql.js/dist/sql-wasm.wasm';

const BIBLE_FILE_NAME = 'bible-cache.jwpub';

/** One convention to reconcile in an update run: an already-parsed programme
 *  and the existing folder it belongs to. `label` is what the summary notice
 *  names if this one convention fails — the file the user picked. */
export interface CongressUpdateJob {
	label: string;
	folder: string;
	congress: Congress;
}

/** Per-note outcome of one convention's update, summed across conventions for
 *  the result notice — see updateFolders(). */
interface UpdateCounts {
	merged: number;
	created: number;
	unchanged: number;
	needsReimport: number;
}

/** What an update has decided to do with one note, before anything is written.
 *  `regenerate.changed` and `merge.changes` exist purely so the preview can
 *  tell a real change from a write that alters nothing the reader sees. */
export type PlannedNote =
	| { kind: 'create'; path: string; content: string }
	| { kind: 'regenerate'; path: string; content: string; changed: boolean }
	| { kind: 'merge'; path: string; content: string; changes: NoteChange[] }
	| { kind: 'needs-reimport'; path: string; legacy: LegacyFieldCorrection[] }
	| { kind: 'unchanged'; path: string };

export type PlannedAttachment =
	| { kind: 'create'; path: string; data: Uint8Array }
	| { kind: 'regenerate'; path: string; data: Uint8Array }
	| { kind: 'unchanged'; path: string };

/** One convention's decided update: read-only, produced by planCongressUpdate()
 *  and consumed either by the preview or by executeCongressPlan(). */
export interface CongressPlan {
	notes: PlannedNote[];
	attachments: PlannedAttachment[];
}

/** A plan together with the convention it belongs to — what previewFolders()
 *  hands the preview modal. `error` is set when the folder is gone or the plan
 *  could not be built, in which case `plan` is null. */
export interface CongressPreview {
	label: string;
	folder: string;
	plan: CongressPlan | null;
	error?: string;
}

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

	/** Turns a caught error into a user-facing sentence in the UI's own language.
	 *  A `ParseError` (see util/parseErrors.ts) is translated via `describeParseError` —
	 *  everything else (an unexpected exception from a third-party library, a DOM API,
	 *  etc.) falls back to its own `String(err)` message, same as before this existed. */
	private describeError(err: unknown): string {
		return err instanceof ParseError ? this.tr.describeParseError(err.code, err.detail) : String(err);
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

		this.addCommand({
			id: 'update-congress-notes',
			name: this.tr.updateCommand,
			callback: () => new UpdateNotesModal(this.app, this).open(),
		});

		this.addCommand({
			id: 'bulk-update-congress-notes',
			name: this.tr.bulkUpdateCommand,
			callback: () => new BulkUpdateNotesModal(this.app, this).open(),
		});

		// Its own command rather than a step inside the two above: whoever is
		// used to "update and be done" keeps exactly that, and whoever wants
		// to look first reaches for this one.
		this.addCommand({
			id: 'preview-congress-update',
			name: this.tr.previewUpdateCommand,
			callback: () => new BulkUpdateNotesModal(this.app, this, 'preview').open(),
		});

		// Deleting a typed reference by hand means backspacing through a URL
		// nobody wants to read, since the whole markdown link is one blob of
		// text (reported 22.09.2026). Offered from the command palette (so it
		// can carry a shortcut) and from the editor's context menu, which is
		// also the only workable route on a phone, via long-press.
		this.addCommand({
			id: 'remove-scripture-link',
			name: this.tr.removeScriptureLinkCommand,
			editorCallback: editor => this.removeScriptureLinkAtCursor(editor),
		});

		this.registerEvent(this.app.workspace.on('editor-menu', (menu, editor) => {
			// Added only when there is actually a reference to remove — the
			// same reasoning as the popup's hidden buttons: a dead menu entry
			// is worse than no entry.
			const cursor = editor.getCursor();
			if (!findScriptureLinkSpanAt(editor.getLine(cursor.line), cursor.ch)) return;
			menu.addItem(item =>
				item
					.setTitle(this.tr.removeScriptureLinkCommand)
					.setIcon('unlink')
					.onClick(() => this.removeScriptureLinkAtCursor(editor)),
			);
		}));

		// The one-off migration from hand-typed speaker names to wiki links —
		// a command rather than anything automatic: it rewrites text the user
		// typed, so it runs when asked and only after per-person confirmation.
		this.addCommand({
			id: 'link-speaker-names',
			name: this.tr.speakerLinkCommand,
			callback: () => void this.openSpeakerLinkModal(),
		});

		// A second, distinct icon (not 'book-open', which is reserved for the
		// congress import) — justified by usage frequency: a meeting workbook
		// is imported weekly, far more often than a convention program.
		this.addRibbonIcon('calendar-days', this.tr.importMwbCommand ?? '', () => {
			new ImportMwbModal(this.app, this).open();
		});

		this.addCommand({
			id: 'import-mwb-workbook',
			name: this.tr.importMwbCommand ?? '',
			callback: () => new ImportMwbModal(this.app, this).open(),
		});

		this.addCommand({
			id: 'update-mwb-notes',
			name: this.tr.updateMwbCommand ?? '',
			callback: () => new UpdateMwbNotesModal(this.app, this).open(),
		});

		this.addSettingTab(new JwSettingTab(this.app, this));
		// Two suggesters, not one: this one completes a book name mid-word,
		// ScriptureEditorSuggest fires once a whole reference has been typed.
		// Registered first so the shorter-lived trigger gets its turn before
		// the reference one — they cannot both match the same text anyway,
		// since a completed reference ends in digits, not a bare word.
		this.registerEditorSuggest(new BookNameEditorSuggest(this));
		this.registerEditorSuggest(new ScriptureEditorSuggest(this));

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
		if (this.popupEnabled() && this.findScriptureLinkForEvent(evt)) {
			evt.stopImmediatePropagation();
		}
	}

	/** Whether clicking/tapping a scripture should open the in-app popup — a
	 *  Bible file must be loaded AND the popup itself must not have been
	 *  switched off (bibleFilePopupEnabled has its own settings toggle,
	 *  independent of whether a file is loaded). */
	private popupEnabled(): boolean {
		return this.settings.bibleFileLoaded && this.settings.bibleFilePopupEnabled;
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
		if (!this.settings.bibleFilePopupEnabled) {
			// Bible file loaded, but the popup was explicitly switched off — leave
			// the click/tap to Obsidian's default JW Library behaviour without the
			// "add a Bible file" hint, since one is already loaded.
			return true;
		}

		evt.preventDefault();
		evt.stopImmediatePropagation(); // belt-and-braces: also stop any other handler on this node/phase
		new BibleVerseModal(this.app, found.scripture, this.settings.lang, () => this.getBibleReader(), found.isQuote).open();
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
	 *  (a real `<a href>`) or Live Preview (a decoration span; resolved via the CM6 EditorView's raw source text).
	 *  A quote callout's ENTIRE box (see util/quoteBuilder.ts) is one click target, not just its text runs —
	 *  a click anywhere inside it (background, padding, icon, title or body text) resolves to its own link.
	 *  `isQuote` flags exactly that case — BibleVerseModal uses it to decide whether to offer "remove quote". */
	private findScriptureLinkForEvent(evt: Event): { scripture: Scripture; href: string; isQuote: boolean } | undefined {
		const target = evt.target;
		if (!target || !(target instanceof HTMLElement)) return undefined;

		// Reading View: if the click landed anywhere inside a quote callout's
		// rendered box, use that callout's own title link regardless of exactly
		// where the click was — `<div class="callout" data-callout="quote">…<a>…`
		// is the same "data-callout" attribute/value Obsidian's built-in callout
		// renderer always produces for a "> [!quote]" block.
		const callout = target.closest('.callout[data-callout="quote" i]');
		if (callout) {
			const innerLink = callout.querySelector<HTMLAnchorElement>('a[href^="jwlibrary://"]');
			const scripture = innerLink && parseScriptureFromHref(innerLink.href);
			if (innerLink && scripture) return { scripture, href: innerLink.href, isQuote: true };
		}

		// Reading View: a plain inline reference — a real <a href="jwlibrary://...">.
		const link = target.closest<HTMLAnchorElement>('a[href^="jwlibrary://"]');
		if (link) {
			const scripture = parseScriptureFromHref(link.href);
			return scripture ? { scripture, href: link.href, isQuote: false } : undefined;
		}

		// Live Preview: no real <a>/.callout DOM to read an href from — resolve
		// everything from the raw markdown source via the CM6 EditorView instead.
		// Only react when the click landed on a RENDERED link decoration OR
		// inside Obsidian's own Live Preview callout wrapper (its box styling
		// applies there too, independent of whether the exact click point has a
		// link decoration under it) — when the cursor is just sitting on a plain
		// line, CM6 shows raw markdown source instead, and a click there must
		// keep its normal meaning (placing the cursor) rather than being hijacked.
		const inCalloutBox = !!target.closest('.callout');
		if (!inCalloutBox && !target.closest('.cm-underline, .cm-link')) return undefined;

		const view = EditorView.findFromDOM(target);
		if (!view) return undefined;

		let pos: number;
		try {
			pos = view.posAtDOM(target);
		} catch {
			return undefined;
		}

		let line = view.state.doc.lineAt(pos);
		if (!inCalloutBox) {
			const found = findScriptureLinkInText(line.text, pos - line.from);
			return found ? { ...found, isQuote: false } : undefined;
		}

		// Inside the callout box, but not directly on the title's own link
		// decoration (e.g. clicked the body text, the icon, or plain padding) —
		// walk upward to the callout's title line ("> [!quote] …"), which is
		// always at or above wherever the click landed, and use ITS link
		// instead of trying to match the exact clicked position.
		while (line.text.startsWith('>') && !QUOTE_CALLOUT_START_RE.test(line.text) && line.number > 1) {
			line = view.state.doc.line(line.number - 1);
		}
		if (!QUOTE_CALLOUT_START_RE.test(line.text)) return undefined;
		const found = findFirstScriptureLinkInText(line.text);
		return found ? { ...found, isQuote: true } : undefined;
	}

	private bibleFilePath(): string {
		return normalizePath(`${this.manifest.dir}/${BIBLE_FILE_NAME}`);
	}

	async setBibleFile(data: Uint8Array): Promise<void> {
		const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
		try {
			await this.app.vault.adapter.writeBinary(this.bibleFilePath(), arrayBuffer);
		} catch (err) {
			new Notice(this.tr.noticeBibleSaveFailed(this.describeError(err)));
			return; // settings.bibleFileLoaded is left untouched — nothing was actually saved
		}
		this.settings.bibleFileLoaded = true;
		await this.saveSettings();
		this.bibleReader = null; // force a reload with the new file on next use
		new Notice(this.tr.noticeBibleSaved);
	}

	async removeBibleFile(): Promise<void> {
		const path = this.bibleFilePath();
		try {
			if (await this.app.vault.adapter.exists(path)) {
				await this.app.vault.adapter.remove(path);
			}
		} catch (err) {
			new Notice(this.tr.noticeBibleRemoveFailed(this.describeError(err)));
			return;
		}
		this.settings.bibleFileLoaded = false;
		await this.saveSettings();
		this.bibleReader = null;
	}

	/** Not private: also called by ScriptureEditorSuggest (in-editor "insert as quote"/"link" suggester). */
	async getBibleReader(): Promise<BibleReader | null> {
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
				new Notice(this.tr.noticeBibleLoadFailed(this.describeError(err)));
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
		// Object.assign only shallow-copies — without this, an unset/older
		// data.json would leave settings.scriptureSuggestActions pointing at
		// the shared DEFAULT_SCRIPTURE_SUGGEST_ACTIONS array itself, and the
		// settings tab's reorder/toggle UI mutates that array in place.
		this.settings.scriptureSuggestActions =
			(stored?.scriptureSuggestActions ?? DEFAULT_SCRIPTURE_SUGGEST_ACTIONS).map(c => ({ ...c }));
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
			speakerLink: this.settings.speakerLink,
			extraFields: this.settings.extraFields,
			frontmatter: this.settings.frontmatter,
		});

		let result;
		try {
			result = await router.route(filename, data);
		} catch (err) {
			new Notice(this.tr.noticeImportFailed(this.describeError(err)));
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
			const overviewName = `${NL[result.congress.lang].overviewBase}.md`;
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
			new Notice(this.tr.noticeImportRolledBack(this.describeError(err)));
		}
	}

	// The "update" counterpart to importFile(): re-parses the SAME programme
	// file (e.g. after a parser bug fix shipped) and patches an ALREADY
	// imported congress folder in place, rather than creating a fresh one.
	// Purely-derived files (regenerate: true — the overview notes, cover
	// images) are overwritten outright, same as on a plain re-import. Every
	// other note is merged via mergeNoteContent() (see util/noteMerge.ts):
	// only the invisible marker regions NoteBuilder wraps around
	// derived fields are replaced, so a corrected weekday or scripture link
	// lands without touching a single character the user typed themselves.
	// A note whose marker structure doesn't line up (most commonly: it was
	// created by a plugin version from before this feature existed, so it
	// has no markers at all) is left completely untouched and counted
	// separately, so the result notice can point out that a manual delete +
	// full re-import is still the only way to fix that specific note.
	async updateFile(filename: string, data: Uint8Array, targetFolder: string): Promise<void> {
		const congressPath = normalizePath(targetFolder);
		const existingFolder = this.app.vault.getAbstractFileByPath(congressPath);
		if (!(existingFolder instanceof TFolder)) {
			new Notice(this.tr.noticeUpdateFolderNotFound(congressPath));
			return;
		}

		const router = new SourceRouter(this.sqlWasmBinary);
		let result;
		try {
			result = await router.route(filename, data);
		} catch (err) {
			new Notice(this.tr.noticeImportFailed(this.describeError(err)));
			return;
		}

		// A run of exactly one job: updateFolders() reports the very same
		// notices this method reported on its own before the bulk path existed,
		// so the merge logic lives in one place only.
		await this.updateFolders([{ label: filename, folder: congressPath, congress: result.congress }]);
	}

	/**
	 * The bulk counterpart to updateFile(): reconciles SEVERAL already-imported
	 * congress folders in one run, each against its own re-parsed programme
	 * file — see ui/BulkUpdateNotesModal.ts, which pairs the picked files with
	 * existing folders by the folder name NoteBuilder would generate for them.
	 *
	 * Per note, this does exactly what a single-folder update does; what the
	 * bulk path adds is (a) one progress notice counting every file of every
	 * convention, (b) an aggregated result notice, and (c) the rule that one
	 * failing convention never abandons the rest — its own newly created files
	 * are rolled back and it is named in the summary, then the run carries on.
	 * With a single job the notices are byte-for-byte the ones updateFile()
	 * always produced.
	 */
	async updateFolders(jobs: CongressUpdateJob[]): Promise<void> {
		if (jobs.length === 0) return;
		const bulk = jobs.length > 1;

		const builder = new NoteBuilder({
			scriptureLinks: this.settings.scriptureLinks,
			reviewNote: this.settings.reviewNote,
			showTagField: this.settings.showTagField,
			showTimeField: this.settings.showTimeField,
			showScriptureField: this.settings.showScriptureField,
			showSpeakerField: this.settings.showSpeakerField,
			speakerLink: this.settings.speakerLink,
			extraFields: this.settings.extraFields,
			frontmatter: this.settings.frontmatter,
		});

		// Rendered up front so the progress notice can count real files rather
		// than conventions: building a note is pure string work, and nothing is
		// written to the vault before the loop below starts.
		const plans = jobs.map(job => ({ job, ...builder.buildNotes(job.congress) }));
		const total = plans.reduce((sum, plan) => sum + plan.notes.length + plan.attachments.length, 0);
		let done = 0;
		const progress = total > 3 ? new Notice(this.tr.noticeImportProgress(0, total), 0) : null;
		const onStep = () => {
			done++;
			progress?.setMessage(this.tr.noticeImportProgress(done, total));
		};

		// Notes with no markers at all (pre-1.9.0) that still have safely
		// identifiable field-label corrections — see util/legacyFieldPatch.ts.
		// Never written automatically; only offered via LegacyMigrationModal
		// after this whole update run finishes, and only once the user
		// confirms per note there. Collected across ALL conventions of the run,
		// so a bulk update opens one review modal rather than one per folder.
		const legacyCandidates: LegacyMigrationCandidate[] = [];
		const totals: UpdateCounts = { merged: 0, created: 0, unchanged: 0, needsReimport: 0 };
		const failed: string[] = [];
		let updatedFolders = 0;

		for (const plan of plans) {
			const congressPath = normalizePath(plan.job.folder);
			// Re-checked per job, not just when the modal built its list: a
			// folder can be renamed or deleted between picking and running.
			if (!(this.app.vault.getAbstractFileByPath(congressPath) instanceof TFolder)) {
				failed.push(plan.job.label);
				new Notice(this.tr.noticeUpdateFolderNotFound(congressPath));
				continue;
			}
			try {
				const congressPlan = await this.planCongressUpdate(
					congressPath, plan.job.congress.lang, plan.notes, plan.attachments,
				);
				const counts = await this.executeCongressPlan(congressPlan, legacyCandidates, onStep);
				totals.merged += counts.merged;
				totals.created += counts.created;
				totals.unchanged += counts.unchanged;
				totals.needsReimport += counts.needsReimport;
				updatedFolders++;
			} catch (err) {
				failed.push(plan.job.label);
				if (!bulk) {
					progress?.hide();
					new Notice(this.tr.noticeImportRolledBack(this.describeError(err)));
					return;
				}
			}
		}

		progress?.hide();
		if (bulk) {
			new Notice(this.tr.noticeBulkUpdateResult(
				updatedFolders, totals.merged, totals.created, totals.needsReimport, totals.unchanged, failed,
			), 15000);
		} else if (failed.length === 0) {
			new Notice(this.tr.noticeUpdateResult(totals.merged, totals.created, totals.needsReimport, totals.unchanged), 10000);
		}
		// Separate, opt-in notice — a normal update run without any legacy
		// notes must look and behave exactly as it always has. Clicking is
		// the only way anything from `legacyCandidates` ever gets written.
		if (legacyCandidates.length > 0) {
			const legacyNotice = new Notice(this.tr.noticeLegacyCorrectionsFound(legacyCandidates.length), 15000);
			legacyNotice.noticeEl.addEventListener('click', () => {
				new LegacyMigrationModal(this.app, this, legacyCandidates).open();
			});
		}
	}

	/**
	 * The read-only half of updateFolders(): works out what the very same run
	 * would change, and writes nothing at all. Used by the preview command —
	 * the user sees the plan first and only then decides whether to run it.
	 *
	 * Applying afterwards deliberately goes through updateFolders() again
	 * rather than writing this plan out: a note may have been edited between
	 * looking and deciding, and re-planning against the file as it is then is
	 * the only way the write stays correct.
	 */
	async previewFolders(jobs: CongressUpdateJob[]): Promise<CongressPreview[]> {
		const builder = new NoteBuilder({
			scriptureLinks: this.settings.scriptureLinks,
			reviewNote: this.settings.reviewNote,
			showTagField: this.settings.showTagField,
			showTimeField: this.settings.showTimeField,
			showScriptureField: this.settings.showScriptureField,
			showSpeakerField: this.settings.showSpeakerField,
			speakerLink: this.settings.speakerLink,
			extraFields: this.settings.extraFields,
			frontmatter: this.settings.frontmatter,
		});

		const previews: CongressPreview[] = [];
		for (const job of jobs) {
			const congressPath = normalizePath(job.folder);
			if (!(this.app.vault.getAbstractFileByPath(congressPath) instanceof TFolder)) {
				previews.push({
					label: job.label, folder: congressPath, plan: null,
					error: this.tr.noticeUpdateFolderNotFound(congressPath),
				});
				continue;
			}
			try {
				const { notes, attachments } = builder.buildNotes(job.congress);
				const plan = await this.planCongressUpdate(congressPath, job.congress.lang, notes, attachments);
				previews.push({ label: job.label, folder: congressPath, plan });
			} catch (err) {
				previews.push({ label: job.label, folder: congressPath, plan: null, error: this.describeError(err) });
			}
		}
		return previews;
	}

	/**
	 * Works out what an update would do to `congressPath`, WITHOUT writing
	 * anything: one decided outcome per generated note and attachment.
	 *
	 * Every branch of the update lives here and nowhere else — the preview
	 * renders this plan and executeCongressPlan() carries out this same plan,
	 * so a preview cannot drift from what actually happens. A preview computed
	 * by its own second set of rules would eventually lie, and a preview that
	 * lies is worse than none at all.
	 */
	private async planCongressUpdate(
		congressPath: string,
		lang: CongressLang,
		notes: GeneratedNote[],
		attachments: GeneratedAttachment[],
	): Promise<CongressPlan> {
		const plannedNotes: PlannedNote[] = [];
		const plannedAttachments: PlannedAttachment[] = [];

		for (const note of notes) {
			const path = await this.resolvePath(congressPath, note.dayFolder, note.filename);
			const existing = this.app.vault.getAbstractFileByPath(path);
			if (!(existing instanceof TFile)) {
				// Nothing to preserve for a note that doesn't exist yet
				// (e.g. the programme fix added a new item) — create it
				// fresh, same as a plain import would.
				plannedNotes.push({ kind: 'create', path, content: note.content });
				continue;
			}
			if (note.regenerate) {
				const before = await this.app.vault.read(existing);
				plannedNotes.push({ kind: 'regenerate', path, content: note.content, changed: before !== note.content });
				continue;
			}
			const existingContent = await this.app.vault.read(existing);
			const mergedContent = mergeNoteContent(existingContent, note.content);
			if (mergedContent === null) {
				// Only ever fall back to the text heuristic for notes with
				// NO markers whatsoever — a note whose markers exist but
				// are corrupted/mismatched must stay in needs-reimport
				// untouched, not get swept into a mechanism that has no
				// idea markers were ever there (see hasNoMarkers() doc).
				const corrections = hasNoMarkers(existingContent)
					? findLegacyCorrections(existingContent, note.content, NL[lang])
					: [];
				plannedNotes.push({ kind: 'needs-reimport', path, legacy: corrections });
			} else if (mergedContent !== existingContent) {
				// `changes` can legitimately be empty here: a note written by
				// 1.9.0–1.18.0 has its %%jw:…%% markers silently upgraded to
				// span markers, which changes the file without changing a
				// single character the reader ever sees.
				plannedNotes.push({
					kind: 'merge',
					path,
					content: mergedContent,
					changes: diffNoteContent(existingContent, note.content) ?? [],
				});
			} else {
				plannedNotes.push({ kind: 'unchanged', path });
			}
		}

		for (const attachment of attachments) {
			const path = await this.resolvePath(congressPath, attachment.dayFolder, attachment.filename);
			const existing = this.app.vault.getAbstractFileByPath(path);
			if (!(existing instanceof TFile)) {
				plannedAttachments.push({ kind: 'create', path, data: attachment.data });
			} else if (attachment.regenerate) {
				plannedAttachments.push({ kind: 'regenerate', path, data: attachment.data });
			} else {
				plannedAttachments.push({ kind: 'unchanged', path });
			}
		}

		return { notes: plannedNotes, attachments: plannedAttachments };
	}

	/** Carries out a plan from planCongressUpdate(): the only place that writes
	 *  during an update. Appends any legacy-note candidates it passes to
	 *  `legacyCandidates` and reports progress through `onStep`. On failure it
	 *  trashes the files THIS convention created and rethrows, leaving the
	 *  caller to decide whether the whole run stops. */
	private async executeCongressPlan(
		plan: CongressPlan,
		legacyCandidates: LegacyMigrationCandidate[],
		onStep: () => void,
	): Promise<UpdateCounts> {
		let merged = 0;
		let created = 0;
		let unchanged = 0;
		let needsReimport = 0;
		const createdPaths: string[] = [];

		try {
			for (const note of plan.notes) {
				switch (note.kind) {
					case 'create':
						await this.app.vault.create(note.path, note.content);
						createdPaths.push(note.path);
						created++;
						break;
					case 'regenerate':
					case 'merge': {
						const file = this.app.vault.getAbstractFileByPath(note.path);
						if (file instanceof TFile) await this.app.vault.modify(file, note.content);
						merged++;
						break;
					}
					case 'needs-reimport':
						needsReimport++;
						// Never written automatically; only offered for review.
						if (note.legacy.length > 0) legacyCandidates.push({ path: note.path, corrections: note.legacy });
						break;
					case 'unchanged':
						unchanged++;
						break;
				}
				onStep();
			}

			for (const attachment of plan.attachments) {
				if (attachment.kind === 'unchanged') {
					unchanged++;
					onStep();
					continue;
				}
				const buf = attachment.data;
				const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
				if (attachment.kind === 'regenerate') {
					const file = this.app.vault.getAbstractFileByPath(attachment.path);
					if (file instanceof TFile) await this.app.vault.modifyBinary(file, arrayBuffer);
					merged++;
				} else {
					await this.app.vault.createBinary(attachment.path, arrayBuffer);
					createdPaths.push(attachment.path);
					created++;
				}
				onStep();
			}

			return { merged, created, unchanged, needsReimport };
		} catch (err) {
			for (const path of createdPaths.reverse()) {
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file) await this.app.fileManager.trashFile(file);
			}
			throw err;
		}
	}

	/** Removes the whole scripture link the cursor sits in — brackets, label,
	 *  URL and all. The cursor position is read here rather than passed in, so
	 *  a context-menu click acts on where the menu was opened, not on where
	 *  the caret happened to be beforehand. */
	private removeScriptureLinkAtCursor(editor: Editor): void {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		const span = findScriptureLinkSpanAt(line, cursor.ch);
		if (!span) {
			new Notice(this.tr.noticeNoScriptureLinkAtCursor);
			return;
		}
		const updated = cutSpan(line, span.index, span.length);
		editor.replaceRange(updated, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: line.length });
		// Left where the reference stood, so typing can simply continue there.
		editor.setCursor({ line: cursor.line, ch: Math.min(span.index, updated.length) });
	}

	/** Scans, groups and opens the review dialog — or says plainly that there
	 *  was nothing to convert, which is the expected outcome for a vault whose
	 *  Speaker fields are already links or still empty. */
	private async openSpeakerLinkModal(): Promise<void> {
		const occurrences = await this.scanSpeakerNames();
		const groups = groupSpeakerVariants(occurrences);
		if (groups.length === 0) {
			new Notice(this.tr.noticeSpeakerLinkNothingFound);
			return;
		}
		new SpeakerLinkModal(this.app, this, groups).open();
	}

	/** Every spelling a Speaker label can have across the supported note
	 *  languages. A vault may well hold notes imported from files in more than
	 *  one language, and a note does not record which one it was — so the scan
	 *  below recognises all of them instead of assuming the current setting. */
	private speakerLabels(): string[] {
		return [...new Set(Object.values(NL).map(strings => strings.speakerLabel))];
	}

	/**
	 * Collects every hand-typed name in a Speaker field across the whole vault
	 * and proposes which spellings belong to the same person — the one-off
	 * migration described in util/speakerNames.ts. Reads only; the proposal
	 * goes to SpeakerLinkModal, and nothing is written before it is confirmed.
	 *
	 * Names written somewhere other than the Speaker field (an ordinary
	 * congregation talk often has the name in the lines below the title) are
	 * deliberately out of scope: outside the labelled field there is nothing
	 * to anchor to, and picking lines that "look like a name" is the guessing
	 * this whole approach exists to avoid. Once a speaker's note exists,
	 * Obsidian's own unlinked-mentions panel finds those by itself.
	 */
	async scanSpeakerNames(): Promise<SpeakerOccurrence[]> {
		const labels = this.speakerLabels();
		const found: SpeakerOccurrence[] = [];
		for (const file of this.app.vault.getMarkdownFiles()) {
			const content = await this.app.vault.cachedRead(file);
			// Cheap pre-filter: the overwhelming majority of notes in a vault
			// have no Speaker field at all, and splitting every one of them
			// into lines would be the expensive part of this scan.
			if (!labels.some(label => content.includes(`**${label}:**`))) continue;
			const lines = content.split('\n');
			for (let i = 0; i < lines.length; i++) {
				const value = findSpeakerValue(lines[i]!, labels);
				if (value !== null) found.push({ path: file.path, line: i, text: value });
			}
		}
		return found;
	}

	/** Writes the confirmed speaker links. Each note is re-read and each line
	 *  re-checked against the name that was proposed for it, so a note edited
	 *  between the review and the click is left alone rather than overwritten
	 *  with a stale line — the same rule applyLegacyNoteCorrections() follows. */
	async applySpeakerLinks(selected: { group: SpeakerGroup; target: string }[]): Promise<void> {
		const labels = this.speakerLabels();
		const byPath = new Map<string, { line: number; text: string; target: string }[]>();
		for (const { group, target } of selected) {
			for (const occurrence of group.occurrences) {
				const list = byPath.get(occurrence.path) ?? [];
				list.push({ line: occurrence.line, text: occurrence.text, target });
				byPath.set(occurrence.path, list);
			}
		}

		let converted = 0;
		let skipped = 0;
		for (const [path, edits] of byPath) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) {
				skipped += edits.length;
				continue;
			}
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			let touched = false;
			for (const edit of edits) {
				const line = lines[edit.line];
				if (line === undefined || findSpeakerValue(line, labels) !== edit.text) {
					skipped++;
					continue;
				}
				lines[edit.line] = replaceSpeakerValue(line, speakerLink(edit.target, edit.text));
				touched = true;
				converted++;
			}
			if (touched) await this.app.vault.modify(file, lines.join('\n'));
		}

		new Notice(this.tr.noticeSpeakerLinksApplied(converted, skipped), 10000);
	}

	/** Called by LegacyMigrationModal once the user confirms a note's corrections.
	 *  Re-reads the file fresh (not whatever was cached when the corrections were
	 *  detected — the note may have been edited elsewhere in the meantime) and lets
	 *  applyLegacyCorrections() re-verify each line before writing it. Returns
	 *  whether anything was actually changed, so the modal can report an accurate count. */
	async applyLegacyNoteCorrections(notePath: string, accepted: LegacyFieldCorrection[]): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(notePath);
		if (!(file instanceof TFile)) return false;
		const current = await this.app.vault.read(file);
		const patched = applyLegacyCorrections(current, accepted);
		if (patched === current) return false;
		await this.app.vault.modify(file, patched);
		return true;
	}

	// The meeting-workbook counterpart to importFile(): same rollback-on-failure
	// and progress-notice pattern, and the same regenerate-flagged-attachment
	// handling (each week's own cover image), via MwbSourceRouter/MwbNoteBuilder
	// instead of SourceRouter/NoteBuilder. Own, independent settings
	// (mwbTargetFolder, mwbScriptureLinks, …) rather than reusing the congress
	// ones — the two note types are conceptually different content.
	async importMwbFile(filename: string, data: Uint8Array, targetFolder?: string): Promise<void> {
		const router = new MwbSourceRouter(this.sqlWasmBinary);
		const builder = new MwbNoteBuilder({
			scriptureLinks: this.settings.mwbScriptureLinks,
			showDurationField: this.settings.mwbShowDurationField,
			showSourceCitationField: this.settings.mwbShowSourceCitationField,
			frontmatter: this.settings.mwbFrontmatter,
		});

		let result;
		try {
			result = await router.route(filename, data);
		} catch (err) {
			new Notice(this.tr.noticeImportFailed(this.describeError(err)));
			return;
		}

		const { issueFolder, notes, attachments } = builder.buildNotes(result.mwb);
		const rawBase = (targetFolder ?? this.settings.mwbTargetFolder).trim();
		const baseFolder = rawBase ? normalizePath(rawBase) : '';
		const issuePath = baseFolder ? normalizePath(`${baseFolder}/${issueFolder}`) : normalizePath(issueFolder);

		const createdPaths: string[] = [];
		let updated = 0;
		let skipped = 0;

		const total = notes.length + attachments.length;
		let done = 0;
		const progress = total > 3 ? new Notice(this.tr.noticeImportProgress(0, total), 0) : null;

		try {
			if (baseFolder) await this.ensureFolder(baseFolder);
			await this.ensureFolder(issuePath);

			for (const note of notes) {
				const notePath = await this.resolvePath(issuePath, undefined, note.filename);
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
				const attachPath = await this.resolvePath(issuePath, undefined, attachment.filename);
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
			const describe = this.tr.noticeImportMwbResult ?? this.tr.noticeImportResult;
			new Notice(describe(issueFolder, createdPaths.length, updated, skipped), 10000);
		} catch (err) {
			progress?.hide();
			for (const path of createdPaths.reverse()) {
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file) await this.app.fileManager.trashFile(file);
			}
			new Notice(this.tr.noticeImportRolledBack(this.describeError(err)));
		}
	}

	// The meeting-workbook counterpart to updateFile(): same marker-merge
	// pattern via mergeNoteContent() — every mwb note ships with markers from
	// day one (brand-new feature), so unlike updateFile() there's no legacy
	// pre-marker fallback to consider here.
	async updateMwbFile(filename: string, data: Uint8Array, targetFolder: string): Promise<void> {
		const issuePath = normalizePath(targetFolder);
		const existingFolder = this.app.vault.getAbstractFileByPath(issuePath);
		if (!(existingFolder instanceof TFolder)) {
			new Notice(this.tr.noticeUpdateFolderNotFound(issuePath));
			return;
		}

		const router = new MwbSourceRouter(this.sqlWasmBinary);
		const builder = new MwbNoteBuilder({
			scriptureLinks: this.settings.mwbScriptureLinks,
			showDurationField: this.settings.mwbShowDurationField,
			showSourceCitationField: this.settings.mwbShowSourceCitationField,
			frontmatter: this.settings.mwbFrontmatter,
		});

		let result;
		try {
			result = await router.route(filename, data);
		} catch (err) {
			new Notice(this.tr.noticeImportFailed(this.describeError(err)));
			return;
		}

		const { notes, attachments } = builder.buildNotes(result.mwb);

		let merged = 0;
		let created = 0;
		let unchanged = 0;
		let needsReimport = 0;
		const createdPaths: string[] = [];

		const total = notes.length + attachments.length;
		let done = 0;
		const progress = total > 3 ? new Notice(this.tr.noticeImportProgress(0, total), 0) : null;

		try {
			for (const note of notes) {
				const notePath = await this.resolvePath(issuePath, undefined, note.filename);
				const existing = this.app.vault.getAbstractFileByPath(notePath);
				if (existing instanceof TFile) {
					if (note.regenerate) {
						await this.app.vault.modify(existing, note.content);
						merged++;
					} else {
						const existingContent = await this.app.vault.read(existing);
						const mergedContent = mergeNoteContent(existingContent, note.content);
						if (mergedContent === null) {
							needsReimport++;
						} else if (mergedContent !== existingContent) {
							await this.app.vault.modify(existing, mergedContent);
							merged++;
						} else {
							unchanged++;
						}
					}
				} else {
					await this.app.vault.create(notePath, note.content);
					createdPaths.push(notePath);
					created++;
				}
				done++;
				progress?.setMessage(this.tr.noticeImportProgress(done, total));
			}

			for (const attachment of attachments) {
				const attachPath = await this.resolvePath(issuePath, undefined, attachment.filename);
				const existing = this.app.vault.getAbstractFileByPath(attachPath);
				const buf = attachment.data;
				const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
				if (existing instanceof TFile) {
					if (attachment.regenerate) {
						await this.app.vault.modifyBinary(existing, arrayBuffer);
						merged++;
					} else {
						unchanged++;
					}
				} else {
					await this.app.vault.createBinary(attachPath, arrayBuffer);
					createdPaths.push(attachPath);
					created++;
				}
				done++;
				progress?.setMessage(this.tr.noticeImportProgress(done, total));
			}

			progress?.hide();
			const describe = this.tr.noticeUpdateMwbResult ?? this.tr.noticeUpdateResult;
			new Notice(describe(merged, created, needsReimport, unchanged), 10000);
		} catch (err) {
			progress?.hide();
			for (const path of createdPaths.reverse()) {
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file) await this.app.fileManager.trashFile(file);
			}
			new Notice(this.tr.noticeImportRolledBack(this.describeError(err)));
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
