import { App, Modal, Setting } from 'obsidian';
import { BibleReader } from '../bible/BibleReader';
import { Scripture } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';
import { SupportedLang } from '../normalizer/bookNames';

export class BibleVerseModal extends Modal {
	constructor(
		app: App,
		private readonly scripture: Scripture,
		private readonly lang: SupportedLang,
		private readonly reader: BibleReader,
	) {
		super(app);
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('jw-bible-verse-modal');

		contentEl.createEl('h2', { text: ScriptureNormalizer.format(this.scripture, this.lang) });

		const bodyEl = contentEl.createDiv('jw-bible-verse-text');
		bodyEl.setText('Lade Bibeltext …');

		const verses = await this.reader.getVerseHtml(this.scripture);
		bodyEl.empty();
		if (verses && verses.length > 0) {
			for (const verseHtml of verses) {
				bodyEl.createEl('p', { text: this.stripHtml(verseHtml) });
			}
		} else {
			bodyEl.createEl('p', {
				text: 'Kein Vers-Text verfügbar (diese Stelle ist in der geladenen Bibel-Datei nicht indiziert).',
				cls: 'jw-bible-verse-missing',
			});
		}

		new Setting(contentEl).addButton(btn =>
			btn
				.setButtonText('In JW Library öffnen')
				.setCta()
				.onClick(() => {
					window.open(ScriptureNormalizer.toJwLibraryLink(this.scripture));
					this.close();
				}),
		);
	}

	// The verse HTML carries formatting spans (verse-number superscripts, footnote/
	// cross-reference markers) that are only meaningful together with Phase 2/3
	// (footnote and cross-reference lookups) — rendering them via innerHTML now
	// would mean injecting raw HTML into the DOM, which this project avoids on
	// principle even for trusted, locally-decrypted content. Plain text for now;
	// safe (raw DOM) rendering of the supported tags is Phase 2 work.
	private stripHtml(html: string): string {
		const doc = new DOMParser().parseFromString(html, 'text/html');
		return doc.body.textContent?.trim() ?? '';
	}

	onClose() {
		this.contentEl.empty();
	}
}
