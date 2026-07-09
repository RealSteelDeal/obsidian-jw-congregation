import { App, Modal, Notice, Setting, TextComponent, TFolder } from 'obsidian';
import { L, Strings } from '../i18n';
import type JwCongregationPlugin from '../main';
import { SourceRouter } from '../parser/SourceRouter';
import { Congress } from '../models/congress';

const NEW_FOLDER_VALUE = '__new__';
const ROOT_VALUE = '__root__';

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

	private get t(): Strings {
		return L[this.plugin.settings.lang];
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.t.importTitle });

		new Setting(contentEl)
			.setName(this.t.importFileName)
			.setDesc(this.t.importFileDesc)
			.addButton(btn =>
				btn.setButtonText(this.t.btnPickFile).onClick(() => {
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
		// A saved target folder that no longer exists in the vault must not funnel
		// the user into the "create new folder" flow with a stale prefill (confirmed
		// by real-world feedback: a leftover "Kongress" default made the modal open
		// on "➕ Neuer Ordner" every time). Fall back to the vault root instead —
		// "new folder" is strictly an explicit dropdown choice now.
		if (this.targetFolder !== '' && !folders.some(f => f.path === this.targetFolder)) {
			this.targetFolder = '';
		}
		const isRoot = this.targetFolder === '';
		let newFolderText: TextComponent | undefined;

		const newFolderSetting = new Setting(contentEl)
			.setName(this.t.importNewFolder)
			.addText(text => {
				text
					.setPlaceholder(this.t.importNewFolderPlaceholder)
					.onChange(value => {
						this.targetFolder = value.trim();
					});
				newFolderText = text;
			});
		newFolderSetting.settingEl.hide();

		const folderDropdownSetting = new Setting(contentEl)
			.setName(this.t.importTarget)
			.setDesc(this.t.importTargetDesc)
			.addDropdown(drop => {
				drop.addOption(ROOT_VALUE, this.t.optVaultRoot);
				for (const folder of folders) {
					drop.addOption(folder.path, folder.path);
				}
				drop.addOption(NEW_FOLDER_VALUE, this.t.optNewFolder);
				// After the normalization above, targetFolder is always either '' (root)
				// or an existing folder path — never a not-yet-created name.
				drop.setValue(isRoot ? ROOT_VALUE : this.targetFolder);
				drop.onChange(value => {
					if (value === NEW_FOLDER_VALUE) {
						newFolderSetting.settingEl.show();
						this.targetFolder = newFolderText?.getValue().trim() || '';
					} else if (value === ROOT_VALUE) {
						newFolderSetting.settingEl.hide();
						this.targetFolder = '';
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
					.setButtonText(this.t.btnImport)
					.setCta()
					.onClick(async () => {
						if (!this.fileData) {
							new Notice(this.t.noticePickFileFirst);
							return;
						}
						this.close();
						await this.plugin.importFile(this.filename, this.fileData, this.targetFolder);
					}),
			)
			.addButton(btn =>
				btn.setButtonText(this.t.btnCancel).onClick(() => this.close()),
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
				text: this.t.previewFailed(String(err)),
				cls: 'jw-preview-error',
			});
		}
	}

	private renderPreview(congress: Congress, source: string) {
		if (!this.previewEl) return;
		const el = this.previewEl;

		el.createEl('h3', { text: this.t.previewHeading });

		const table = el.createEl('table', { cls: 'jw-preview-table' });
		const addRow = (label: string, value: string) => {
			const row = table.createEl('tr');
			row.createEl('td', { text: label, cls: 'jw-label' });
			row.createEl('td', { text: value });
		};

		addRow(this.t.rowType, this.t.typeLabels[congress.type] ?? congress.type);
		addRow(this.t.rowTheme, congress.theme);
		addRow(this.t.rowYear, String(congress.year));
		addRow(this.t.rowDays, congress.days.map(d => d.weekday).join(', '));
		addRow(this.t.rowSource, source === 'jwpub' ? 'jwpub' : this.t.rowSourceRtf);

		const itemCount = congress.days.flatMap(d =>
			d.sessions.flatMap(s => s.items),
		).length;
		addRow(this.t.rowLanguage, this.t.langDisplay(congress.lang));
		addRow(this.t.rowItems, String(itemCount));
	}

	onClose() {
		this.contentEl.empty();
	}
}
