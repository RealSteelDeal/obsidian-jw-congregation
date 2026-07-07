import { App, Modal, Setting } from 'obsidian';
import { BibleReader, VerseDetail } from '../bible/BibleReader';
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

		const verses = await this.reader.getVerseDetails(this.scripture);
		bodyEl.empty();
		if (verses && verses.length > 0) {
			this.renderVerseText(bodyEl, verses);
			this.renderNotes(bodyEl, verses);
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

	// One continuous paragraph (like the printed Bible layout), with each
	// verse's number as a small inline marker — not one paragraph per verse,
	// which read as disconnected, unrelated sentences instead of one passage.
	// Footnote/cross-reference markers (superscript letters in the source) are
	// intentionally not shown inline here — they're listed below instead, since
	// rendering them inline would need to reproduce the marker positions from
	// raw HTML (innerHTML), which this project avoids (see renderNotes()).
	private renderVerseText(bodyEl: HTMLElement, verses: VerseDetail[]): void {
		const p = bodyEl.createEl('p');
		for (const verse of verses) {
			const number = this.stripHtml(verse.number);
			if (number) p.createEl('sup', { text: number, cls: 'jw-bible-verse-number' });
			p.appendText(this.stripHtml(verse.html) + ' ');
		}
	}

	// Footnotes and cross-references, listed per verse (prefixed with the verse
	// number whenever the popup spans more than one, since the marker letters
	// a/b/c.. restart at each verse and would otherwise collide).
	private renderNotes(bodyEl: HTMLElement, verses: VerseDetail[]): void {
		const multiVerse = verses.length > 1;

		const footnoteLines = verses.flatMap(v =>
			v.footnotes.map(fn => ({ verse: v.number, symbol: fn.symbol, text: this.stripHtml(fn.html) })),
		);
		if (footnoteLines.length > 0) {
			bodyEl.createEl('h3', { text: 'Fußnoten' });
			const list = bodyEl.createEl('ul', { cls: 'jw-bible-notes-list' });
			for (const fn of footnoteLines) {
				const prefix = multiVerse ? `Vers ${this.stripHtml(fn.verse)}, ` : '';
				list.createEl('li', { text: `${prefix}${fn.symbol}) ${fn.text}` });
			}
		}

		const crossRefLines = verses.flatMap(v =>
			v.crossReferences.map(cr => ({
				verse: v.number,
				symbol: cr.symbol,
				label: cr.scripture ? ScriptureNormalizer.format(cr.scripture, this.lang) : undefined,
				text: cr.html ? this.stripHtml(cr.html) : undefined,
			})),
		);
		if (crossRefLines.length > 0) {
			bodyEl.createEl('h3', { text: 'Querverweise' });
			const list = bodyEl.createEl('ul', { cls: 'jw-bible-notes-list' });
			for (const cr of crossRefLines) {
				const prefix = multiVerse ? `Vers ${this.stripHtml(cr.verse)}, ` : '';
				const li = list.createEl('li');
				li.appendText(`${prefix}${cr.symbol}) `);
				if (cr.label) li.createEl('strong', { text: `${cr.label}: ` });
				li.appendText(cr.text ?? '(kein Text verfügbar)');
			}
		}
	}

	// The verse/footnote/cross-reference HTML carries formatting spans (verse-
	// number superscripts, footnote/cross-reference markers) that would need
	// safe, allow-listed DOM construction to render faithfully — reduced to
	// plain text via DOMParser → textContent instead, since this project avoids
	// innerHTML even for trusted, locally-decrypted content (also required by
	// the Obsidian review guidelines).
	private stripHtml(html: string): string {
		const doc = new DOMParser().parseFromString(html, 'text/html');
		return doc.body.textContent?.trim() ?? '';
	}

	onClose() {
		this.contentEl.empty();
	}
}
