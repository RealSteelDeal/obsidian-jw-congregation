import { App, Modal, Setting } from 'obsidian';
import { L, Strings } from '../i18n';
import type JwCongregationPlugin from '../main';
import type { CongressPreview, CongressUpdateJob, PlannedNote } from '../main';

/**
 * Shows what "update convention notes" would change, before anything is
 * written — the regular, marker-based merge's counterpart to
 * LegacyMigrationModal, which has always done this for pre-1.9.0 notes.
 *
 * Until this existed the safer path was the silent one: the heuristic that
 * guesses at marker-free notes asked for confirmation, while the exact
 * marker merge just wrote. That is right by risk and backwards by insight —
 * after a plugin update you could not tell whether your notes were affected
 * without opening them, and a bulk run multiplies that by the number of
 * conventions.
 *
 * What it shows comes from JwCongregationPlugin.planCongressUpdate(), the
 * very same plan the write itself carries out, so the preview cannot drift
 * from what happens. Confirming re-plans from scratch through
 * updateFolders() rather than writing the plan shown here: a note may have
 * been edited between looking and deciding.
 */
export class UpdatePreviewModal extends Modal {
	constructor(
		app: App,
		private readonly plugin: JwCongregationPlugin,
		private readonly jobs: CongressUpdateJob[],
		private readonly previews: CongressPreview[],
	) {
		super(app);
	}

	private get t(): Strings {
		return L[this.plugin.settings.lang];
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.t.previewUpdateTitle });

		let anythingToDo = false;
		for (const preview of this.previews) {
			if (this.renderPreview(preview)) anythingToDo = true;
		}
		if (!anythingToDo) {
			contentEl.createEl('p', { text: this.t.previewNoChanges, cls: 'setting-item-description' });
		}

		const buttons = new Setting(contentEl);
		if (anythingToDo) {
			buttons.addButton(btn =>
				btn
					.setButtonText(this.t.btnUpdate)
					.setCta()
					.onClick(() => void this.apply()),
			);
		}
		buttons.addButton(btn => btn.setButtonText(this.t.btnCancel).onClick(() => this.close()));
	}

	/** Renders one convention; returns whether it would actually do anything. */
	private renderPreview(preview: CongressPreview): boolean {
		const box = this.contentEl.createDiv('jw-import-preview');
		// The folder, not the file: that is what is about to be written to.
		box.createEl('h3', { text: preview.folder });

		if (!preview.plan) {
			box.createEl('p', { text: preview.error ?? '', cls: 'jw-preview-error' });
			return false;
		}

		const changed = preview.plan.notes.filter(isChanged);
		const created = preview.plan.notes.filter(note => note.kind === 'create');
		const needsReimport = preview.plan.notes.filter(note => note.kind === 'needs-reimport');
		const unchanged = preview.plan.notes.length - changed.length - created.length - needsReimport.length;

		const newAttachments = preview.plan.attachments.filter(a => a.kind === 'create');
		const changedAttachments = preview.plan.attachments.filter(a => a.kind === 'regenerate');

		box.createEl('p', {
			text: this.t.previewSummary(
				changed.length + changedAttachments.length,
				created.length + newAttachments.length,
				unchanged,
				needsReimport.length,
			),
			cls: 'setting-item-description',
		});

		if (changed.length > 0 || changedAttachments.length > 0) {
			box.createEl('h4', { text: this.t.previewSectionChanged });
			for (const note of changed) this.renderChangedNote(box, note);
			for (const attachment of changedAttachments) {
				box.createEl('p', { text: fileName(attachment.path), cls: 'jw-preview-note-name' });
				box.createEl('p', { text: this.t.previewRegenerated, cls: 'setting-item-description' });
			}
		}

		if (created.length > 0 || newAttachments.length > 0) {
			box.createEl('h4', { text: this.t.previewSectionCreated });
			const list = box.createEl('ul');
			for (const note of created) list.createEl('li', { text: fileName(note.path) });
			for (const attachment of newAttachments) list.createEl('li', { text: fileName(attachment.path) });
		}

		if (needsReimport.length > 0) {
			box.createEl('h4', { text: this.t.previewSectionNeedsReimport });
			const list = box.createEl('ul');
			for (const note of needsReimport) list.createEl('li', { text: fileName(note.path) });
		}

		return changed.length > 0 || created.length > 0
			|| changedAttachments.length > 0 || newAttachments.length > 0;
	}

	private renderChangedNote(box: HTMLElement, note: PlannedNote) {
		box.createEl('p', { text: fileName(note.path), cls: 'jw-preview-note-name' });

		if (note.kind === 'regenerate') {
			box.createEl('p', { text: this.t.previewRegenerated, cls: 'setting-item-description' });
			return;
		}
		if (note.kind !== 'merge') return;
		if (note.changes.length === 0) {
			// A 1.9.0–1.18.0 note whose %%jw:…%% markers are being upgraded to
			// spans: the file changes, the visible text does not. Saying so is
			// better than listing the note with nothing under it.
			box.createEl('p', { text: this.t.previewMarkerOnly, cls: 'setting-item-description' });
			return;
		}
		for (const change of note.changes) {
			const row = box.createDiv('jw-legacy-correction');
			row.createDiv({ text: change.before, cls: 'jw-legacy-old' });
			row.createDiv({ text: change.after, cls: 'jw-legacy-new' });
		}
	}

	private async apply(): Promise<void> {
		this.close();
		await this.plugin.updateFolders(this.jobs);
	}

	onClose() {
		this.contentEl.empty();
	}
}

/** A note the update would actually rewrite — a merge, or a derived file that
 *  is regenerated and really differs. A regenerate whose fresh content equals
 *  what is already on disk is still written (unchanged behavior), but there is
 *  nothing to show the user about it. */
function isChanged(note: PlannedNote): boolean {
	return note.kind === 'merge' || (note.kind === 'regenerate' && note.changed);
}

function fileName(path: string): string {
	return path.split('/').pop() ?? path;
}
