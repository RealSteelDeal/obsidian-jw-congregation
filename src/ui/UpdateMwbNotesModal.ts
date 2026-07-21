import { App, Modal, Notice, Setting } from 'obsidian';
import { L, Strings } from '../i18n';
import type JwCongregationPlugin from '../main';
import { MwbSourceRouter } from '../parser/MwbSourceRouter';
import { MwbNoteBuilder } from '../builder/MwbNoteBuilder';
import { Mwb } from '../models/mwb';
import { listAllFolders } from '../util/folderList';

/** Mirrors UpdateNotesModal.ts exactly — the "update" counterpart to
 *  ImportMwbModal: picks the same workbook file again and patches an already
 *  imported issue folder in place via plugin.updateMwbFile(). No "create new
 *  folder" option, same as the congress version — updating only makes sense
 *  against a folder that already exists. */
export class UpdateMwbNotesModal extends Modal {
	private fileData: Uint8Array | null = null;
	private filename = '';
	private preview: Mwb | null = null;
	private previewEl: HTMLElement | null = null;
	private targetFolder = '';

	constructor(app: App, private readonly plugin: JwCongregationPlugin) {
		super(app);
	}

	private get t(): Strings {
		return L[this.plugin.settings.lang];
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.t.updateMwbTitle ?? '' });
		contentEl.createEl('p', { text: this.t.updateMwbExplanation ?? '', cls: 'setting-item-description' });

		let folderDropdown: HTMLSelectElement | undefined;

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
						await this.loadPreview(folderDropdown);
					};
					input.click();
				}),
			);

		const folders = listAllFolders(this.app);
		new Setting(contentEl)
			.setName(this.t.updateTargetFolder)
			.setDesc(this.t.updateTargetFolderDesc)
			.addDropdown(drop => {
				if (folders.length === 0) {
					drop.addOption('', this.t.updateNoFoldersFound);
					drop.setDisabled(true);
				} else {
					for (const folder of folders) {
						drop.addOption(folder.path, folder.path);
					}
					this.targetFolder = folders[0]!.path;
				}
				drop.onChange(value => {
					this.targetFolder = value;
				});
				folderDropdown = drop.selectEl;
			});

		this.previewEl = contentEl.createDiv('jw-import-preview');

		new Setting(contentEl)
			.addButton(btn =>
				btn
					.setButtonText(this.t.btnUpdate)
					.setCta()
					.onClick(async () => {
						if (!this.fileData) {
							new Notice(this.t.noticePickFileFirst);
							return;
						}
						if (!this.targetFolder) {
							new Notice(this.t.updateNoFoldersFound);
							return;
						}
						this.close();
						await this.plugin.updateMwbFile(this.filename, this.fileData, this.targetFolder);
					}),
			)
			.addButton(btn =>
				btn.setButtonText(this.t.btnCancel).onClick(() => this.close()),
			);
	}

	private async loadPreview(folderDropdown: HTMLSelectElement | undefined) {
		if (!this.fileData || !this.previewEl) return;
		this.previewEl.empty();

		try {
			const router = new MwbSourceRouter(this.plugin.sqlWasmBinary);
			const result = await router.route(this.filename, this.fileData);
			this.preview = result.mwb;
			this.renderPreview(result.mwb);

			// Best-effort auto-select, same rationale as UpdateNotesModal's own
			// congress-folder-name match: a re-parsed file produces the same
			// folder name as the original import (year/issue tag don't change
			// between plugin versions).
			const builder = new MwbNoteBuilder({
				scriptureLinks: true, showDurationField: true, showSourceCitationField: true, frontmatter: false,
			});
			const matchName = builder.issueFolderName(result.mwb);
			if (folderDropdown && Array.from(folderDropdown.options).some(o => o.value === matchName)) {
				folderDropdown.value = matchName;
				this.targetFolder = matchName;
			}
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
