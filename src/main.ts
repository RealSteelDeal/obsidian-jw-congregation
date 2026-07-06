import { FileSystemAdapter, Notice, Plugin, TFolder, normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS, JwPluginSettings, JwSettingTab } from './settings';
import { SourceRouter } from './parser/SourceRouter';
import { NoteBuilder } from './builder/NoteBuilder';
import { ImportModal } from './ui/ImportModal';

export default class JwCongregationPlugin extends Plugin {
	settings!: JwPluginSettings;

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

	getPluginDir(): string {
		const adapter = this.app.vault.adapter as FileSystemAdapter;
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const nodePath = require('path') as typeof import('path');
		return nodePath.join(adapter.getBasePath(), this.manifest.dir ?? '');
	}

	async importFile(filename: string, data: Buffer, targetFolder?: string): Promise<void> {
		const router = new SourceRouter(this.getPluginDir());
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
			new Notice('jwpub-Parsing fehlgeschlagen – RTF-Fallback verwendet.');
		}

		const { congressFolder, notes } = builder.buildNotes(result.congress);
		const baseFolder = normalizePath(targetFolder?.trim() || this.settings.targetFolder);
		const congressPath = normalizePath(`${baseFolder}/${congressFolder}`);

		try {
			await this.ensureFolder(baseFolder);
			await this.ensureFolder(congressPath);

			let created = 0;
			for (const note of notes) {
				let notePath: string;
				if (note.dayFolder) {
					const dayPath = normalizePath(`${congressPath}/${note.dayFolder}`);
					await this.ensureFolder(dayPath);
					notePath = normalizePath(`${dayPath}/${note.filename}`);
				} else {
					notePath = normalizePath(`${congressPath}/${note.filename}`);
				}

				const existing = this.app.vault.getAbstractFileByPath(notePath);
				if (existing) {
					new Notice(`Übersprungen (existiert bereits): ${note.filename}`);
					continue;
				}
				await this.app.vault.create(notePath, note.content);
				created++;
			}

			new Notice(`${created} Notiz(en) erstellt in „${congressFolder}".`);
		} catch (err) {
			new Notice(`Import fehlgeschlagen: ${String(err)}`);
		}
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
