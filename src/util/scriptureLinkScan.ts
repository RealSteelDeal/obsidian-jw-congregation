import { Scripture } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';

// Matches both markdown link syntax (used in per-item notes) and the raw HTML
// anchors the overview note uses for scripture links (see NoteBuilder) — Live
// Preview shows the *source* text for whichever form is actually written, so
// both patterns need to be recognised here.
const MARKDOWN_LINK_RE = /\[[^\]]*\]\((jwlibrary:\/\/[^)\s]*)\)/g;
const HTML_LINK_RE = /<a\s+href="(jwlibrary:\/\/[^"]*)"/g;

export function parseScriptureFromHref(href: string): Scripture | undefined {
	try {
		const bibleParam = new URL(href).searchParams.get('bible');
		if (!bibleParam) return undefined;
		return ScriptureNormalizer.fromRtf(bibleParam);
	} catch {
		return undefined;
	}
}

interface ScriptureLinkMatch {
	index: number;
	length: number;
	scripture: Scripture;
	href: string;
}

/** Yields every jwlibrary:// scripture link (markdown or raw-HTML form) found in `text`, in order — shared core for every other function in this module. */
function* iterateScriptureLinks(text: string): Generator<ScriptureLinkMatch> {
	for (const re of [MARKDOWN_LINK_RE, HTML_LINK_RE]) {
		re.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text))) {
			const href = m[1];
			if (!href) continue;
			const scripture = parseScriptureFromHref(href);
			if (scripture) yield { index: m.index, length: m[0].length, scripture, href };
		}
	}
}

/** Finds a jwlibrary:// scripture link (markdown or raw-HTML form) whose span covers `offset` within `text`. */
export function findScriptureLinkInText(text: string, offset: number): { scripture: Scripture; href: string } | undefined {
	for (const m of iterateScriptureLinks(text)) {
		if (offset >= m.index && offset <= m.index + m.length) return { scripture: m.scripture, href: m.href };
	}
	return undefined;
}

/**
 * Finds the first jwlibrary:// scripture link anywhere in `text`, ignoring
 * position — for callers that already know which line to look at (e.g. a
 * quote callout's title, see QUOTE_CALLOUT_START_RE below) rather than
 * resolving a specific click offset within it.
 */
export function findFirstScriptureLinkInText(text: string): { scripture: Scripture; href: string } | undefined {
	for (const m of iterateScriptureLinks(text)) return { scripture: m.scripture, href: m.href };
	return undefined;
}

function scripturesEqual(a: Scripture, b: Scripture): boolean {
	return a.book === b.book
		&& a.chapter === b.chapter
		&& a.verseStart === b.verseStart
		&& (a.verseEnd ?? null) === (b.verseEnd ?? null)
		&& (a.chapterEnd ?? null) === (b.chapterEnd ?? null);
}

/** Whether `text` contains a jwlibrary:// scripture link (markdown or raw-HTML form) matching `target`. */
function lineContainsScripture(text: string, target: Scripture): boolean {
	for (const m of iterateScriptureLinks(text)) {
		if (scripturesEqual(m.scripture, target)) return true;
	}
	return false;
}

/** A quote callout's title line (see util/quoteBuilder.ts), e.g. `> [!quote] [Psalm 1:1](href)`. */
export const QUOTE_CALLOUT_START_RE = /^>\s*\[!quote\]/i;

/**
 * Finds the 0-based index of the first line in `lines` containing a
 * jwlibrary:// scripture link (markdown or raw-HTML form) whose parsed
 * Scripture matches `target` — used by the verse popup's "insert as quote" to
 * place the quote right after the reference it was originally opened from,
 * even after navigating to a different verse inside the popup itself (e.g.
 * via a cross-reference), where `target` stays the ORIGINAL scripture rather
 * than whatever is currently displayed.
 */
export function findLineWithScripture(lines: string[], target: Scripture): number | undefined {
	for (let i = 0; i < lines.length; i++) {
		if (lineContainsScripture(lines[i]!, target)) return i;
	}
	return undefined;
}

/**
 * Finds the [start, end) line range of the quote callout (see
 * util/quoteBuilder.ts) that was inserted for `target` — the callout's own
 * title line carries the same jwlibrary:// link a plain inline reference
 * would, so its start line is found the same way findLineWithScripture()
 * finds those, restricted to lines that actually open a "> [!quote]"
 * callout (the verse-text line below has no link to match on its own).
 * `end` extends past every immediately-following blockquote line ("> …"),
 * covering the callout's body regardless of how many lines it spans.
 *
 * Used by the popup's "remove quote" button (BibleVerseModal) — undefined
 * when the block has already been removed or edited away since the popup
 * opened (e.g. the user deleted it manually in the meantime).
 */
export function findQuoteBlockRange(lines: string[], target: Scripture): { start: number; end: number } | undefined {
	for (let i = 0; i < lines.length; i++) {
		const text = lines[i]!;
		if (!QUOTE_CALLOUT_START_RE.test(text) || !lineContainsScripture(text, target)) continue;
		let end = i + 1;
		while (end < lines.length && lines[end]!.startsWith('>')) end++;
		return { start: i, end };
	}
	return undefined;
}
