import { VerseDetail } from '../bible/BibleReader';

/** Verse-number labels (BibleVerse.Label) are plain strings in practice but
 *  treated defensively like every other HTML field read from the Bible file. */
export function stripHtml(html: string): string {
	if (!html) return '';
	const doc = new DOMParser().parseFromString(html, 'text/html');
	return doc.body.textContent?.trim() ?? '';
}

/**
 * Builds an Obsidian quote callout (`> [!quote] Reference\n> text`) from
 * resolved verse text — shared by the popup's "insert as quote" button
 * (BibleVerseModal) and the in-editor scripture suggester (ScriptureEditorSuggest),
 * so both produce byte-identical output. Footnote/cross-reference markers are
 * deliberately left out: the lettered superscripts only mean something next to
 * a footnote/cross-reference list, which isn't inserted alongside them.
 */
export function buildScriptureQuoteBlock(reference: string, verses: VerseDetail[]): string {
	const text = verses
		.map(v => `${stripHtml(v.number)} ${v.segments.filter(s => s.kind === 'text').map(s => s.text).join('')}`.trim())
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();
	return `> [!quote] ${reference}\n${text.split('\n').map(line => `> ${line}`).join('\n')}\n`;
}
