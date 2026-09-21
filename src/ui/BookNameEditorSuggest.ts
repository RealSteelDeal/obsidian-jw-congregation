import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import type JwCongregationPlugin from '../main';
import { findBooksByPrefix } from '../normalizer/bookNames';

/**
 * The word being typed, as a candidate book name: an optional volume ordinal
 * ("1.", "2 ") followed by a capitalised word.
 *
 * **The capital is the whole reason this feature is usable**, not a detail.
 * Measured against the user's own 14 notes (11 975 words) on 21.09.2026,
 * triggering on any word of three or more letters that prefixes a book name
 * fired 93 times, 46 of them on ordinary prose — "mich" alone 30 times, since
 * it prefixes "Micha", plus "offen" for "Offenbarung". Requiring an initial
 * capital, which German gives every noun anyway, cut the false triggers to
 * eight in the whole corpus (only "Mal" and "Juda"). Do not relax this to
 * case-insensitive matching without measuring again.
 */
const TYPED_BOOK_PREFIX_RE = /((?:[123]\.?\s*)?\p{Lu}[\p{L}.]*)$/u;

// Below this, a prefix matches so many books that the list is noise rather
// than a shortcut — and "Da"/"Am"/"Es" are ordinary words besides.
const MIN_PREFIX_LENGTH = 3;

/**
 * Completes a Bible book name while it is being typed: "Apo" offers
 * "Apostelgeschichte". Accepting inserts the full name and a space, leaving
 * the chapter and verse to be typed — at which point ScriptureEditorSuggest
 * takes over with link/quote (per user's choice, 21.09.2026: no colon is
 * inserted, the two steps stay separate).
 *
 * A second suggester rather than another mode inside ScriptureEditorSuggest:
 * that one only ever fires on a COMPLETE reference and its whole contract
 * (see findScriptureReferenceAtEnd) is "the reference ends here". Folding a
 * partial-word trigger into it would tangle two unrelated conditions in one
 * onTrigger.
 */
export class BookNameEditorSuggest extends EditorSuggest<{ book: number; name: string }> {

	constructor(private readonly plugin: JwCongregationPlugin) {
		super(plugin.app);
	}

	onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
		if (!this.plugin.settings.bookNameSuggest) return null;

		const line = editor.getLine(cursor.line);
		// Only at the end of a word. Standing inside an already-written name
		// ("Apostel|geschichte") is editing, not typing a new reference.
		if (/[\p{L}\p{N}]/u.test(line.charAt(cursor.ch))) return null;

		const typed = TYPED_BOOK_PREFIX_RE.exec(line.slice(0, cursor.ch))?.[1];
		if (!typed) return null;
		if (typed.replace(/[^\p{L}\p{N}]/gu, '').length < MIN_PREFIX_LENGTH) return null;
		if (findBooksByPrefix(typed, this.plugin.settings.lang).length === 0) return null;

		return {
			start: { line: cursor.line, ch: cursor.ch - typed.length },
			end: cursor,
			query: typed,
		};
	}

	getSuggestions(context: EditorSuggestContext): { book: number; name: string }[] {
		return findBooksByPrefix(context.query, this.plugin.settings.lang);
	}

	renderSuggestion(item: { book: number; name: string }, el: HTMLElement): void {
		el.setText(item.name);
	}

	selectSuggestion(item: { book: number; name: string }): void {
		const context = this.context;
		if (!context) return;
		// The trailing space is what the user would type next anyway, and it
		// puts the caret where the chapter goes.
		context.editor.replaceRange(`${item.name} `, context.start, context.end);
	}
}
