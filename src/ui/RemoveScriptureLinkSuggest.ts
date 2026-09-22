import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import type JwCongregationPlugin from '../main';
import { cutSpan, findBrokenScriptureLinkAt } from '../util/scriptureLinkScan';
import { L } from '../i18n';

/**
 * Offers to finish deleting a scripture reference, the moment deleting one
 * has begun — the counterpart to ScriptureEditorSuggest, which offers to
 * link a reference the moment one has been typed. Same idea at the opposite
 * end of a reference's life: the plugin notices what is happening and offers
 * the tedious part.
 *
 * The trigger is the first backspace over a reference's closing `)`, which
 * leaves `[1. Tim. 4:12](jwlibrary://…` behind — an unambiguous signal,
 * since that is not a shape anyone types on purpose (see
 * findBrokenScriptureLinkAt). Accepting removes what is left of the link in
 * one step, instead of holding backspace through a URL.
 *
 * Why this rather than a command or a menu entry: in editing view the link
 * is rendered, not shown as source, so pressing it opens the verse popup and
 * the caret can hardly be placed inside it — on a phone that made both of
 * those routes unusable (reported 22.09.2026). Deleting, by contrast, is
 * exactly when the user has already reached for the keyboard.
 */
export class RemoveScriptureLinkSuggest extends EditorSuggest<string> {
	constructor(private readonly plugin: JwCongregationPlugin) {
		super(plugin.app);
	}

	onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const broken = findBrokenScriptureLinkAt(line, cursor.ch);
		if (!broken) return null;
		return {
			start: { line: cursor.line, ch: broken.start },
			end: { line: cursor.line, ch: broken.end },
			query: line.slice(broken.start, broken.end),
		};
	}

	getSuggestions(_context: EditorSuggestContext): string[] {
		return [L[this.plugin.settings.lang].suggestRemoveScriptureLink];
	}

	renderSuggestion(item: string, el: HTMLElement): void {
		el.setText(item);
	}

	selectSuggestion(): void {
		const context = this.context;
		if (!context) return;
		const editor = context.editor;
		const line = editor.getLine(context.start.line);
		// Rewritten through cutSpan rather than replacing the range with an
		// empty string, so a reference removed from mid-sentence does not leave
		// the double space behind — the same tidying the command does, and the
		// same restraint about everything else around it.
		const updated = cutSpan(line, context.start.ch, context.end.ch - context.start.ch);
		editor.replaceRange(updated, { line: context.start.line, ch: 0 }, { line: context.start.line, ch: line.length });
		editor.setCursor({ line: context.start.line, ch: Math.min(context.start.ch, updated.length) });
		this.close();
	}
}
