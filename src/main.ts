import { Notice, Plugin, TFolder, normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS, JwPluginSettings, JwSettingTab } from './settings';
import { SourceRouter } from './parser/SourceRouter';
import { NoteBuilder } from './builder/NoteBuilder';
import { ImportModal } from './ui/ImportModal';
// esbuild's "binary" loader embeds this as base64 in main.js and decodes it to a
// Uint8Array at bundle time — no separate file needs to ship alongside main.js.
import sqlWasmBinary from 'sql.js/dist/sql-wasm.wasm';

export default class JwCongregationPlugin extends Plugin {
	settings!: JwPluginSettings;
	readonly sqlWasmBinary = sqlWasmBinary;

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
	}

	onunload() {}

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
		const baseFolder = normalizePath(targetFolder?.trim() || this.settings.targetFolder);
		const congressPath = normalizePath(`${baseFolder}/${congressFolder}`);

		// Track only the notes/attachments actually created in this run, so a failure
		// partway through can be rolled back without touching folders/files that
		// already existed before the import (e.g. a reused target folder).
		const createdPaths: string[] = [];

		try {
			await this.ensureFolder(baseFolder);
			await this.ensureFolder(congressPath);

			for (const note of notes) {
				const notePath = await this.resolvePath(congressPath, note.dayFolder, note.filename);
				const existing = this.app.vault.getAbstractFileByPath(notePath);
				if (existing) {
					new Notice(`Übersprungen (existiert bereits): ${note.filename}`);
					continue;
				}
				await this.app.vault.create(notePath, note.content);
				createdPaths.push(notePath);
			}

			for (const attachment of attachments) {
				const attachPath = await this.resolvePath(congressPath, attachment.dayFolder, attachment.filename);
				const existing = this.app.vault.getAbstractFileByPath(attachPath);
				if (existing) continue;
				const buf = attachment.data;
				const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
				await this.app.vault.createBinary(attachPath, arrayBuffer);
				createdPaths.push(attachPath);
			}

			new Notice(`${createdPaths.length} Datei(en) erstellt in „${congressFolder}".`);
		} catch (err) {
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
