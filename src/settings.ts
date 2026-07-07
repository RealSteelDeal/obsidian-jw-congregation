import { App, PluginSettingTab, Setting } from 'obsidian';
import type JwCongregationPlugin from './main';
import { SupportedLang } from './normalizer/bookNames';

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
	bibleFileLoaded: boolean;
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
	bibleFileLoaded: false,
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
			.setDesc('Übergeordneter Ordner, in dem der Kongressordner angelegt wird. Leer lassen, damit jeder Kongress direkt als eigener Ordner in der Vault-Wurzel entsteht (kein zusätzlicher Wrapper-Ordner).')
			.addText(text =>
				text
					.setPlaceholder('(Vault-Wurzel)')
					.setValue(this.plugin.settings.targetFolder)
					.onChange(async value => {
						this.plugin.settings.targetFolder = value.trim();
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

		new Setting(containerEl)
			.setName('Wiederholungs-Notiz erstellen')
			.setDesc('Legt zusätzlich eine "Wiederholung"-Notiz mit den drei Standard-Reflexionsfragen an (bei Kreiskongressen mit Link zu den gedruckten Wiederholungsfragen, bei Regionalen Kongressen mit Hinweis auf das Video).')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.reviewNote)
					.onChange(async value => {
						this.plugin.settings.reviewNote = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName('Notiz-Felder').setHeading();

		new Setting(containerEl)
			.setName('Feld "Tag" anzeigen')
			.setDesc('Nur bei Regionalen Kongressen relevant (Kreiskongresse sind eintägig).')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.showTagField)
					.onChange(async value => {
						this.plugin.settings.showTagField = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Feld "Uhrzeit" anzeigen')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.showTimeField)
					.onChange(async value => {
						this.plugin.settings.showTimeField = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Feld "Bibeltexte" anzeigen')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.showScriptureField)
					.onChange(async value => {
						this.plugin.settings.showScriptureField = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Feld "Redner" anzeigen')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.showSpeakerField)
					.onChange(async value => {
						this.plugin.settings.showSpeakerField = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Zusätzliche Felder')
			.setDesc('Jede Zeile wird als eigenes Feld mit eigenem Schreibplatz an jede Programmpunkt-Notiz angehängt (z. B. "**Notizen:**").')
			.addTextArea(text =>
				text
					.setPlaceholder('**Notizen:**')
					.setValue(this.plugin.settings.extraFields)
					.onChange(async value => {
						this.plugin.settings.extraFields = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName('Bibeltext-Popup').setHeading();

		const bibleDesc = this.plugin.settings.bibleFileLoaded
			? 'Bibel-Datei ist geladen. Ein Klick auf eine Bibelstelle zeigt den Vers-Text direkt in Obsidian an (mit einem Button zum Öffnen in JW Library).'
			: 'Optional: eine Bibel-jwpub-Datei auswählen (z. B. von jw.org heruntergeladen), damit ein Klick auf eine Bibelstelle den Vers-Text direkt in Obsidian anzeigt, statt nur JW Library zu öffnen. Empfehlung: die Studienbibel (nwtsty) statt der einfachen Ausgabe (nwt) – sie enthält zusätzliche Studienanmerkungen und mehr Fußnoten. Die Datei wird lokal im Plugin-Ordner gespeichert, nicht ins Vault kopiert.';

		new Setting(containerEl)
			.setName('Bibel-Datei')
			.setDesc(bibleDesc)
			.addButton(btn =>
				btn.setButtonText(this.plugin.settings.bibleFileLoaded ? 'Datei ersetzen …' : 'Datei wählen …').onClick(() => {
					const input = createEl('input', { type: 'file' });
					input.accept = '.jwpub';
					input.onchange = async () => {
						const file = input.files?.[0];
						if (!file) return;
						await this.plugin.setBibleFile(new Uint8Array(await file.arrayBuffer()));
						this.display();
					};
					input.click();
				}),
			)
			.addExtraButton(btn => {
				btn.setIcon('trash').setTooltip('Bibel-Datei entfernen').onClick(async () => {
					await this.plugin.removeBibleFile();
					this.display();
				});
				btn.extraSettingsEl.toggle(this.plugin.settings.bibleFileLoaded);
			});
	}
}
