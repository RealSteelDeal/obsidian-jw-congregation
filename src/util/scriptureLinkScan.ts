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

/** Finds a jwlibrary:// scripture link (markdown or raw-HTML form) whose span covers `offset` within `text`. */
export function findScriptureLinkInText(text: string, offset: number): { scripture: Scripture; href: string } | undefined {
	for (const re of [MARKDOWN_LINK_RE, HTML_LINK_RE]) {
		re.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text))) {
			if (offset >= m.index && offset <= m.index + m[0].length) {
				const href = m[1];
				if (!href) continue;
				const scripture = parseScriptureFromHref(href);
				if (scripture) return { scripture, href };
			}
		}
	}
	return undefined;
}

function scripturesEqual(a: Scripture, b: Scripture): boolean {
	return a.book === b.book
		&& a.chapter === b.chapter
		&& a.verseStart === b.verseStart
		&& (a.verseEnd ?? null) === (b.verseEnd ?? null)
		&& (a.chapterEnd ?? null) === (b.chapterEnd ?? null);
}

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
		const text = lines[i]!;
		for (const re of [MARKDOWN_LINK_RE, HTML_LINK_RE]) {
			re.lastIndex = 0;
			let m: RegExpExecArray | null;
			while ((m = re.exec(text))) {
				const href = m[1];
				if (!href) continue;
				const scripture = parseScriptureFromHref(href);
				if (scripture && scripturesEqual(scripture, target)) return i;
			}
		}
	}
	return undefined;
}
