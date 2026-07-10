import { App, Modal, Setting, setIcon } from 'obsidian';
import { BibleReader, VerseDetail, VerseSegment } from '../bible/BibleReader';
import { Scripture } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';
import { SupportedLang } from '../normalizer/bookNames';
import { L } from '../i18n';

// The scheme used by embedded scripture links *inside* footnote/cross-reference/
// study-note HTML (e.g. `<a href="jwpub://b/NWTR/43:5:7-43:5:7">Joh 5:7</a>`) —
// distinct from the jwlibrary:// links used elsewhere in this plugin, but the
// book:chapter:verse[-verse] payload after the prefix is the exact same shape
// ScriptureNormalizer.fromJwpub() already parses for the main jwpub import path.
const EMBEDDED_BIBLE_HREF_PREFIX = 'jwpub://b/NWTR/';

export class BibleVerseModal extends Modal {
	// Cross-reference/study-note clicks navigate WITHIN this one modal instead
	// of stacking a new popup on top (an earlier version stacked, capped at 10
	// — navigation makes both the cap and the memory concern obsolete: there is
	// only ever one popup, and the history holds tiny Scripture records, not
	// rendered DOM). The back arrow in the header walks the trail back.
	private history: Scripture[] = [];
	private scripture: Scripture;

	// Resolved from getReader() on open. The loader indirection (instead of a
	// ready reader instance) lets the modal open INSTANTLY on the very first
	// click of a session and show its loading state while the Bible file is
	// still being decrypted/indexed (up to ~125 MB for the study edition) —
	// previously that first click sat on a silently dead screen for seconds
	// before anything appeared.
	private reader: BibleReader | null = null;

	constructor(
		app: App,
		scripture: Scripture,
		private readonly lang: SupportedLang,
		private readonly getReader: () => Promise<BibleReader | null>,
	) {
		super(app);
		this.scripture = scripture;
	}

	async onOpen() {
		await this.render();
	}

	// Renders the CURRENT scripture into the modal — called on open and again
	// after every navigation step (forward into a reference, or back).
	private async render(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('jw-bible-verse-modal');
		contentEl.scrollTop = 0;

		const header = contentEl.createDiv('jw-bible-verse-header');
		if (this.history.length > 0) {
			const backBtn = header.createEl('button', { cls: 'clickable-icon jw-bible-back-button' });
			setIcon(backBtn, 'arrow-left');
			backBtn.setAttribute('aria-label', L[this.lang].popupBack);
			backBtn.addEventListener('click', () => this.goBack());
		}
		header.createEl('h2', { text: ScriptureNormalizer.format(this.scripture, this.lang) });

		const bodyEl = contentEl.createDiv('jw-bible-verse-text');
		bodyEl.setText(L[this.lang].popupLoading);

		this.reader = await this.getReader();
		bodyEl.empty();

		if (!this.reader) {
			// Reader failed to load (a specific Notice with the reason is already
			// shown by the loader) — keep the popup usable as a JW Library springboard.
			bodyEl.createEl('p', { text: L[this.lang].popupLoadFailed, cls: 'jw-bible-verse-missing' });
			this.renderJwLibraryButton(bodyEl);
			return;
		}

		const verses = await this.reader.getVerseDetails(this.scripture);
		if (verses && verses.length > 0) {
			this.renderVerseText(bodyEl, verses);
			this.renderContextControls(bodyEl);
			this.renderNotes(bodyEl, verses);
			this.renderStudyNotes(bodyEl, verses);
		} else {
			bodyEl.createEl('p', {
				text: L[this.lang].popupMissing,
				cls: 'jw-bible-verse-missing',
			});
		}
		this.renderJwLibraryButton(bodyEl);
	}

	// Context expansion: widen the shown passage verse by verse (or to the
	// whole chapter) WITHOUT touching the navigation history — expanding is
	// refining the current view, not visiting a new place, so the back arrow
	// still returns to wherever the user navigated from. Bounds come from the
	// Bible file's own BibleChapter table; without a known chapter end the
	// forward/whole-chapter buttons stay hidden, because verse ids continue
	// seamlessly into the next chapter and an unbounded expansion would
	// silently show foreign verses.
	//
	// Hidden entirely for a cross-chapter citation (chapterEnd set): this
	// row's math (verseEnd compared against the START chapter's own verse
	// count) assumes a single chapter — "widen by one verse"/"whole chapter"
	// is also a fuzzier question here (which of the spanned chapters?) that
	// hasn't been asked for; showing the full already-requested range is what
	// this popup does regardless.
	private renderContextControls(bodyEl: HTMLElement): void {
		if (this.scripture.chapterEnd !== undefined && this.scripture.chapterEnd !== this.scripture.chapter) return;
		const count = this.reader?.chapterVerseCount(this.scripture.book, this.scripture.chapter);
		const start = this.scripture.verseStart;
		const end = this.scripture.verseEnd ?? start;
		const canBefore = start > 1;
		const canAfter = count !== undefined && end < count;
		const canWholeChapter = count !== undefined && !(start === 1 && end >= count);
		if (!canBefore && !canAfter && !canWholeChapter) return;

		const t = L[this.lang];
		const row = bodyEl.createDiv('jw-bible-context-row');
		const addButton = (label: string, onClick: () => void) => {
			const btn = row.createEl('button', { text: label, cls: 'jw-bible-context-button' });
			btn.addEventListener('click', onClick);
		};

		if (canBefore) {
			addButton(t.popupVerseBefore, () => {
				this.scripture = { ...this.scripture, verseStart: start - 1, verseEnd: end };
				void this.render();
			});
		}
		if (canAfter) {
			addButton(t.popupVerseAfter, () => {
				this.scripture = { ...this.scripture, verseEnd: end + 1 };
				void this.render();
			});
		}
		if (canWholeChapter) {
			addButton(t.popupWholeChapter, () => {
				this.scripture = { ...this.scripture, verseStart: 1, verseEnd: count };
				void this.render();
			});
		}
	}

	private navigateTo(scripture: Scripture): void {
		this.history.push(this.scripture);
		this.scripture = scripture;
		void this.render();
	}

	private goBack(): void {
		const previous = this.history.pop();
		if (!previous) return;
		this.scripture = previous;
		void this.render();
	}

	// Placed at the very bottom of the popup, below the (collapsed) footnote/
	// cross-reference/study-note accordions — an earlier version had it directly
	// beneath the verse text, but per user feedback the button reads better as
	// the popup's closing element than as a wedge between text and accordions.
	private renderJwLibraryButton(container: HTMLElement): void {
		new Setting(container).addButton(btn =>
			btn
				.setButtonText(L[this.lang].popupOpenJwLibrary)
				.setCta()
				.onClick(() => {
					window.open(ScriptureNormalizer.toJwLibraryLink(this.scripture, this.lang));
					this.close();
				}),
		);
	}

	// One continuous paragraph (like the printed Bible layout), with each
	// verse's number as a small inline marker — not one paragraph per verse,
	// which read as disconnected, unrelated sentences instead of one passage.
	// A chapter's first verse gets a visibly larger number (isChapterStart),
	// matching how printed Bibles (and the jwpub chapter HTML itself) tell a
	// chapter number apart from a regular verse number. Footnote/cross-reference
	// markers are rendered inline at their real position (from `segments`,
	// extracted from the chapter HTML) instead of only being listed below.
	private renderVerseText(bodyEl: HTMLElement, verses: VerseDetail[]): void {
		const p = bodyEl.createEl('p');
		for (const verse of verses) {
			const number = this.stripHtml(verse.number);
			if (number) {
				const cls = verse.isChapterStart ? 'jw-bible-chapter-number' : 'jw-bible-verse-number';
				p.createEl('sup', { text: number, cls });
			}
			this.appendSegments(p, verse.segments);
			p.appendText(' ');
		}
	}

	private appendSegments(container: HTMLElement, segments: VerseSegment[]): void {
		for (const segment of segments) {
			if (segment.kind === 'text') {
				container.appendText(segment.text);
				continue;
			}
			const cls = segment.kind === 'footnote' ? 'jw-bible-inline-footnote' : 'jw-bible-inline-crossref';
			container.createEl('sup', { text: segment.symbol, cls: `jw-bible-inline-marker ${cls}` });
		}
	}

	// Footnotes and cross-references, listed per verse (prefixed with the verse
	// number whenever the popup spans more than one, since the marker letters
	// a/b/c.. restart at each verse and would otherwise collide). Bible
	// references embedded in the footnote text, and the cross-reference's own
	// target scripture, both open another popup on click (see openScripturePopup())
	// — kept in-app rather than bouncing out to JW Library, consistent with the
	// whole point of this popup. Collapsed by default via <details>, same as
	// renderStudyNotes() — keeps the verse text itself as the focal point when
	// the popup is first opened.
	private renderNotes(bodyEl: HTMLElement, verses: VerseDetail[]): void {
		const multiVerse = verses.length > 1;

		const footnoteLines = verses.flatMap(v =>
			v.footnotes.map(fn => ({ verse: v.number, symbol: fn.symbol, html: fn.html })),
		);
		if (footnoteLines.length > 0) {
			const details = bodyEl.createEl('details', { cls: 'jw-bible-collapsible' });
			details.createEl('summary', { text: `${L[this.lang].popupFootnotes} (${footnoteLines.length})` });
			const list = details.createEl('ul', { cls: 'jw-bible-notes-list' });
			for (const fn of footnoteLines) {
				const prefix = multiVerse ? `${L[this.lang].popupVersePrefix} ${this.stripHtml(fn.verse)}, ` : '';
				const li = list.createEl('li');
				li.appendText(prefix);
				li.createSpan({ text: fn.symbol, cls: 'jw-bible-inline-footnote' });
				li.appendText(') ');
				this.renderRichText(li, fn.html);
			}
		}

		const crossRefLines = verses.flatMap(v =>
			v.crossReferences.map(cr => ({
				verse: v.number,
				symbol: cr.symbol,
				label: cr.scripture ? ScriptureNormalizer.format(cr.scripture, this.lang) : undefined,
				scripture: cr.scripture,
				html: cr.html,
			})),
		);
		if (crossRefLines.length > 0) {
			const details = bodyEl.createEl('details', { cls: 'jw-bible-collapsible' });
			details.createEl('summary', { text: `${L[this.lang].popupCrossRefs} (${crossRefLines.length})` });
			const list = details.createEl('ul', { cls: 'jw-bible-notes-list' });
			for (const cr of crossRefLines) {
				const prefix = multiVerse ? `${L[this.lang].popupVersePrefix} ${this.stripHtml(cr.verse)}, ` : '';
				const li = list.createEl('li');
				li.appendText(prefix);
				li.createSpan({ text: cr.symbol, cls: 'jw-bible-inline-crossref' });
				li.appendText(') ');
				if (cr.label && cr.scripture) {
					const target = cr.scripture;
					const labelEl = li.createEl('strong', { text: `${cr.label}: `, cls: 'jw-bible-inline-link' });
					labelEl.addEventListener('click', () => this.openScripturePopup(target));
				} else if (cr.label) {
					li.createEl('strong', { text: `${cr.label}: ` });
				}
				if (cr.html) this.renderRichText(li, cr.html);
				else li.appendText(L[this.lang].popupNoText);
			}
		}
	}

	// Study notes ("Studienanmerkungen") can be sizeable (up to ~3.5k characters
	// each, several per verse for heavily annotated chapters) — collapsed by
	// default via a native <details> element so a long scripture range doesn't
	// turn the popup into a wall of text, while still being one click away.
	private renderStudyNotes(bodyEl: HTMLElement, verses: VerseDetail[]): void {
		const multiVerse = verses.length > 1;
		const notes = verses.flatMap(v => v.studyNotes.map(sn => ({ verse: v.number, ...sn })));
		if (notes.length === 0) return;

		const details = bodyEl.createEl('details', { cls: 'jw-bible-collapsible' });
		details.createEl('summary', { text: `${L[this.lang].popupStudyNotes} (${notes.length})` });
		const list = details.createEl('ul', { cls: 'jw-bible-notes-list' });
		for (const note of notes) {
			const li = list.createEl('li');
			const prefix = multiVerse ? `${L[this.lang].popupVersePrefix} ${this.stripHtml(note.verse)}, ` : '';
			const label = this.stripHtml(note.label);
			li.appendText(prefix);
			if (label) li.createSpan({ text: `${label}: `, cls: 'jw-bible-inline-studynote' });
			this.renderRichText(li, note.html);
		}
	}

	// Renders a decrypted HTML fragment (footnote/cross-reference/study-note
	// body) as safe DOM: plain text everywhere, except embedded scripture links
	// (`<a href="jwpub://b/NWTR/...">`), which become clickable spans opening
	// another verse popup. Other inline formatting (strong/em/…) is flattened to
	// its text content — faithfully reproducing bold/italic would need
	// allow-listed element cloning for marginal benefit here. This project
	// avoids innerHTML entirely (see project convention), so the fragment is
	// walked node-by-node instead of ever being assigned as markup.
	private renderRichText(container: HTMLElement, html: string): void {
		const doc = new DOMParser().parseFromString(html, 'text/html');
		this.appendRichNodes(container, doc.body.childNodes);
	}

	private appendRichNodes(container: HTMLElement, nodes: ArrayLike<ChildNode>): void {
		for (const node of Array.from(nodes)) {
			if (node.nodeType === Node.TEXT_NODE) {
				const text = node.textContent;
				if (text) container.appendText(text);
				continue;
			}
			if (!node.instanceOf(HTMLElement)) continue;

			if (node.tagName === 'A') {
				const href = node.getAttribute('href') ?? '';
				// Direct scripture links (jwpub://b/NWTR/…) and study-note
				// cross-references ("Anm. zu Mat 5:18", jwpub://c/…, whose target
				// verse the reader resolves via the file's own book-document
				// mapping) both open another verse popup — the target verse's
				// popup includes the referenced study note in its own accordion.
				const scripture = this.parseEmbeddedScripture(href) ?? this.reader?.parseCommentaryHref(href);
				if (scripture) {
					const link = container.createSpan({ text: node.textContent ?? '', cls: 'jw-bible-inline-link' });
					link.addEventListener('click', () => this.openScripturePopup(scripture));
					continue;
				}
				// Anything else (e.g. glossary/media links, jwpub://p/…) — not
				// something this popup can navigate to, so just keep its text.
				container.appendText(node.textContent ?? '');
				continue;
			}
			this.appendRichNodes(container, node.childNodes);
		}
	}

	private parseEmbeddedScripture(href: string): Scripture | undefined {
		if (!href.startsWith(EMBEDDED_BIBLE_HREF_PREFIX)) return undefined;
		try {
			return ScriptureNormalizer.fromJwpub(href.slice(EMBEDDED_BIBLE_HREF_PREFIX.length));
		} catch {
			return undefined;
		}
	}

	// Navigates this modal to `scripture` — the previous passage goes onto the
	// history stack and stays reachable via the header's back arrow, so the
	// user can drill into a footnote/cross-reference's citations without losing
	// their place (and without stacking windows).
	private openScripturePopup(scripture: Scripture): void {
		this.navigateTo(scripture);
	}

	// Verse-number labels (BibleVerse.Label) are plain strings in practice but
	// treated defensively like the rest of this project's HTML fields.
	private stripHtml(html: string): string {
		const doc = new DOMParser().parseFromString(html, 'text/html');
		return doc.body.textContent?.trim() ?? '';
	}

	onClose() {
		this.contentEl.empty();
	}
}
