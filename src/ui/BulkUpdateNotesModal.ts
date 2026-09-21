import { App, Modal, Notice, Setting } from 'obsidian';
import { L, Strings } from '../i18n';
import type JwCongregationPlugin from '../main';
import type { CongressUpdateJob } from '../main';
import { SourceRouter } from '../parser/SourceRouter';
import { NoteBuilder } from '../builder/NoteBuilder';
import { Congress } from '../models/congress';
import { findFoldersByName, listAllFolders } from '../util/folderList';
import { ParseError } from '../util/parseErrors';
import { UpdatePreviewModal } from './UpdatePreviewModal';

/** One picked file and the folder it will be reconciled against. `congress` is
 *  null when the file could not be parsed at all — the row then only reports
 *  why, and is never part of the run. */
interface BulkRow {
	filename: string;
	congress: Congress | null;
	folder: string;
	error?: string;
}

/**
 * The bulk counterpart to UpdateNotesModal: picks SEVERAL programme files at
 * once and updates every already-imported congress folder in a single run
 * (see JwCongregationPlugin.updateFolders()), instead of walking through the
 * single-folder dialog once per convention after a parser fix ships.
 *
 * Each file is paired with a folder automatically, by the very name
 * NoteBuilder.congressFolderName() would generate for it — the same match
 * UpdateNotesModal already does to pre-select its dropdown, except it is
 * looked up by folder NAME anywhere in the vault rather than only at the
 * root, so a vault that keeps its conventions in a subfolder is matched too.
 * The pairing is only ever a proposal: every row keeps a full dropdown, and
 * "do not update" is always available, so nothing is written to a folder the
 * user did not confirm.
 */
export class BulkUpdateNotesModal extends Modal {
	private readonly rows: BulkRow[] = [];
	private listEl: HTMLElement | null = null;

	/** `mode` decides what the confirm button does with the pairings: write
	 *  them ('apply'), or compute what writing them would change and show that
	 *  first ('preview'). The picking and pairing above the button is
	 *  deliberately identical either way — the preview is the same run, not a
	 *  different one. */
	constructor(
		app: App,
		private readonly plugin: JwCongregationPlugin,
		private readonly mode: 'apply' | 'preview' = 'apply',
	) {
		super(app);
	}

	private get t(): Strings {
		return L[this.plugin.settings.lang];
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		const preview = this.mode === 'preview';
		contentEl.createEl('h2', { text: preview ? this.t.previewUpdateTitle : this.t.bulkUpdateTitle });
		contentEl.createEl('p', {
			text: preview ? this.t.previewUpdateExplanation : this.t.bulkUpdateExplanation,
			cls: 'setting-item-description',
		});

		new Setting(contentEl)
			.setName(this.t.bulkUpdatePickFiles)
			.setDesc(this.t.bulkUpdatePickFilesDesc)
			.addButton(btn =>
				btn.setButtonText(this.t.btnPickFiles).onClick(() => {
					const input = createEl('input', { type: 'file' });
					input.accept = '.jwpub,.zip,.rtf';
					input.multiple = true;
					input.onchange = async () => {
						const files = Array.from(input.files ?? []);
						if (files.length === 0) return;
						await this.loadFiles(files);
					};
					input.click();
				}),
			);

		this.listEl = contentEl.createDiv();

		new Setting(contentEl)
			.addButton(btn =>
				btn
					.setButtonText(preview ? this.t.btnShowChanges : this.t.btnUpdate)
					.setCta()
					.onClick(() => void this.run()),
			)
			.addButton(btn => btn.setButtonText(this.t.btnCancel).onClick(() => this.close()));
	}

	/** Parses the picked files one after another, rendering each row as soon as
	 *  its own file is done — a .jwpub has to be decrypted and opened as a
	 *  database, so with several files at once the wait is long enough that
	 *  showing progress row by row matters. */
	private async loadFiles(files: File[]): Promise<void> {
		this.rows.length = 0;
		this.listEl?.empty();

		const router = new SourceRouter(this.plugin.sqlWasmBinary);
		const folders = listAllFolders(this.app);
		// Only ever asked for congressFolderName(), which depends on the
		// programme itself (year/theme/type), not on any of these options.
		const builder = new NoteBuilder({
			scriptureLinks: true, reviewNote: true, showTagField: true, showTimeField: true,
			showScriptureField: true, showSpeakerField: true, extraFields: '', frontmatter: false,
		});

		for (const file of files) {
			const row: BulkRow = { filename: file.name, congress: null, folder: '' };
			try {
				const data = new Uint8Array(await file.arrayBuffer());
				const result = await router.route(file.name, data);
				row.congress = result.congress;
				const matches = findFoldersByName(this.app, builder.congressFolderName(result.congress));
				row.folder = matches[0]?.path ?? '';
			} catch (err) {
				row.error = this.t.bulkUpdateFileFailed(this.describeError(err));
			}
			this.rows.push(row);
			this.renderRow(row, folders.map(f => f.path));
		}
	}

	private renderRow(row: BulkRow, folderPaths: string[]) {
		if (!this.listEl) return;
		const setting = new Setting(this.listEl).setName(row.filename);

		if (row.error) {
			setting.setDesc(row.error);
			setting.settingEl.addClass('jw-bulk-row-failed');
			return;
		}
		if (row.folder === '') setting.setDesc(this.t.bulkUpdateNoMatch);

		setting.addDropdown(drop => {
			drop.addOption('', this.t.bulkUpdateSkip);
			for (const path of folderPaths) drop.addOption(path, path);
			drop.setValue(row.folder);
			drop.onChange(value => {
				row.folder = value;
				setting.setDesc(value === '' ? this.t.bulkUpdateSkip : value);
			});
		});
	}

	private async run(): Promise<void> {
		const jobs: CongressUpdateJob[] = [];
		const seen = new Set<string>();
		for (const row of this.rows) {
			if (!row.congress || row.folder === '') continue;
			// Two files writing into the same folder would make the second one
			// silently undo the first — refuse the whole run rather than pick
			// a winner on the user's behalf.
			if (seen.has(row.folder)) {
				new Notice(this.t.noticeBulkUpdateDuplicateFolder(row.folder));
				return;
			}
			seen.add(row.folder);
			jobs.push({ label: row.filename, folder: row.folder, congress: row.congress });
		}

		if (jobs.length === 0) {
			new Notice(this.t.noticeBulkUpdateNothingSelected);
			return;
		}

		this.close();
		if (this.mode === 'preview') {
			const previews = await this.plugin.previewFolders(jobs);
			new UpdatePreviewModal(this.app, this.plugin, jobs, previews).open();
			return;
		}
		await this.plugin.updateFolders(jobs);
	}

	private describeError(err: unknown): string {
		return err instanceof ParseError ? this.t.describeParseError(err.code, err.detail) : String(err);
	}

	onClose() {
		this.contentEl.empty();
	}
}
