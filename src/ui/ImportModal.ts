import { App, Modal, Notice, Setting, TextComponent, TFolder } from 'obsidian';
import type JwCongregationPlugin from '../main';
import { SourceRouter } from '../parser/SourceRouter';
import { Congress, CongressType } from '../models/congress';

const TYPE_LABELS: Record<CongressType, string> = {
	'CO':        'Regionaler Kongress',
	'CA-copgm':  'Kreiskongress (Kreisaufseher)',
	'CA-brpgm':  'Kreiskongress (Zweigbüro)',
};

const NEW_FOLDER_VALUE = '__new__';

function listAllFolders(app: App): TFolder[] {
	const folders: TFolder[] = [];
	const collect = (folder: TFolder) => {
		if (folder.path !== '/') folders.push(folder);
		for (const child of folder.children) {
			if (child instanceof TFolder) collect(child);
		}
	};
	collect(app.vault.getRoot());
	folders.sort((a, b) => a.path.localeCompare(b.path));
	return folders;
}

export class ImportModal extends Modal {
	private fileData: Uint8Array | null = null;
	private filename = '';
	private preview: Congress | null = null;
	private previewEl: HTMLElement | null = null;
	private targetFolder: string;

	constructor(app: App, private readonly plugin: JwCongregationPlugin) {
		super(app);
		this.targetFolder = plugin.settings.targetFolder;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Kongressprogramm importieren' });

		new Setting(contentEl)
			.setName('Programmdatei')
			.setDesc('Wähle eine .jwpub-Datei oder ein RTF-ZIP.')
			.addButton(btn =>
				btn.setButtonText('Datei wählen …').onClick(() => {
					const input = createEl('input', { type: 'file' });
					input.accept = '.jwpub,.zip,.rtf';
					input.onchange = async () => {
						const file = input.files?.[0];
						if (!file) return;
						this.filename = file.name;
						this.fileData = new Uint8Array(await file.arrayBuffer());
						await this.loadPreview();
					};
					input.click();
				}),
			);

		const folders = listAllFolders(this.app);
		const existingMatch = folders.some(f => f.path === this.targetFolder);
		let newFolderText: TextComponent | undefined;

		const newFolderSetting = new Setting(contentEl)
			.setName('Name des neuen Ordners')
			.addText(text => {
				text
					.setPlaceholder('Kongress')
					.setValue(existingMatch ? '' : this.targetFolder)
					.onChange(value => {
						this.targetFolder = value.trim();
					});
				newFolderText = text;
			});
		if (existingMatch) newFolderSetting.settingEl.hide();

		const folderDropdownSetting = new Setting(contentEl)
			.setName('Zielordner')
			.setDesc('Bestehenden Ordner wählen oder einen neuen anlegen.')
			.addDropdown(drop => {
				for (const folder of folders) {
					drop.addOption(folder.path, folder.path);
				}
				drop.addOption(NEW_FOLDER_VALUE, '➕ Neuer Ordner …');
				drop.setValue(existingMatch ? this.targetFolder : NEW_FOLDER_VALUE);
				drop.onChange(value => {
					if (value === NEW_FOLDER_VALUE) {
						newFolderSetting.settingEl.show();
						this.targetFolder = newFolderText?.getValue().trim() || '';
					} else {
						newFolderSetting.settingEl.hide();
						this.targetFolder = value;
					}
				});
			});
		// Dropdown should visually appear above the "new folder name" field.
		contentEl.insertBefore(folderDropdownSetting.settingEl, newFolderSetting.settingEl);

		this.previewEl = contentEl.createDiv('jw-import-preview');

		new Setting(contentEl)
			.addButton(btn =>
				btn
					.setButtonText('Importieren')
					.setCta()
					.onClick(async () => {
						if (!this.fileData) {
							new Notice('Bitte zuerst eine Datei wählen.');
							return;
						}
						this.close();
						await this.plugin.importFile(this.filename, this.fileData, this.targetFolder);
					}),
			)
			.addButton(btn =>
				btn.setButtonText('Abbrechen').onClick(() => this.close()),
			);
	}

	private async loadPreview() {
		if (!this.fileData || !this.previewEl) return;
		this.previewEl.empty();

		try {
			const router = new SourceRouter(this.plugin.sqlWasmBinary);
			const result = await router.route(this.filename, this.fileData);
			this.preview = result.congress;
			this.renderPreview(result.congress, result.source);
		} catch (err) {
			this.previewEl.createEl('p', {
				text: `Vorschau nicht möglich: ${String(err)}`,
				cls: 'jw-preview-error',
			});
		}
	}

	private renderPreview(congress: Congress, source: string) {
		if (!this.previewEl) return;
		const el = this.previewEl;

		el.createEl('h3', { text: 'Vorschau' });

		const table = el.createEl('table', { cls: 'jw-preview-table' });
		const addRow = (label: string, value: string) => {
			const row = table.createEl('tr');
			row.createEl('td', { text: label, cls: 'jw-label' });
			row.createEl('td', { text: value });
		};

		addRow('Typ', TYPE_LABELS[congress.type] ?? congress.type);
		addRow('Motto', congress.theme);
		addRow('Jahr', String(congress.year));
		addRow('Tage', congress.days.map(d => d.weekday).join(', '));
		addRow('Quelle', source === 'jwpub' ? 'jwpub' : 'RTF (Fallback)');

		const itemCount = congress.days.flatMap(d =>
			d.sessions.flatMap(s => s.items),
		).length;
		addRow('Programmpunkte', String(itemCount));
	}

	onClose() {
		this.contentEl.empty();
	}
}
