import { App, Modal, Notice, Setting } from 'obsidian';
import type JwCongregationPlugin from '../main';
import { SourceRouter } from '../parser/SourceRouter';
import { Congress, CongressType } from '../models/congress';

const TYPE_LABELS: Record<CongressType, string> = {
	'CO':        'Regionaler Kongress',
	'CA-copgm':  'Kreiskongress (Kreisaufseher)',
	'CA-brpgm':  'Kreiskongress (Zweigbüro)',
};

export class ImportModal extends Modal {
	private fileData: Buffer | null = null;
	private filename = '';
	private preview: Congress | null = null;
	private previewEl: HTMLElement | null = null;

	constructor(app: App, private readonly plugin: JwCongregationPlugin) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Kongressprogramm importieren' });

		new Setting(contentEl)
			.setName('Programmdatei')
			.setDesc('Wähle eine .jwpub-Datei oder ein RTF-ZIP.')
			.addButton(btn =>
				btn.setButtonText('Datei wählen …').onClick(() => {
					const input = createEl('input', { type: 'file' });
					input.accept = '.jwpub,.zip,.rtf';
					input.onchange = async () => {
						const file = input.files?.[0];
						if (!file) return;
						this.filename = file.name;
						this.fileData = Buffer.from(await file.arrayBuffer());
						await this.loadPreview();
					};
					input.click();
				}),
			);

		this.previewEl = contentEl.createDiv('jw-import-preview');

		new Setting(contentEl)
			.addButton(btn =>
				btn
					.setButtonText('Importieren')
					.setCta()
					.onClick(async () => {
						if (!this.fileData) {
							new Notice('Bitte zuerst eine Datei wählen.');
							return;
						}
						this.close();
						await this.plugin.importFile(this.filename, this.fileData);
					}),
			)
			.addButton(btn =>
				btn.setButtonText('Abbrechen').onClick(() => this.close()),
			);
	}

	private async loadPreview() {
		if (!this.fileData || !this.previewEl) return;
		this.previewEl.empty();

		try {
			const router = new SourceRouter();
			const result = await router.route(this.filename, this.fileData);
			this.preview = result.congress;
			this.renderPreview(result.congress, result.source);
		} catch (err) {
			this.previewEl.createEl('p', {
				text: `Vorschau nicht möglich: ${String(err)}`,
				cls: 'jw-preview-error',
			});
		}
	}

	private renderPreview(congress: Congress, source: string) {
		if (!this.previewEl) return;
		const el = this.previewEl;

		el.createEl('h3', { text: 'Vorschau' });

		const table = el.createEl('table', { cls: 'jw-preview-table' });
		const addRow = (label: string, value: string) => {
			const row = table.createEl('tr');
			row.createEl('td', { text: label, cls: 'jw-label' });
			row.createEl('td', { text: value });
		};

		addRow('Typ', TYPE_LABELS[congress.type] ?? congress.type);
		addRow('Motto', congress.theme);
		addRow('Jahr', String(congress.year));
		addRow('Tage', congress.days.map(d => d.weekday).join(', '));
		addRow('Quelle', source === 'jwpub' ? 'jwpub' : 'RTF (Fallback)');

		const itemCount = congress.days.flatMap(d =>
			d.sessions.flatMap(s => s.items),
		).length;
		addRow('Programmpunkte', String(itemCount));
	}

	onClose() {
		this.contentEl.empty();
	}
}
