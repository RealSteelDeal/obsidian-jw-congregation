import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import type JwCongregationPlugin from '../main';
import { cutSpan, findPluginLinkToRemoveAt, pluginLinkLabel } from '../util/scriptureLinkScan';
import { markBlockKept } from '../util/noteMerge';
import { L } from '../i18n';

type RemoveAction = 'delete' | 'edit' | 'cancel';

interface RemoveSuggestItem {
	action: RemoveAction;
	label: string;
}

/**
 * Offers to finish removing a link this plugin wrote, the moment removing one
 * has begun — the counterpart to ScriptureEditorSuggest, which offers to link
 * a reference the moment one has been typed. Same idea at the opposite end of
 * a link's life: the plugin notices what is happening and offers the tedious
 * part.
 *
 * It appears as soon as the space after an inserted reference is deleted (the
 * caret then sits exactly at the link's end with nothing after it), and stays
 * up while a backspace walks back through the URL — see
 * findPluginLinkToRemoveAt for why those two states, and only those, count as
 * an intention to remove.
 *
 * Three choices, because deleting is not the only reason to reach for a
 * finished link:
 *  - **delete** it outright;
 *  - **adjust** it — the link goes, the text stays and the caret lands at its
 *    end, so a wrong verse or song number is corrected by typing over it
 *    rather than written again from nothing;
 *  - **cancel**, which matters most on a phone, where Escape is awkward to
 *    reach.
 *
 * Covers every link the plugin writes — scripture references as jwlibrary://
 * deep links, songs and source citations as jw.org/finder ones — and nothing
 * else, which is why the options speak of the link rather than naming one
 * kind. An ordinary note link or an outside URL is none of this plugin's
 * business; both halves of that are asserted in tests rather than assumed,
 * since the suggestion offers to delete whatever it fires on.
 *
 * A link inside a generated block would be restored by the next update, so
 * accepting also flags that block through noteMerge.markBlockKept — otherwise
 * correcting a song number would look as though it worked and quietly revert.
 *
 * Why a suggestion rather than the command or the context menu: in editing
 * view the link is rendered, not shown as source, so pressing it opens the
 * verse popup and the caret can hardly be placed inside it — on a phone that
 * made both of those routes unusable (reported 22.09.2026). Deleting, by
 * contrast, is exactly when the keyboard is already in hand.
 */
export class RemoveLinkSuggest extends EditorSuggest<RemoveSuggestItem> {
	constructor(private readonly plugin: JwCongregationPlugin) {
		super(plugin.app);
	}

	onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const span = findPluginLinkToRemoveAt(line, cursor.ch);
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
			{ action: 'delete', label: t.suggestRemoveLink },
			{ action: 'edit', label: t.suggestEditLink },
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
			const label = pluginLinkLabel(span) ?? '';
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
		// A link inside a generated block (a song, the "Anschließend" hint, the
		// scripture field of an imported note) would otherwise be restored by
		// the next "update notes" run, making this change look as though it
		// worked and quietly revert later. Flagging the block tells the merge
		// that this one is the user's — see noteMerge.markBlockKept. A link in
		// the user's own text sits outside every block, where the flag is
		// neither added nor needed.
		this.keepBlock(editor, lineNo);
		editor.setCursor({ line: lineNo, ch: caret });
		this.close();
	}

	/** Marks the generated block this line belongs to as the user's own, so a
	 *  later update leaves it alone. Rewrites the whole note in one go, since
	 *  the flag sits on the block's opening marker, which is usually a
	 *  different line than the one just edited. */
	private keepBlock(editor: Editor, lineNo: number): void {
		const lines = editor.getValue().split('\n');
		const marked = markBlockKept(lines, lineNo);
		if (marked === lines) return; // outside every block — nothing to protect
		const last = lines.length - 1;
		editor.replaceRange(
			marked.join('\n'),
			{ line: 0, ch: 0 },
			{ line: last, ch: lines[last]!.length },
		);
	}
}
