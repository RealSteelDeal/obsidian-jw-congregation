import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import type JwCongregationPlugin from '../main';
import { cutSpan, findScriptureLinkToRemoveAt, scriptureLinkLabel } from '../util/scriptureLinkScan';
import { L } from '../i18n';

type RemoveAction = 'delete' | 'edit' | 'cancel';

interface RemoveSuggestItem {
	action: RemoveAction;
	label: string;
}

/**
 * Offers to finish deleting a scripture reference, the moment deleting one
 * has begun — the counterpart to ScriptureEditorSuggest, which offers to
 * link a reference the moment one has been typed. Same idea at the opposite
 * end of a reference's life: the plugin notices what is happening and offers
 * the tedious part.
 *
 * It appears as soon as the space after an inserted reference is deleted
 * (the caret then sits exactly at the link's end with nothing after it), and
 * stays up while a backspace walks back through the URL — see
 * findScriptureLinkToRemoveAt for why those two states, and only those,
 * count as an intention to delete.
 *
 * Three choices, because deleting is not the only reason to reach for a
 * finished reference:
 *  - **delete** it outright;
 *  - **edit** it — the link goes, the text stays and the caret lands at its
 *    end, so a wrong verse is corrected by typing over it rather than written
 *    again from nothing, and the ordinary suggestion then offers to link the
 *    corrected reference straight away;
 *  - **cancel**, which matters most on a phone, where Escape is awkward to
 *    reach.
 *
 * Every option names the reference explicitly ("delete scripture reference"),
 * because this fires on scripture links only: songs and source citations are
 * deliberately written as https://www.jw.org/finder links rather than
 * jwlibrary:// ones (see NoteBuilder.songLink), so they can never reach this
 * — asserted in tests rather than assumed, since the suggestion offers to
 * delete whatever it fires on.
 *
 * Why a suggestion rather than the command or the context menu: in editing
 * view the link is rendered, not shown as source, so pressing it opens the
 * verse popup and the caret can hardly be placed inside it — on a phone that
 * made both of those routes unusable (reported 22.09.2026). Deleting, by
 * contrast, is exactly when the keyboard is already in hand.
 */
export class RemoveScriptureLinkSuggest extends EditorSuggest<RemoveSuggestItem> {
	constructor(private readonly plugin: JwCongregationPlugin) {
		super(plugin.app);
	}

	onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const span = findScriptureLinkToRemoveAt(line, cursor.ch);
		if (!span) return null;
		return {
			start: { line: cursor.line, ch: span.start },
			end: { line: cursor.line, ch: span.end },
			query: line.slice(span.start, span.end),
		};
	}

	getSuggestions(_context: EditorSuggestContext): RemoveSuggestItem[] {
		const t = L[this.plugin.settings.lang];
		return [
			{ action: 'delete', label: t.suggestRemoveScriptureLink },
			{ action: 'edit', label: t.suggestEditScripture },
			{ action: 'cancel', label: t.btnCancel },
		];
	}

	renderSuggestion(item: RemoveSuggestItem, el: HTMLElement): void {
		el.setText(item.label);
	}

	selectSuggestion(item: RemoveSuggestItem): void {
		const context = this.context;
		if (!context) return;
		if (item.action === 'cancel') {
			this.close();
			return;
		}

		const editor = context.editor;
		const lineNo = context.start.line;
		const line = editor.getLine(lineNo);
		const span = line.slice(context.start.ch, context.end.ch);

		let updated: string;
		let caret: number;
		if (item.action === 'edit') {
			// Only the link is dropped; the text stays and the caret lands at
			// its end, so a wrong verse is corrected by typing over it — and
			// the ordinary suggestion then offers to link it again. The label
			// may be missing if the deletion already ate through it, in which
			// case there is nothing left to adjust.
			const label = scriptureLinkLabel(span) ?? '';
			updated = line.slice(0, context.start.ch) + label + line.slice(context.end.ch);
			caret = context.start.ch + label.length;
		} else {
			// Rewritten through cutSpan rather than replacing the range with an
			// empty string, so a reference removed from mid-sentence does not
			// leave the double space behind — the same tidying the command
			// does, and the same restraint about everything else around it.
			updated = cutSpan(line, context.start.ch, context.end.ch - context.start.ch);
			caret = Math.min(context.start.ch, updated.length);
		}

		editor.replaceRange(updated, { line: lineNo, ch: 0 }, { line: lineNo, ch: line.length });
		editor.setCursor({ line: lineNo, ch: caret });
		this.close();
	}
}
