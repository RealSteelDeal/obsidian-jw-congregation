import { App, PluginSettingTab, requireApiVersion, Setting, SettingDefinitionItem } from 'obsidian';
import type JwCongregationPlugin from './main';
import { SupportedLang } from './normalizer/bookNames';
import { L, Strings } from './i18n';

/** The four things the in-editor scripture suggester (ScriptureEditorSuggest)
 *  can do with a typed reference — see its own doc comment for what each does. */
export type ScriptureSuggestAction = 'link' | 'link-open' | 'quote' | 'quote-keep-link';

export interface ScriptureSuggestActionConfig {
	action: ScriptureSuggestAction;
	enabled: boolean;
}

// Array order = the order suggestions are shown in; `enabled: false` hides an
// action without losing its position, so re-enabling it later restores where
// it was. Every one of the 4 actions is always represented here — the
// settings UI only ever reorders/toggles this same fixed set.
export const DEFAULT_SCRIPTURE_SUGGEST_ACTIONS: ScriptureSuggestActionConfig[] = [
	{ action: 'link', enabled: true },
	{ action: 'link-open', enabled: true },
	{ action: 'quote', enabled: true },
	{ action: 'quote-keep-link', enabled: true },
];

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
	/** Whether clicking/tapping a scripture opens the in-app popup at all —
	 *  independent of whether a Bible file is loaded, so the popup can be
	 *  switched off temporarily without removing the (potentially large) file. */
	bibleFilePopupEnabled: boolean;
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
	/** Which of the 4 in-editor scripture-suggester actions (see
	 *  ScriptureEditorSuggest) are offered, and in what order — user-configurable
	 *  in the settings tab. Always holds all 4 entries; disabled ones just aren't
	 *  shown. Deep-copy this (never reuse DEFAULT_SCRIPTURE_SUGGEST_ACTIONS
	 *  directly) — the settings UI reorders/toggles it in place. */
	scriptureSuggestActions: ScriptureSuggestActionConfig[];
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
	bibleFilePopupEnabled: true,
	lastVersion: '',
	bibleHintClickCount: 0,
	scriptureSuggestActions: DEFAULT_SCRIPTURE_SUGGEST_ACTIONS,
};

export class JwSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: JwCongregationPlugin) {
		super(app, plugin);
	}

	private get t(): Strings {
		return L[this.plugin.settings.lang];
	}

	// Declarative settings (Obsidian ≥ 1.13.0) — makes every setting below
	// searchable from the app-wide settings search. getControlValue()/
	// setControlValue() are left at their PluginSettingTab default (read/write
	// this.plugin.settings directly), which matches our settings shape.
	// display() below is the fallback for Obsidian < 1.13.0 — REQUIRED, not
	// legacy decoration: raising minAppVersion to 1.13 was tried once and
	// immediately produced an empty settings tab on a real 1.12.7 install
	// (Obsidian 1.13 is not broadly deployed yet). The base class only calls
	// display() when getSettingDefinitions() isn't supported, so both paths
	// never run at once; keep the two in sync when changing a setting.
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
				// Everything to do with scriptures — linking, the click/tap popup and
				// the as-you-type suggester — grouped under one heading since they're
				// all facets of the same underlying feature area.
				type: 'group',
				heading: t.headScripture,
				items: [
					{
						name: t.setScriptureLinks,
						desc: t.setScriptureLinksDesc,
						control: { type: 'toggle', key: 'scriptureLinks' },
					},
					{
						name: t.setBiblePopupEnabled,
						desc: t.setBiblePopupEnabledDesc,
						control: { type: 'toggle', key: 'bibleFilePopupEnabled' },
					},
					{
						name: t.setBibleFile,
						desc: this.plugin.settings.bibleFileLoaded ? t.bibleDescLoaded : t.bibleDescMissing,
						// this.update() is only ever reachable here on Obsidian ≥ 1.13.0 (only
						// such versions call getSettingDefinitions()/render() in the first
						// place), but the requireApiVersion() guard is still needed to satisfy
						// static minAppVersion checks against this newer API.
						render: setting => this.renderBibleFileSetting(setting, () => {
							if (requireApiVersion('1.13.0')) this.update();
						}),
					},
					{
						name: t.headScriptureSuggest,
						desc: t.headScriptureSuggestDesc,
						searchable: false,
					},
					// Built from the CURRENT (possibly just-reordered) settings array on
					// every call — reordering calls this.update(), which re-invokes
					// getSettingDefinitions() and so rebuilds this list in the new order.
					...this.plugin.settings.scriptureSuggestActions.map((config, index) => ({
						name: this.actionLabel(config.action),
						render: (setting: Setting) => this.renderActionRow(setting, config, index, () => {
							if (requireApiVersion('1.13.0')) this.update();
						}),
					})),
				],
			},
		];
	}

	private actionLabel(action: ScriptureSuggestAction): string {
		const t = this.t;
		const labels: Record<ScriptureSuggestAction, string> = {
			'link': t.scriptureSuggestLink,
			'link-open': t.scriptureSuggestLinkAndOpen,
			'quote': t.btnInsertAsQuote,
			'quote-keep-link': t.scriptureSuggestQuoteKeepLink,
		};
		return labels[action];
	}

	// One row of the scripture-suggester action list: an enable/disable toggle
	// plus up/down reorder buttons that swap this entry with its neighbour in
	// settings.scriptureSuggestActions (array order = suggestion order, see
	// ScriptureEditorSuggest.getSuggestions()). Shared between the declarative
	// "render" escape hatch above and the display() fallback below.
	private renderActionRow(setting: Setting, config: ScriptureSuggestActionConfig, index: number, refresh: () => void): void {
		const t = this.t;
		const actions = this.plugin.settings.scriptureSuggestActions;
		setting
			.addExtraButton(btn => {
				btn.setIcon('arrow-up').setTooltip(t.btnMoveUp).onClick(async () => {
					if (index === 0) return;
					[actions[index - 1], actions[index]] = [actions[index]!, actions[index - 1]!];
					await this.plugin.saveSettings();
					refresh();
				});
				btn.setDisabled(index === 0);
			})
			.addExtraButton(btn => {
				btn.setIcon('arrow-down').setTooltip(t.btnMoveDown).onClick(async () => {
					if (index === actions.length - 1) return;
					[actions[index], actions[index + 1]] = [actions[index + 1]!, actions[index]!];
					await this.plugin.saveSettings();
					refresh();
				});
				btn.setDisabled(index === actions.length - 1);
			})
			.addToggle(toggle =>
				toggle.setValue(config.enabled).onChange(async value => {
					config.enabled = value;
					await this.plugin.saveSettings();
				}),
			);
	}

	// The whole tab is language-dependent — re-render it right after the user
	// switches the language so the change is visible immediately, not only on
	// the next opening of the settings. Obsidian only ever calls
	// setControlValue on ≥ 1.13.0 (the declarative-settings API that includes
	// it), so the guard can never actually fail — it exists to satisfy the
	// static minAppVersion check.
	async setControlValue(key: string, value: unknown): Promise<void> {
		if (requireApiVersion('1.13.0')) {
			await super.setControlValue(key, value);
			if (key === 'lang') this.update();
		}
	}

	// Shared between the declarative "render" escape hatch (above — a
	// file-upload button plus a conditional delete button has no direct
	// declarative equivalent) and the display() fallback below. `refresh`
	// re-renders the tab afterwards — this.update() under the declarative
	// path, this.display() under the imperative fallback; only one of the two
	// rendering paths is ever active for a given Obsidian version.
	private renderBibleFileSetting(setting: Setting, refresh: () => void): void {
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
						refresh();
					};
					input.click();
				}),
			)
			.addExtraButton(btn => {
				btn.setIcon('trash').setTooltip(t.btnRemoveBible).onClick(async () => {
					await this.plugin.removeBibleFile();
					refresh();
				});
				btn.extraSettingsEl.toggle(this.plugin.settings.bibleFileLoaded);
			});
	}

	display(): void {
		const { containerEl } = this;
		const t = this.t;
		containerEl.empty();

		new Setting(containerEl)
			.setName(t.setTargetFolder)
			.setDesc(t.setTargetFolderDesc)
			.addText(text =>
				text
					.setPlaceholder(t.setTargetFolderPlaceholder)
					.setValue(this.plugin.settings.targetFolder)
					.onChange(async value => {
						this.plugin.settings.targetFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t.setLang)
			.setDesc(t.setLangDesc)
			.addDropdown(drop =>
				drop
					.addOption('de', 'Deutsch')
					.addOption('en', 'English')
					.setValue(this.plugin.settings.lang)
					.onChange(async (value: string) => {
						this.plugin.settings.lang = value as SupportedLang;
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		new Setting(containerEl)
			.setName(t.setReviewNote)
			.setDesc(t.setReviewNoteDesc)
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.reviewNote)
					.onChange(async value => {
						this.plugin.settings.reviewNote = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName(t.headNoteFields).setHeading();

		new Setting(containerEl)
			.setName(t.setShowDay)
			.setDesc(t.setShowDayDesc)
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.showTagField)
					.onChange(async value => {
						this.plugin.settings.showTagField = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t.setShowTime)
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.showTimeField)
					.onChange(async value => {
						this.plugin.settings.showTimeField = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t.setShowScriptures)
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.showScriptureField)
					.onChange(async value => {
						this.plugin.settings.showScriptureField = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t.setShowSpeaker)
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.showSpeakerField)
					.onChange(async value => {
						this.plugin.settings.showSpeakerField = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t.setExtraFields)
			.setDesc(t.setExtraFieldsDesc)
			.addTextArea(text =>
				text
					.setPlaceholder('**Notizen:**')
					.setValue(this.plugin.settings.extraFields)
					.onChange(async value => {
						this.plugin.settings.extraFields = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t.setFrontmatter)
			.setDesc(t.setFrontmatterDesc)
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.frontmatter)
					.onChange(async value => {
						this.plugin.settings.frontmatter = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName(t.headScripture).setHeading();

		new Setting(containerEl)
			.setName(t.setScriptureLinks)
			.setDesc(t.setScriptureLinksDesc)
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.scriptureLinks)
					.onChange(async value => {
						this.plugin.settings.scriptureLinks = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t.setBiblePopupEnabled)
			.setDesc(t.setBiblePopupEnabledDesc)
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.bibleFilePopupEnabled)
					.onChange(async value => {
						this.plugin.settings.bibleFilePopupEnabled = value;
						await this.plugin.saveSettings();
					}),
			);

		const bibleFileSetting = new Setting(containerEl)
			.setName(t.setBibleFile)
			.setDesc(this.plugin.settings.bibleFileLoaded ? t.bibleDescLoaded : t.bibleDescMissing);
		// This whole method only runs on Obsidian < 1.13.0 (see class-level comment
		// above), where display() is the only way to refresh the tab — the resulting
		// "display is deprecated" lint warning below is the documented fallback
		// pattern, not leftover use of the old API.
		this.renderBibleFileSetting(bibleFileSetting, () => this.display());

		new Setting(containerEl).setName(t.headScriptureSuggest).setDesc(t.headScriptureSuggestDesc);
		this.plugin.settings.scriptureSuggestActions.forEach((config, index) => {
			const row = new Setting(containerEl).setName(this.actionLabel(config.action));
			this.renderActionRow(row, config, index, () => this.display());
		});
	}
}
