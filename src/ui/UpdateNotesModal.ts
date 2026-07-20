import { App, Modal, Notice, Setting, TFolder } from 'obsidian';
import { L, Strings } from '../i18n';
import type JwCongregationPlugin from '../main';
import { SourceRouter } from '../parser/SourceRouter';
import { NoteBuilder } from '../builder/NoteBuilder';
import { Congress } from '../models/congress';

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

/**
 * The "update" counterpart to ImportModal: picks the SAME programme file
 * again (e.g. after a plugin update that fixed a parser bug) and patches an
 * ALREADY imported congress folder in place — see JwCongregationPlugin.updateFile()
 * and util/noteMerge.ts for how already-existing notes are preserved. Unlike
 * ImportModal, there is no "create new folder" option: updating only makes
 * sense against a folder that already exists, so the dropdown lists existing
 * folders only, pre-selecting one whose name matches the parsed file's own
 * congress-folder name when found.
 */
export class UpdateNotesModal extends Modal {
	private fileData: Uint8Array | null = null;
	private filename = '';
	private preview: Congress | null = null;
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
		contentEl.createEl('h2', { text: this.t.updateTitle });
		contentEl.createEl('p', { text: this.t.updateExplanation, cls: 'setting-item-description' });

		let folderDropdown: HTMLSelectElement | undefined;

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
						await this.plugin.updateFile(this.filename, this.fileData, this.targetFolder);
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
			const router = new SourceRouter(this.plugin.sqlWasmBinary);
			const result = await router.route(this.filename, this.fileData);
			this.preview = result.congress;
			this.renderPreview(result.congress, result.source);

			// Best-effort auto-select: a freshly re-parsed file almost always
			// produces the exact same folder name as when it was first
			// imported (theme/year/type are the only inputs, and those don't
			// change between plugin versions) — pre-selecting it saves a
			// manual pick in the common case without hiding the dropdown.
			const builder = new NoteBuilder({
				scriptureLinks: true, reviewNote: true, showTagField: true, showTimeField: true,
				showScriptureField: true, showSpeakerField: true, extraFields: '', frontmatter: false,
			});
			const matchName = builder.congressFolderName(result.congress);
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
