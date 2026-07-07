import { Notice, Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS, JwPluginSettings, JwSettingTab } from './settings';
import { SourceRouter } from './parser/SourceRouter';
import { NoteBuilder } from './builder/NoteBuilder';
import { ImportModal } from './ui/ImportModal';
import { BibleReader } from './bible/BibleReader';
import { BibleVerseModal } from './ui/BibleVerseModal';
import { ScriptureNormalizer } from './normalizer/ScriptureNormalizer';
import { Scripture } from './models/congress';
// esbuild's "binary" loader embeds this as base64 in main.js and decodes it to a
// Uint8Array at bundle time — no separate file needs to ship alongside main.js.
import sqlWasmBinary from 'sql.js/dist/sql-wasm.wasm';

const BIBLE_FILE_NAME = 'bible-cache.jwpub';

export default class JwCongregationPlugin extends Plugin {
	settings!: JwPluginSettings;
	readonly sqlWasmBinary = sqlWasmBinary;

	// Lazily loaded on first scripture-link click, then cached for the rest of
	// the session — decrypting/indexing a full Bible file (up to ~125 MB for the
	// Study Edition) on every click would be far too slow.
	private bibleReader: BibleReader | null = null;
	private bibleReaderLoading: Promise<BibleReader | null> | null = null;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('book-open', 'Kongressprogramm importieren', () => {
			new ImportModal(this.app, this).open();
		});

		this.addCommand({
			id: 'import-congress-program',
			name: 'Kongressprogramm importieren',
			callback: () => new ImportModal(this.app, this).open(),
		});

		this.addSettingTab(new JwSettingTab(this.app, this));

		// Capture phase so we run before Obsidian's own link-click handling —
		// only intercepts our own jwlibrary:// scripture links (song links use a
		// different https://www.jw.org scheme and are left alone), and only when
		// a Bible file has actually been loaded.
		this.registerDomEvent(document, 'click', this.onDocumentClick.bind(this), true);
	}

	onunload() {}

	private onDocumentClick(evt: MouseEvent): void {
		if (!this.settings.bibleFileLoaded) return;
		const target = evt.target as HTMLElement | null;
		const link = target?.closest('a[href^="jwlibrary://"]') as HTMLAnchorElement | null;
		if (!link) return;

		const scripture = this.parseScriptureFromHref(link.href);
		if (!scripture) return;

		evt.preventDefault();
		const href = link.href;
		void (async () => {
			const reader = await this.getBibleReader();
			if (!reader) {
				window.open(href); // Bible file failed to load — fall back to the normal link behaviour
				return;
			}
			new BibleVerseModal(this.app, scripture, this.settings.lang, reader).open();
		})();
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
		new Notice('Bibel-Datei gespeichert.');
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
				const data = await this.app.vault.adapter.readBinary(this.bibleFilePath());
				const reader = new BibleReader(this.sqlWasmBinary);
				await reader.load(new Uint8Array(data));
				this.bibleReader = reader;
				return reader;
			} catch (err) {
				new Notice(`Bibel-Datei konnte nicht geladen werden: ${String(err)}`);
				return null;
			} finally {
				this.bibleReaderLoading = null;
			}
		})();
		return this.bibleReaderLoading;
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<JwPluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async importFile(filename: string, data: Uint8Array, targetFolder?: string): Promise<void> {
		const router = new SourceRouter(this.sqlWasmBinary);
		const builder = new NoteBuilder({
			lang: this.settings.lang,
			scriptureLinks: this.settings.scriptureLinks,
			reviewNote: this.settings.reviewNote,
			showTagField: this.settings.showTagField,
			showTimeField: this.settings.showTimeField,
			showScriptureField: this.settings.showScriptureField,
			showSpeakerField: this.settings.showSpeakerField,
			extraFields: this.settings.extraFields,
		});

		let result;
		try {
			result = await router.route(filename, data);
		} catch (err) {
			new Notice(`Import fehlgeschlagen: ${String(err)}`);
			return;
		}

		if (result.source === 'rtf' && result.fallback) {
			new Notice('Jwpub-Parsing fehlgeschlagen – RTF-Fallback verwendet.');
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
		const progress = total > 3 ? new Notice(`Import läuft … 0/${total}`, 0) : null;

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
				progress?.setMessage(`Import läuft … ${done}/${total}`);
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
				progress?.setMessage(`Import läuft … ${done}/${total}`);
			}

			progress?.hide();
			const parts = [`${createdPaths.length} neu`];
			if (updated > 0) parts.push(`${updated} aktualisiert`);
			if (skipped > 0) parts.push(`${skipped} übersprungen (bereits vorhanden)`);
			new Notice(`„${congressFolder}": ${parts.join(', ')}.`);
		} catch (err) {
			progress?.hide();
			for (const path of createdPaths.reverse()) {
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file) await this.app.fileManager.trashFile(file);
			}
			new Notice(`Import fehlgeschlagen, bereits erstellte Dateien wurden zurückgerollt: ${String(err)}`);
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
			throw new Error(`„${path}" ist keine Ordner-Datei.`);
		}
	}
}
