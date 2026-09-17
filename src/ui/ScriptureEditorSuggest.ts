import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, Notice, TFile } from 'obsidian';
import type JwCongregationPlugin from '../main';
import { ScriptureSuggestAction } from '../settings';
import { Scripture } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';
import { findScriptureReferenceAtEnd } from '../normalizer/ScriptureTextParser';
import { buildScriptureQuoteBlock } from '../util/quoteBuilder';
import { L } from '../i18n';

interface ScriptureSuggestItem {
	action: ScriptureSuggestAction;
	label: string;
}

/**
 * Recognizes a scripture reference typed as plain text anywhere in the vault
 * (e.g. "Psalm 12:1") and offers up to four actions right after the last
 * character is typed — link it (a jwlibrary:// link that this plugin's own
 * click handler in main.ts already opens as the offline verse popup),
 * link it AND open it in JW Library immediately, replace it with the full
 * verse text as a quote callout (same offline source as the popup's own
 * "insert as quote" button, see util/quoteBuilder.ts), or insert the quote
 * while turning the typed reference into a link instead of consuming it.
 * Mirrors what JW Library Linker does for its own online quote-insertion,
 * but fully offline. Which of the four are offered, and in what order, is
 * user-configurable (settings.scriptureSuggestActions, see settings.ts).
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
		// Nothing to suggest if the user disabled every action — skip the
		// (otherwise pointless) reference-parsing work on every keystroke.
		if (!this.plugin.settings.scriptureSuggestActions.some(c => c.enabled)) return null;

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
		const labels: Record<ScriptureSuggestAction, string> = {
			'link': t.scriptureSuggestLink,
			'link-open': t.scriptureSuggestLinkAndOpen,
			'quote': t.btnInsertAsQuote,
			'quote-keep-link': t.scriptureSuggestQuoteKeepLink,
		};
		return this.plugin.settings.scriptureSuggestActions
			.filter(config => config.enabled)
			.map(config => ({ action: config.action, label: labels[config.action] }));
	}

	renderSuggestion(item: ScriptureSuggestItem, el: HTMLElement): void {
		el.setText(item.label);
	}

	selectSuggestion(item: ScriptureSuggestItem): void {
		const context = this.context;
		const scripture = this.matchedScripture;
		if (!context || !scripture) return;
		const { editor, start, end, query } = context;

		switch (item.action) {
			case 'link':
				this.insertLink(editor, start, end, query, scripture);
				return;
			case 'link-open':
				this.insertLink(editor, start, end, query, scripture);
				window.open(ScriptureNormalizer.toJwLibraryLink(scripture, this.lang));
				return;
			case 'quote':
				void this.insertQuote(editor, start, end, query, scripture, false);
				return;
			case 'quote-keep-link':
				void this.insertQuote(editor, start, end, query, scripture, true);
				return;
		}
	}

	// Live Preview keeps showing a link's raw "[…](…)" source for as long as the
	// cursor still touches it — and straight after the replacement it sits
	// exactly there, on the closing bracket, so the user was left looking at the
	// markup instead of the finished link (reported from real note-taking). The
	// caret is therefore parked one character past the link. That character is a
	// space the insertion adds itself, unless the line already continues with
	// one, which would otherwise leave a double space mid-sentence.
	private insertLink(editor: Editor, start: EditorPosition, end: EditorPosition, rawText: string, scripture: Scripture): void {
		const link = this.renderLink(rawText, scripture);
		const padding = editor.getLine(end.line).slice(end.ch).startsWith(' ') ? '' : ' ';
		editor.replaceRange(`${link}${padding}`, start, end);
		editor.setCursor({ line: start.line, ch: start.ch + link.length + padding.length });
	}

	/**
	 * An ordinary citation becomes one link carrying the reference exactly as
	 * typed — abbreviation, spacing and all.
	 *
	 * A citation with a gap ("1. Tim. 4:12, 14-16") cannot: JW Library has no
	 * reference syntax that covers a gap, confirmed the hard way against a real
	 * install (see ScriptureNormalizer.bibleParam()). It therefore becomes one
	 * link per stretch of verses, and only the leading label needs the book and
	 * chapter. That prefix is taken from what the user typed — everything up to
	 * the colon, which no book name contains — so linking still never rewrites
	 * their own spelling of the book.
	 */
	private renderLink(rawText: string, scripture: Scripture): string {
		if (!scripture.extraVerses || scripture.extraVerses.length === 0) {
			return `[${rawText}](${ScriptureNormalizer.toJwLibraryLink(scripture, this.lang)})`;
		}
		const colon = rawText.indexOf(':');
		const prefix = colon === -1 ? undefined : rawText.slice(0, colon + 1);
		return ScriptureNormalizer.toMarkdownLink(scripture, this.lang, prefix);
	}

	// keepLink=false replaces the typed reference itself with the quote — the
	// typed text WAS the reference, and per user feedback should disappear
	// entirely once turned into its full quote. keepLink=true instead turns
	// the reference into a link first (like insertLink()) and adds the quote
	// as its own block on the next line, mirroring the popup's own "insert as
	// quote" (see BibleVerseModal), which likewise never consumes the
	// reference it was opened from.
	private async insertQuote(
		editor: Editor, start: EditorPosition, end: EditorPosition, rawText: string, scripture: Scripture, keepLink: boolean,
	): Promise<void> {
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
		const href = ScriptureNormalizer.toJwLibraryLink(scripture, this.lang);
		const quote = buildScriptureQuoteBlock(reference, href, verses);

		if (keepLink) {
			this.insertLink(editor, start, end, rawText, scripture);
			const lineEnd = { line: start.line, ch: editor.getLine(start.line).length };
			const inserted = `\n${quote}`;
			editor.replaceRange(inserted, lineEnd);
			this.moveCursorPastInsertion(editor, lineEnd.line, inserted);
			return;
		}

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
		this.moveCursorPastInsertion(editor, from.line, inserted);
	}

	// Otherwise the cursor sits inside the just-inserted callout, and Live
	// Preview shows it as raw "> [!quote] …" source instead of the styled
	// box until the user clicks elsewhere (see BibleVerseModal's
	// insertAsQuote, which has the same fix for the popup's own button).
	private moveCursorPastInsertion(editor: Editor, startLine: number, insertedText: string): void {
		const lineBreaks = (insertedText.match(/\n/g) ?? []).length;
		editor.setCursor({ line: startLine + lineBreaks, ch: 0 });
	}
}
