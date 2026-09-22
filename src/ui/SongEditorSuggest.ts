import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import type JwCongregationPlugin from '../main';
import { findSongNumberAtEnd, songFinderUrl } from '../normalizer/songDocIds';
import { L } from '../i18n';

/**
 * Offers to link a song number typed as plain text — "Lied 45" — the same way
 * ScriptureEditorSuggest offers to link a typed scripture reference.
 *
 * This is what makes a corrected song usable. Adjusting a song link leaves
 * its text behind to be typed over, and until this existed the corrected
 * number could not be linked again: the id a song link needs is not derivable
 * from the number (see SONG_DOC_IDS), so there was nothing to build a link
 * from. With the songbook's own table in place there is.
 *
 * Only songs the table knows are offered. A higher number — a songbook newer
 * than the table — gets no suggestion rather than a link that would open the
 * wrong publication, which is the same rule the note builders follow.
 */
export class SongEditorSuggest extends EditorSuggest<string> {
	private songNumber: number | null = null;

	constructor(private readonly plugin: JwCongregationPlugin) {
		super(plugin.app);
	}

	onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
		if (!this.plugin.settings.songSuggest) return null;

		const textBeforeCursor = editor.getLine(cursor.line).slice(0, cursor.ch);
		const match = findSongNumberAtEnd(textBeforeCursor);
		if (!match) return null;

		this.songNumber = match.songNumber;
		return {
			start: { line: cursor.line, ch: match.start },
			end: { line: cursor.line, ch: match.end },
			query: textBeforeCursor.slice(match.start, match.end),
		};
	}

	getSuggestions(_context: EditorSuggestContext): string[] {
		return [L[this.plugin.settings.lang].songSuggestLink];
	}

	renderSuggestion(item: string, el: HTMLElement): void {
		el.setText(item);
	}

	selectSuggestion(): void {
		const context = this.context;
		if (!context || this.songNumber === null) return;
		const url = songFinderUrl(this.songNumber, this.plugin.settings.lang);
		if (!url) return;

		// The typed wording is kept as the link's text, so "Song No. 45" stays
		// "Song No. 45" rather than being rewritten into this plugin's own
		// phrasing — the same restraint the scripture suggestion shows towards
		// a user's spelling of a book name.
		const editor = context.editor;
		const label = editor.getRange(context.start, context.end);
		const link = `[${label}](${url})`;
		// A trailing space with the caret beyond it, exactly as the scripture
		// suggestion does: Live Preview shows a link's source while the caret
		// is still inside it, so without this the user is left looking at the
		// markdown instead of the finished "Lied 120". Skipped when a space is
		// already there, so accepting mid-sentence does not double it.
		const padding = editor.getLine(context.end.line).slice(context.end.ch).startsWith(' ') ? '' : ' ';
		editor.replaceRange(`${link}${padding}`, context.start, context.end);
		editor.setCursor({ line: context.start.line, ch: context.start.ch + link.length + padding.length });
		this.close();
	}
}
