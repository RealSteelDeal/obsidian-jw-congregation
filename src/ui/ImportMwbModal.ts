import { App, Modal, Notice, Setting, TextComponent } from 'obsidian';
import { L, Strings } from '../i18n';
import type JwCongregationPlugin from '../main';
import { MwbSourceRouter } from '../parser/MwbSourceRouter';
import { Mwb } from '../models/mwb';
import { listAllFolders } from '../util/folderList';

const NEW_FOLDER_VALUE = '__new__';
const ROOT_VALUE = '__root__';

/** Mirrors ImportModal.ts exactly (same Modal/Setting conventions), scoped
 *  to meeting-workbook jwpub files (no RTF/zip fallback — there's no RTF
 *  export format for these) and MwbSourceRouter/plugin.importMwbFile(). */
export class ImportMwbModal extends Modal {
	private fileData: Uint8Array | null = null;
	private filename = '';
	private preview: Mwb | null = null;
	private previewEl: HTMLElement | null = null;
	private targetFolder: string;

	constructor(app: App, private readonly plugin: JwCongregationPlugin) {
		super(app);
		this.targetFolder = plugin.settings.mwbTargetFolder;
	}

	private get t(): Strings {
		return L[this.plugin.settings.lang];
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.t.importMwbTitle ?? '' });

		new Setting(contentEl)
			.setName(this.t.importFileName)
			.setDesc(this.t.importMwbFileDesc ?? '')
			.addButton(btn =>
				btn.setButtonText(this.t.btnPickFile).onClick(() => {
					const input = createEl('input', { type: 'file' });
					input.accept = '.jwpub';
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
			.setName(this.t.setMwbTargetFolder ?? this.t.importTarget)
			.setDesc(this.t.importTargetDesc)
			.addDropdown(drop => {
				drop.addOption(ROOT_VALUE, this.t.optVaultRoot);
				for (const folder of folders) {
					drop.addOption(folder.path, folder.path);
				}
				drop.addOption(NEW_FOLDER_VALUE, this.t.optNewFolder);
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
						await this.plugin.importMwbFile(this.filename, this.fileData, this.targetFolder);
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
			const router = new MwbSourceRouter(this.plugin.sqlWasmBinary);
			const result = await router.route(this.filename, this.fileData);
			this.preview = result.mwb;
			this.renderPreview(result.mwb);
		} catch (err) {
			this.previewEl.createEl('p', {
				text: this.t.previewFailed(String(err)),
				cls: 'jw-preview-error',
			});
		}
	}

	private renderPreview(mwb: Mwb) {
		if (!this.previewEl) return;
		const el = this.previewEl;

		el.createEl('h3', { text: this.t.previewHeading });

		const table = el.createEl('table', { cls: 'jw-preview-table' });
		const addRow = (label: string, value: string) => {
			const row = table.createEl('tr');
			row.createEl('td', { text: label, cls: 'jw-label' });
			row.createEl('td', { text: value });
		};

		addRow(this.t.rowYear, String(mwb.year));
		addRow(this.t.rowWeeks ?? 'Wochen', String(mwb.weeks.length));
		const itemCount = mwb.weeks.reduce((sum, w) => sum + w.items.length, 0);
		addRow(this.t.rowItems, String(itemCount));
		addRow(this.t.rowLanguage, this.t.langDisplay(mwb.lang));
	}

	onClose() {
		this.contentEl.empty();
	}
}
