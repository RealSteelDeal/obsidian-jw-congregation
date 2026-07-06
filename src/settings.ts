import { App, PluginSettingTab, Setting } from 'obsidian';
import type JwCongregationPlugin from './main';
import { SupportedLang } from './normalizer/bookNames';

export interface JwPluginSettings {
	targetFolder: string;
	lang: SupportedLang;
	scriptureLinks: boolean;
}

export const DEFAULT_SETTINGS: JwPluginSettings = {
	targetFolder: 'Kongress',
	lang: 'de',
	scriptureLinks: true,
};

export class JwSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: JwCongregationPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Zielordner')
			.setDesc('Ordner im Vault, in dem die Notizen abgelegt werden.')
			.addText(text =>
				text
					.setPlaceholder('Kongress')
					.setValue(this.plugin.settings.targetFolder)
					.onChange(async value => {
						this.plugin.settings.targetFolder = value.trim() || 'Kongress';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Sprache der Bibelbuch-Namen')
			.addDropdown(drop =>
				drop
					.addOption('de', 'Deutsch')
					.addOption('en', 'English')
					.setValue(this.plugin.settings.lang)
					.onChange(async (value: string) => {
						this.plugin.settings.lang = value as SupportedLang;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Bibelstellen verlinken')
			.setDesc('Erzeugt klickbare JW-Library-Links auf jede Bibelstelle.')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.scriptureLinks)
					.onChange(async value => {
						this.plugin.settings.scriptureLinks = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
