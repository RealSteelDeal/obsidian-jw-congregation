import { Notice, Plugin, TFolder, normalizePath } from 'obsidian';
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

	async importFile(filename: string, data: Buffer): Promise<void> {
		const router = new SourceRouter();
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

		const notes = builder.buildNotes(result.congress);
		const folder = normalizePath(this.settings.targetFolder);

		await this.ensureFolder(folder);

		let created = 0;
		for (const note of notes) {
			const path = normalizePath(`${folder}/${note.filename}`);
			const existing = this.app.vault.getAbstractFileByPath(path);
			if (existing) {
				new Notice(`Übersprungen (existiert bereits): ${note.filename}`);
				continue;
			}
			await this.app.vault.create(path, note.content);
			created++;
		}

		new Notice(`${created} Notiz(en) erstellt in „${folder}".`);
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
