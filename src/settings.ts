import { App, PluginSettingTab, Setting, SettingDefinitionItem } from 'obsidian';
import type JwCongregationPlugin from './main';
import { SupportedLang } from './normalizer/bookNames';
import { L, Strings } from './i18n';

export interface JwPluginSettings {
	targetFolder: string;
	lang: SupportedLang;
	scriptureLinks: boolean;
	reviewNote: boolean;
	showTagField: boolean;
	showTimeField: boolean;
	showScriptureField: boolean;
	showSpeakerField: boolean;
	extraFields: string;
	/** Opt-in: prepend YAML frontmatter (stable English keys — convention/type/
	 *  day/time — regardless of note language, so Dataview queries work across
	 *  mixed-language vaults) to every generated note. Off by default: the
	 *  notes are deliberately frontmatter-free otherwise. */
	frontmatter: boolean;
	bibleFileLoaded: boolean;
	/** Plugin version at the time of the last load — used to show a one-time
	 *  "re-import to pick up note-template improvements" notice after updates
	 *  (imported notes with writing space are never auto-updated, so template
	 *  changes don't reach existing congress folders on their own). Not a user
	 *  setting; intentionally has no settings-tab UI. */
	lastVersion: string;
	/** Number of scripture-link clicks made WITHOUT a Bible file loaded — used
	 *  to occasionally surface the "add a Bible file for the in-app popup" hint
	 *  (first three clicks, then every 20th). No settings-tab UI. */
	bibleHintClickCount: number;
}

export const DEFAULT_SETTINGS: JwPluginSettings = {
	targetFolder: '', // '' = vault root; each import creates its own top-level congress folder
	lang: 'de',
	scriptureLinks: true,
	reviewNote: true,
	showTagField: true,
	showTimeField: true,
	showScriptureField: true,
	showSpeakerField: true,
	extraFields: '',
	frontmatter: false,
	bibleFileLoaded: false,
	lastVersion: '',
	bibleHintClickCount: 0,
};

// Declarative settings only (minAppVersion is 1.13.0, where the declarative
// API including getSettingDefinitions()/setControlValue() is always present) —
// the imperative display() fallback for older Obsidian versions was removed
// together with the minAppVersion bump. getControlValue()/setControlValue()
// keep their PluginSettingTab defaults (read/write this.plugin.settings),
// which match our settings shape; setControlValue is only overridden to
// re-render the language-dependent tab after a language switch.
export class JwSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: JwCongregationPlugin) {
		super(app, plugin);
	}

	private get t(): Strings {
		return L[this.plugin.settings.lang];
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const t = this.t;
		return [
			{
				name: t.setTargetFolder,
				desc: t.setTargetFolderDesc,
				control: { type: 'text', key: 'targetFolder', placeholder: t.setTargetFolderPlaceholder },
			},
			{
				name: t.setLang,
				desc: t.setLangDesc,
				control: { type: 'dropdown', key: 'lang', options: { de: 'Deutsch', en: 'English' } },
			},
			{
				name: t.setScriptureLinks,
				desc: t.setScriptureLinksDesc,
				control: { type: 'toggle', key: 'scriptureLinks' },
			},
			{
				name: t.setReviewNote,
				desc: t.setReviewNoteDesc,
				control: { type: 'toggle', key: 'reviewNote' },
			},
			{
				type: 'group',
				heading: t.headNoteFields,
				items: [
					{
						name: t.setShowDay,
						desc: t.setShowDayDesc,
						control: { type: 'toggle', key: 'showTagField' },
					},
					{ name: t.setShowTime, control: { type: 'toggle', key: 'showTimeField' } },
					{ name: t.setShowScriptures, control: { type: 'toggle', key: 'showScriptureField' } },
					{ name: t.setShowSpeaker, control: { type: 'toggle', key: 'showSpeakerField' } },
					{
						name: t.setExtraFields,
						desc: t.setExtraFieldsDesc,
						control: { type: 'textarea', key: 'extraFields', placeholder: '**Notizen:**' },
					},
					{
						name: t.setFrontmatter,
						desc: t.setFrontmatterDesc,
						control: { type: 'toggle', key: 'frontmatter' },
					},
				],
			},
			{
				type: 'group',
				heading: t.headPopup,
				items: [
					{
						name: t.setBibleFile,
						desc: this.plugin.settings.bibleFileLoaded ? t.bibleDescLoaded : t.bibleDescMissing,
						render: setting => this.renderBibleFileSetting(setting),
					},
				],
			},
		];
	}

	// The whole tab is language-dependent — re-render it right after the user
	// switches the language so the change is visible immediately, not only on
	// the next opening of the settings.
	async setControlValue(key: string, value: unknown): Promise<void> {
		await super.setControlValue(key, value);
		if (key === 'lang') this.update();
	}

	// The declarative "render" escape hatch: a file-upload button plus a
	// conditional delete button has no direct declarative equivalent.
	private renderBibleFileSetting(setting: Setting): void {
		const t = this.t;
		setting
			.addButton(btn =>
				btn.setButtonText(this.plugin.settings.bibleFileLoaded ? t.btnReplaceFile : t.btnChooseFile).onClick(() => {
					const input = createEl('input', { type: 'file' });
					input.accept = '.jwpub';
					input.onchange = async () => {
						const file = input.files?.[0];
						if (!file) return;
						await this.plugin.setBibleFile(new Uint8Array(await file.arrayBuffer()));
						this.update();
					};
					input.click();
				}),
			)
			.addExtraButton(btn => {
				btn.setIcon('trash').setTooltip(t.btnRemoveBible).onClick(async () => {
					await this.plugin.removeBibleFile();
					this.update();
				});
				btn.extraSettingsEl.toggle(this.plugin.settings.bibleFileLoaded);
			});
	}
}
