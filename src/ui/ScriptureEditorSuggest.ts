import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, Notice, TFile } from 'obsidian';
import type JwCongregationPlugin from '../main';
import { Scripture } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';
import { findScriptureReferenceAtEnd } from '../normalizer/ScriptureTextParser';
import { buildScriptureQuoteBlock } from '../util/quoteBuilder';
import { L } from '../i18n';

type SuggestAction = 'link' | 'quote';

interface ScriptureSuggestItem {
	action: SuggestAction;
	label: string;
}

/**
 * Recognizes a scripture reference typed as plain text anywhere in the vault
 * (e.g. "Psalm 12:1") and offers two actions right after the last character is
 * typed — link it (a jwlibrary:// link that this plugin's own click handler
 * in main.ts already opens as the offline verse popup) or replace it with the
 * full verse text as a quote callout (same offline source as the popup's own
 * "insert as quote" button, see util/quoteBuilder.ts). Mirrors what JW
 * Library Linker does for its own online quote-insertion, but fully offline.
 *
 * Recognizes full book names (in settings.lang) and common truncated
 * abbreviations ("Matth.", "Ps", "1 Mo", …) — see bookNames.ts's
 * lookupBookNumber doc comment for exactly which forms resolve.
 */
export class ScriptureEditorSuggest extends EditorSuggest<ScriptureSuggestItem> {

	private matchedScripture: Scripture | null = null;

	constructor(private readonly plugin: JwCongregationPlugin) {
		super(plugin.app);
	}

	private get lang() {
		return this.plugin.settings.lang;
	}

	onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const textBeforeCursor = line.slice(0, cursor.ch);
		const match = findScriptureReferenceAtEnd(textBeforeCursor, this.lang);
		if (!match) return null;

		this.matchedScripture = match.scripture;
		return {
			start: { line: cursor.line, ch: match.start },
			end: { line: cursor.line, ch: match.end },
			query: textBeforeCursor.slice(match.start, match.end),
		};
	}

	getSuggestions(_context: EditorSuggestContext): ScriptureSuggestItem[] {
		const t = L[this.lang];
		return [
			{ action: 'link', label: t.scriptureSuggestLink },
			{ action: 'quote', label: t.btnInsertAsQuote },
		];
	}

	renderSuggestion(item: ScriptureSuggestItem, el: HTMLElement): void {
		el.setText(item.label);
	}

	selectSuggestion(item: ScriptureSuggestItem): void {
		const context = this.context;
		const scripture = this.matchedScripture;
		if (!context || !scripture) return;

		if (item.action === 'link') {
			this.insertLink(context.editor, context.start, context.end, context.query, scripture);
			return;
		}
		void this.insertQuote(context.editor, context.start, context.end, context.query, scripture);
	}

	private insertLink(editor: Editor, start: EditorPosition, end: EditorPosition, rawText: string, scripture: Scripture): void {
		const href = ScriptureNormalizer.toJwLibraryLink(scripture, this.lang);
		editor.replaceRange(`[${rawText}](${href})`, start, end);
	}

	// Replaces the typed reference itself with the quote — unlike the
	// popup's own "insert as quote" (see BibleVerseModal), which appends next
	// to an existing link rather than consuming it, there's no separate link
	// to preserve here: the typed text WAS the reference, and per user
	// feedback should disappear entirely once turned into its full quote.
	private async insertQuote(editor: Editor, start: EditorPosition, end: EditorPosition, rawText: string, scripture: Scripture): Promise<void> {
		const reader = await this.plugin.getBibleReader();
		const verses = reader ? await reader.getVerseDetails(scripture) : undefined;
		if (!reader || !verses || verses.length === 0) {
			// No local verse text available (no Bible file loaded, or this
			// passage isn't indexed) — fall back to the link, which always
			// works, rather than leaving the typed reference untouched.
			this.insertLink(editor, start, end, rawText, scripture);
			if (!reader) new Notice(L[this.lang].noticeQuoteNeedsBibleFile);
			return;
		}
		const reference = ScriptureNormalizer.format(scripture, this.lang);
		const quote = buildScriptureQuoteBlock(reference, verses);

		// A callout's "> [!quote]" only parses at the start of a line. When the
		// reference was typed mid-line ("siehe Psalm 15:2"), the preceding text
		// stays and the quote moves to its own fresh line below it; leading
		// whitespace-only indentation is swallowed instead, so the callout
		// really starts at column 0 either way.
		const textBefore = editor.getLine(start.line).slice(0, start.ch);
		const onOwnLine = textBefore.trim() === '';
		const from = onOwnLine ? { line: start.line, ch: 0 } : start;
		const inserted = onOwnLine ? quote : `\n${quote}`;
		editor.replaceRange(inserted, from, end);
		// Otherwise the cursor sits inside the just-inserted callout, and Live
		// Preview shows it as raw "> [!quote] …" source instead of the styled
		// box until the user clicks elsewhere (see BibleVerseModal's
		// insertAsQuote, which has the same fix for the popup's own button).
		const lineBreaks = (inserted.match(/\n/g) ?? []).length;
		editor.setCursor({ line: from.line + lineBreaks, ch: 0 });
	}
}
