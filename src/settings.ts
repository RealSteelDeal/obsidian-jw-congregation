import { App, PluginSettingTab, requireApiVersion, Setting, SettingDefinitionItem } from 'obsidian';
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
	/** Plugin version at the time of the last load — used to show a one-time
	 *  "re-import to pick up note-template improvements" notice after updates
	 *  (imported notes with writing space are never auto-updated, so template
	 *  changes don't reach existing congress folders on their own). Not a user
	 *  setting; intentionally has no settings-tab UI. */
	lastVersion: string;
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
	lastVersion: '',
};

export class JwSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: JwCongregationPlugin) {
		super(app, plugin);
	}

	// Declarative settings (Obsidian ≥ 1.13.0) — makes every setting below searchable
	// from the app-wide settings search. getControlValue()/setControlValue() are left
	// at their PluginSettingTab default (read/write this.plugin.settings directly),
	// which already matches our settings shape. display() below is kept as the
	// fallback for Obsidian < 1.13.0 (minAppVersion is 1.6.6) — the base class only
	// calls it when getSettingDefinitions() isn't present at all, so both paths never
	// run at once; keep the two in sync when changing a setting.
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Zielordner',
				desc: 'Übergeordneter Ordner, in dem der Kongressordner angelegt wird. Leer lassen, damit jeder Kongress direkt als eigener Ordner in der Vault-Wurzel entsteht (kein zusätzlicher Wrapper-Ordner).',
				control: { type: 'text', key: 'targetFolder', placeholder: '(Vault-Wurzel)' },
			},
			{
				name: 'Sprache des Bibeltext-Popups',
				desc: 'Bibelbuch-Namen und Beschriftungen im Popup. Notizen folgen automatisch der Sprache der importierten Programmdatei.',
				control: { type: 'dropdown', key: 'lang', options: { de: 'Deutsch', en: 'English' } },
			},
			{
				name: 'Bibelstellen verlinken',
				desc: 'Erzeugt klickbare JW-Library-Links auf jede Bibelstelle.',
				control: { type: 'toggle', key: 'scriptureLinks' },
			},
			{
				name: 'Wiederholungs-Notiz erstellen',
				desc: 'Legt zusätzlich eine "Wiederholung"-Notiz mit den drei Standard-Reflexionsfragen an (bei Kreiskongressen mit Link zu den gedruckten Wiederholungsfragen, bei Regionalen Kongressen mit Hinweis auf das Video).',
				control: { type: 'toggle', key: 'reviewNote' },
			},
			{
				type: 'group',
				heading: 'Notiz-Felder',
				items: [
					{
						name: 'Feld "Tag" anzeigen',
						desc: 'Nur bei Regionalen Kongressen relevant (Kreiskongresse sind eintägig).',
						control: { type: 'toggle', key: 'showTagField' },
					},
					{ name: 'Feld "Uhrzeit" anzeigen', control: { type: 'toggle', key: 'showTimeField' } },
					{ name: 'Feld "Bibeltexte" anzeigen', control: { type: 'toggle', key: 'showScriptureField' } },
					{ name: 'Feld "Redner" anzeigen', control: { type: 'toggle', key: 'showSpeakerField' } },
					{
						name: 'Zusätzliche Felder',
						desc: 'Jede Zeile wird als eigenes Feld mit eigenem Schreibplatz an jede Programmpunkt-Notiz angehängt (z. B. "**Notizen:**").',
						control: { type: 'textarea', key: 'extraFields', placeholder: '**Notizen:**' },
					},
				],
			},
			{
				type: 'group',
				heading: 'Bibeltext-Popup',
				items: [
					{
						name: 'Bibel-Datei',
						desc: this.bibleFileDesc(),
						// this.update() is only ever reachable here on Obsidian ≥ 1.13.0 (only
						// such versions call getSettingDefinitions()/render() in the first
						// place), but the requireApiVersion() guard is still needed to satisfy
						// static minAppVersion checks against this newer API.
						render: setting => this.renderBibleFileSetting(setting, () => {
							if (requireApiVersion('1.13.0')) this.update();
						}),
					},
				],
			},
		];
	}

	private bibleFileDesc(): string {
		return this.plugin.settings.bibleFileLoaded
			? 'Bibel-Datei ist geladen. Ein Klick auf eine Bibelstelle zeigt den Vers-Text direkt in Obsidian an (mit einem Button zum Öffnen in JW Library).'
			: 'Optional: eine Bibel-jwpub-Datei auswählen (z. B. von jw.org heruntergeladen), damit ein Klick auf eine Bibelstelle den Vers-Text direkt in Obsidian anzeigt, statt nur JW Library zu öffnen. Empfehlung: die Studienbibel (nwtsty) statt der einfachen Ausgabe (nwt) – sie enthält zusätzliche Studienanmerkungen und mehr Fußnoten. Die Datei wird lokal im Plugin-Ordner gespeichert, nicht ins Vault kopiert.';
	}

	// Shared between the declarative "render" escape hatch (above — needed since a
	// file-upload button + conditional delete button has no direct declarative
	// equivalent) and the display() fallback below. `refresh` re-renders the tab
	// afterwards — this.update() under the declarative path, this.display() under
	// the imperative fallback; the two are never appropriate at the same time,
	// since only one of the two rendering paths is ever active for a given
	// Obsidian version.
	private renderBibleFileSetting(setting: Setting, refresh: () => void): void {
		setting
			.addButton(btn =>
				btn.setButtonText(this.plugin.settings.bibleFileLoaded ? 'Datei ersetzen …' : 'Datei wählen …').onClick(() => {
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
				btn.setIcon('trash').setTooltip('Bibel-Datei entfernen').onClick(async () => {
					await this.plugin.removeBibleFile();
					refresh();
				});
				btn.extraSettingsEl.toggle(this.plugin.settings.bibleFileLoaded);
			});
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
			.setName('Sprache des Bibeltext-Popups')
			.setDesc('Bibelbuch-Namen und Beschriftungen im Popup. Notizen folgen automatisch der Sprache der importierten Programmdatei.')
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

		const bibleFileSetting = new Setting(containerEl).setName('Bibel-Datei').setDesc(this.bibleFileDesc());
		// This whole method only runs on Obsidian < 1.13.0 (see class-level comment
		// above), where display() is the only way to refresh the tab — the resulting
		// "display is deprecated" lint warning below is the documented fallback
		// pattern, not leftover use of the old API.
		this.renderBibleFileSetting(bibleFileSetting, () => this.display());
	}
}
