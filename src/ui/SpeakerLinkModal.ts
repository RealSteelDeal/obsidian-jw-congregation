import { App, Modal, Notice, Setting } from 'obsidian';
import { L, Strings } from '../i18n';
import type JwCongregationPlugin from '../main';
import { SpeakerGroup } from '../util/speakerNames';

/**
 * The review step of the one-off speaker migration: turns hand-typed names
 * in the Speaker field into wiki links pointing at one agreed spelling.
 *
 * Everything here is a proposal. groupSpeakerVariants() only sorts the
 * spellings found into likely groups (see its doc comment for why it refuses
 * to guess at an ambiguous one); which name the group is filed under is a
 * decision, and decisions belong to the user — hence the editable name per
 * group and the toggle beside it. Nothing is written until "Apply".
 *
 * What gets written keeps the original wording visible
 * (`[[Hannes Sieberer|Br. Sieberer]]`), so the migration changes not one
 * character the reader sees — only what Obsidian resolves underneath. That
 * is deliberate: this touches text the user typed by hand, where the
 * project's standing rule is to preserve rather than tidy.
 */
export class SpeakerLinkModal extends Modal {
	/** Group index → the name it will be filed under, as edited. */
	private readonly targets = new Map<number, string>();
	private readonly included = new Map<number, boolean>();

	constructor(
		app: App,
		private readonly plugin: JwCongregationPlugin,
		private readonly groups: SpeakerGroup[],
	) {
		super(app);
		groups.forEach((group, index) => {
			this.targets.set(index, group.suggested);
			// An ambiguous shortening starts switched off: the plugin could not
			// tell who it is, so the user has to say so on purpose.
			this.included.set(index, !group.ambiguous);
		});
	}

	private get t(): Strings {
		return L[this.plugin.settings.lang];
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.t.speakerLinkTitle });
		contentEl.createEl('p', { text: this.t.speakerLinkDesc, cls: 'setting-item-description' });

		this.groups.forEach((group, index) => {
			const box = contentEl.createDiv('jw-import-preview');
			box.createEl('h3', { text: group.suggested });

			if (group.ambiguous) {
				box.createEl('p', { text: this.t.speakerLinkAmbiguous, cls: 'jw-preview-error' });
			}
			box.createEl('p', {
				text: this.t.speakerLinkFound(group.variants.join(' · '), group.occurrences.length),
				cls: 'setting-item-description',
			});

			new Setting(box)
				.setName(this.t.speakerLinkTarget)
				.setDesc(this.t.speakerLinkTargetDesc)
				.addText(text =>
					text.setValue(group.suggested).onChange(value => this.targets.set(index, value.trim())),
				);

			new Setting(box)
				.setName(this.t.speakerLinkConvert)
				.addToggle(toggle =>
					toggle.setValue(!group.ambiguous).onChange(value => this.included.set(index, value)),
				);
		});

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
		const selected = this.groups
			.map((group, index) => ({ group, target: this.targets.get(index) ?? '' }))
			.filter((_, index) => this.included.get(index) === true)
			.filter(entry => entry.target.length > 0);

		if (selected.length === 0) {
			new Notice(this.t.noticeSpeakerLinkNothingSelected);
			return;
		}
		this.close();
		await this.plugin.applySpeakerLinks(selected);
	}

	onClose() {
		this.contentEl.empty();
	}
}
