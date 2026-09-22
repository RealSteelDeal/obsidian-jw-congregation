import { Scripture } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';

// Matches both markdown link syntax (used in per-item notes) and the raw HTML
// anchors the overview note uses for scripture links (see NoteBuilder) — Live
// Preview shows the *source* text for whichever form is actually written, so
// both patterns need to be recognised here.
const MARKDOWN_LINK_RE = /\[[^\]]*\]\((jwlibrary:\/\/[^)\s]*)\)/g;
// Matched through to the closing </a> on purpose: until 22.09.2026 this
// stopped after the href, so the reported `length` covered only the opening
// tag. Nothing read that length back then, but cutting a link out at the
// cursor does — and half an anchor left behind would be broken markup.
const HTML_LINK_RE = /<a\s+href="(jwlibrary:\/\/[^"]*)"[^>]*>[^<]*<\/a>/g;

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

// Every link this plugin writes: scripture references as jwlibrary:// deep
// links, and songs and source citations as jw.org/finder ones (deliberately
// not jwlibrary://, see NoteBuilder.songLink). The removal offer covers all
// of them and nothing else — an ordinary note link or an outside URL is none
// of this plugin's business.
const PLUGIN_URL = String.raw`(?:jwlibrary:\/\/|https:\/\/www\.jw\.org\/finder\?)`;
const PLUGIN_LINK_RE = new RegExp(String.raw`\[[^\]]*\]\(${PLUGIN_URL}[^)\s]*\)`, 'g');
const PLUGIN_HTML_LINK_RE = new RegExp(String.raw`<a\s+href="${PLUGIN_URL}[^"]*"[^>]*>[^<]*<\/a>`, 'g');
/** The opening half of such a link with nothing closing it — what is left the
 *  moment someone backspaces over a link's final `)`. */
const BROKEN_PLUGIN_LINK_TAIL_RE = new RegExp(String.raw`\[[^\]]*\]\(${PLUGIN_URL}[^)\s]*$`);

/** Yields the span of every plugin-written link in `text`, in order. */
function* iteratePluginLinks(text: string): Generator<{ index: number; length: number }> {
	for (const re of [PLUGIN_LINK_RE, PLUGIN_HTML_LINK_RE]) {
		re.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text))) yield { index: m.index, length: m[0].length };
	}
}

/** The span of the plugin-written link covering `offset`. */
export function findPluginLinkSpanAt(text: string, offset: number): { index: number; length: number } | undefined {
	for (const m of iteratePluginLinks(text)) {
		if (offset >= m.index && offset <= m.index + m.length) return m;
	}
	return undefined;
}

/** The span of the ONLY plugin-written link in `text`, when there is exactly
 *  one. The fallback for "remove the link under the cursor" when the caret is
 *  merely somewhere on the line: with a single link there is nothing to choose
 *  between, and on a phone the caret can hardly be placed inside a rendered
 *  link at all. Two or more, and this returns nothing rather than pick. */
export function solePluginLinkSpan(text: string): { index: number; length: number } | undefined {
	let found: { index: number; length: number } | undefined;
	for (const m of iteratePluginLinks(text)) {
		if (found) return undefined;
		found = m;
	}
	return found;
}

/** The visible text of a link, given the exact span of one — `1. Petrus 2:3`
 *  out of `[1. Petrus 2:3](jwlibrary://…`. What "adjust the link" leaves
 *  behind, so the entry can be corrected by typing rather than retyped from
 *  nothing. Works on a half-deleted link too: its label is the part deletion
 *  reaches last. */
export function pluginLinkLabel(span: string): string | undefined {
	return /^\[([^\]]*)\]/.exec(span)?.[1] ?? /<a\s[^>]*>([^<]*)<\/a>/.exec(span)?.[1];
}

/**
 * Recognises that a plugin-written link is in the middle of being deleted:
 * the text up to `ch` ends in the opening half of one that nothing closes any
 * more.
 */
export function findBrokenPluginLinkAt(line: string, ch: number): { start: number; end: number } | undefined {
	if (findPluginLinkSpanAt(line, ch)) return undefined;
	const match = BROKEN_PLUGIN_LINK_TAIL_RE.exec(line.slice(0, ch));
	return match ? { start: match.index, end: ch } : undefined;
}

/**
 * The link a removal suggestion should offer to act on, if any — used by
 * RemoveLinkSuggest to decide whether to show itself at all.
 *
 * Two moments count as "this link is on its way out":
 *
 *  1. The link is already broken (see findBrokenPluginLinkAt) — the backspace
 *     over its closing bracket has happened.
 *  2. The link is still intact, the caret sits exactly at its end, and no
 *     space follows. Inserting a reference leaves a space after it with the
 *     caret beyond that space, so this state is not what writing produces —
 *     it is what deleting that space produces. Catching it saves the user the
 *     keystroke that would break the link in the first place.
 *
 * A space after the caret rules case 2 out on purpose: with the inserted
 * space still in place, the caret merely being moved to the end of a link is
 * not an intention to delete it.
 */
export function findPluginLinkToRemoveAt(line: string, ch: number): { start: number; end: number } | undefined {
	const broken = findBrokenPluginLinkAt(line, ch);
	if (broken) return broken;

	const intact = findPluginLinkSpanAt(line, ch);
	if (!intact) return undefined;
	const end = intact.index + intact.length;
	if (ch !== end || line[ch] === ' ') return undefined;
	return { start: intact.index, end };
}

/**
 * Cuts `length` characters at `index` out of `text`, dropping one of the two
 * spaces that would otherwise be left behind.
 *
 * The only tidying done, and deliberately the least that can be justified: a
 * reference removed from mid-sentence leaves "Lesen wir  dazu" with a double
 * space, which nobody typed and nobody wants. Everything else around it —
 * brackets the reference stood in, punctuation — is left exactly as written,
 * because guessing at what else "belongs" to the reference would start
 * editing the user's own sentence.
 */
export function cutSpan(text: string, index: number, length: number): string {
	const before = text.slice(0, index);
	const after = text.slice(index + length);
	if (before.endsWith(' ') && after.startsWith(' ')) return before + after.slice(1);
	return before + after;
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

/**
 * The exact span of the first jwlibrary:// link in `text` whose scripture is
 * `target`, plus the label it carries — for rewriting that one reference in
 * place.
 *
 * A line often holds several references ("Röm. 2:14, 15" next to "Ps. 94:19"),
 * so the span has to come from matching the parsed scripture rather than from
 * the first link on the line. `label` lets a caller keep the user's own
 * spelling of the book when it writes the replacement, instead of expanding
 * "Phil." into "Philipper" behind their back.
 */
export function findScriptureLinkSpan(
	text: string, target: Scripture,
): { index: number; length: number; label: string } | undefined {
	for (const m of iterateScriptureLinks(text)) {
		if (!scripturesEqual(m.scripture, target)) continue;
		const label = /^\[([^\]]*)\]/.exec(text.slice(m.index, m.index + m.length))?.[1];
		// Only the markdown form carries a label; the raw-HTML anchors the
		// overview note uses are not rewritten, so an absent label means this
		// match is not one a caller can replace in place.
		if (label === undefined) continue;
		return { index: m.index, length: m.length, label };
	}
	return undefined;
}

function scripturesEqual(a: Scripture, b: Scripture): boolean {
	return a.book === b.book
		&& a.chapter === b.chapter
		&& a.verseStart === b.verseStart
		&& (a.verseEnd ?? null) === (b.verseEnd ?? null)
		&& (a.chapterEnd ?? null) === (b.chapterEnd ?? null)
		// Without this, "1. Tim. 4:12, 15" and "1. Tim. 4:12" would count as the
		// same reference, and the popup's "remove quote" could take out the
		// wrong callout when a note cites both.
		&& serializeExtraVerses(a) === serializeExtraVerses(b);
}

function serializeExtraVerses(s: Scripture): string {
	return (s.extraVerses ?? []).map(run => `${run.start}-${run.end ?? run.start}`).join(',');
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

/**
 * Computes where a NEW quote (for some OTHER scripture) should be appended
 * relative to wherever `target` is found — used by BibleVerseModal's "insert
 * as quote" so it lands next to the reference the popup itself was opened
 * for, even after navigating to a different verse inside the popup (e.g. via
 * a cross-reference).
 *
 * If `target` is itself an EXISTING quote callout's title (the popup was
 * opened by clicking that quote — see util/quoteBuilder.ts — then navigated
 * elsewhere), the returned line skips past the callout's LAST line, not just
 * its title: Markdown callouts are just consecutive "> " lines with no blank
 * line between them, so appending right after the title would land the new
 * "> [!quote]" marker *inside* the existing callout's own blockquote —
 * Obsidian doesn't treat a second "[!quote]" mid-block as a nested callout,
 * it only honours the very first line's marker, rendering everything after
 * (including that second marker) as the first callout's own literal body
 * text, while the blank line a naive insertion would add next then splits
 * the ORIGINAL body off into its own bare, title-less blockquote underneath
 * (confirmed by real-world testing — this was a genuine reported bug).
 *
 * `separator` is `"\n\n"` (a blank line) instead of `"\n"` whenever the
 * target line itself already starts a blockquote — appending directly
 * adjacent to another blockquote/callout without one would merge the two
 * into a single blockquote, the same corruption described above, whether or
 * not `target` resolved via the callout branch above.
 *
 * Returns undefined when `target` isn't found as a link anywhere (the popup
 * was opened via some other route) — the caller falls back to inserting at
 * the current cursor position in that case.
 */
export function findQuoteInsertionPoint(lines: string[], target: Scripture): { line: number; separator: string } | undefined {
	const quoteRange = findQuoteBlockRange(lines, target);
	const line = quoteRange ? quoteRange.end - 1 : findLineWithScripture(lines, target);
	if (line === undefined) return undefined;
	const separator = lines[line]!.startsWith('>') ? '\n\n' : '\n';
	return { line, separator };
}
