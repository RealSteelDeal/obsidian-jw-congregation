import { App, Modal, Notice, Setting } from 'obsidian';
import { L, Strings } from '../i18n';
import type JwCongregationPlugin from '../main';
import { LegacyFieldCorrection } from '../util/legacyFieldPatch';

export interface LegacyMigrationCandidate {
	path: string;
	corrections: LegacyFieldCorrection[];
}

/**
 * Follow-up to JwCongregationPlugin.updateFile() for notes that predate the
 * %%jw:id%% marker mechanism (see util/legacyFieldPatch.ts) — shows exactly
 * which lines would change (old → new), one section per note, each with its
 * own toggle (default on). Nothing is written until "Apply" is clicked, and
 * even then only for notes whose toggle is still on — this is the per-note
 * confirmation step the plain heuristic in legacyFieldPatch.ts intentionally
 * doesn't perform on its own.
 */
export class LegacyMigrationModal extends Modal {
	private readonly included = new Map<string, boolean>();

	constructor(
		app: App,
		private readonly plugin: JwCongregationPlugin,
		private readonly candidates: LegacyMigrationCandidate[],
	) {
		super(app);
		for (const candidate of candidates) this.included.set(candidate.path, true);
	}

	private get t(): Strings {
		return L[this.plugin.settings.lang];
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.t.legacyModalTitle });
		contentEl.createEl('p', { text: this.t.legacyModalDesc, cls: 'setting-item-description' });

		for (const candidate of this.candidates) {
			const box = contentEl.createDiv('jw-import-preview');
			const name = candidate.path.split('/').pop() ?? candidate.path;
			box.createEl('h3', { text: name });

			for (const correction of candidate.corrections) {
				const row = box.createDiv('jw-legacy-correction');
				row.createDiv({ text: correction.oldLine, cls: 'jw-legacy-old' });
				row.createDiv({ text: correction.newLine, cls: 'jw-legacy-new' });
			}

			new Setting(box)
				.setName(this.t.btnApply)
				.addToggle(toggle =>
					toggle.setValue(true).onChange(value => this.included.set(candidate.path, value)),
				);
		}

		new Setting(contentEl)
			.addButton(btn =>
				btn
					.setButtonText(this.t.btnApply)
					.setCta()
					.onClick(() => void this.applySelected()),
			)
			.addButton(btn => btn.setButtonText(this.t.btnCancel).onClick(() => this.close()));
	}

	private async applySelected(): Promise<void> {
		this.close();
		let applied = 0;
		for (const candidate of this.candidates) {
			if (!this.included.get(candidate.path)) continue;
			const wrote = await this.plugin.applyLegacyNoteCorrections(candidate.path, candidate.corrections);
			if (wrote) applied++;
		}
		new Notice(this.t.noticeLegacyApplied(applied));
	}

	onClose() {
		this.contentEl.empty();
	}
}
