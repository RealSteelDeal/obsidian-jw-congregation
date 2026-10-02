import { VerseDetail } from '../bible/BibleReader';
import { stripZeroWidthSpace } from './jwpubLinks';

/** Verse-number labels (BibleVerse.Label) are plain strings in practice but
 *  treated defensively like every other HTML field read from the Bible file. */
export function stripHtml(html: string): string {
	if (!html) return '';
	const doc = new DOMParser().parseFromString(html, 'text/html');
	return doc.body.textContent?.trim() ?? '';
}

/**
 * Builds an Obsidian quote callout (`> [!quote] [Reference](href)\n> [text](href)`)
 * from resolved verse text — shared by the popup's "insert as quote" button
 * (BibleVerseModal) and the in-editor scripture suggester (ScriptureEditorSuggest),
 * so both produce byte-identical output. Footnote/cross-reference markers are
 * deliberately left out: the lettered superscripts only mean something next to
 * a footnote/cross-reference list, which isn't inserted alongside them.
 *
 * BOTH the title and the verse-text body are `jwlibrary://` links to the same
 * href — exactly the same markdown-link shape a plain inline reference
 * already uses (see util/scriptureLinkScan.ts) — so the whole callout is
 * clickable, not just its title, and opens the verse popup either way.
 * styles.css strips the body link's usual blue/underline styling back to
 * plain quote text (title keeps it, as the visible "this is a link" cue);
 * BibleVerseModal recognizes the click came from inside a quote callout
 * either way, to offer a "remove quote" button there.
 *
 * U+200B is removed from the text. The Korean Bible carries about ten per
 * verse, between a word and its particle ("사랑\u200B과") — written into a note they
 * would stop Obsidian's search finding "사랑과". Removed for every language:
 * unlike a file name, a quote's text is never used to find anything again,
 * so nothing already written depends on it. The popup keeps them; there
 * they only affect line breaking.
 */
export function buildScriptureQuoteBlock(reference: string, href: string, verses: VerseDetail[]): string {
	const text = stripZeroWidthSpace(verses
		.map(v => `${stripHtml(v.number)} ${v.segments.filter(s => s.kind === 'text').map(s => s.text).join('')}`.trim())
		.join(' '))
		.replace(/\s+/g, ' ')
		.trim();
	const body = text.split('\n').map(line => `> [${line}](${href})`).join('\n');
	return `> [!quote] [${reference}](${href})\n${body}\n`;
}
