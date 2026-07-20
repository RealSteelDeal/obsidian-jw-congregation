/**
 * Lets a re-import PATCH an already-existing, user-edited note instead of the
 * usual all-or-nothing choice (see NoteBuilder.GeneratedNote.regenerate):
 * NoteBuilder wraps every purely-derived block (day/time/scripture fields,
 * headings, the "Anschließend" hint, …) in an invisible `%%jw:id%% … %%/jw:id%%`
 * marker pair (Obsidian's own comment syntax — never rendered, in either
 * Reading View or Live Preview). mergeNoteContent() then takes the EXISTING
 * file's raw text and a FRESHLY rendered version of the same note (e.g. after
 * a parser bug was fixed) and replaces only the content inside matching
 * marker pairs, leaving every line outside them — including a user's own
 * typed speaker name, personal notes, or an edited YAML frontmatter block —
 * byte-for-byte untouched.
 *
 * Deliberately conservative: any structural mismatch (missing markers,
 * different marker ids/order/count, malformed nesting) makes it return
 * `null` rather than guess at a merge — the caller then falls back to
 * leaving the file alone entirely, exactly like today's plain re-import.
 * This is also why plugin-version notes older than this feature (no markers
 * at all) can never be merged: there's nothing to safely anchor the swap to.
 */

const MARKER_START_RE = /^%%jw:([A-Za-z0-9_-]+)%%$/;
const MARKER_END_RE = /^%%\/jw:([A-Za-z0-9_-]+)%%$/;

interface MarkerBlock {
	id: string;
	startLine: number;
	endLine: number;
}

/** Parses top-level (non-nested — markers never nest in NoteBuilder's own output) marker
 *  pairs out of `lines`, in document order. Returns null on any malformed/unbalanced marker. */
function findMarkerBlocks(lines: string[]): MarkerBlock[] | null {
	const blocks: MarkerBlock[] = [];
	let open: { id: string; startLine: number } | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!.trim();
		const startMatch = MARKER_START_RE.exec(line);
		if (startMatch) {
			if (open) return null; // nested/unclosed marker — not a shape NoteBuilder produces
			open = { id: startMatch[1]!, startLine: i };
			continue;
		}
		const endMatch = MARKER_END_RE.exec(line);
		if (endMatch) {
			if (!open || open.id !== endMatch[1]) return null; // mismatched close
			blocks.push({ id: open.id, startLine: open.startLine, endLine: i });
			open = null;
		}
	}
	if (open) return null; // unclosed at end of file
	return blocks;
}

/** Splits a leading YAML frontmatter block (`---\n…\n---`) off `lines`, if present. */
function splitFrontmatter(lines: string[]): { frontmatterEndLine: number } | null {
	if (lines[0] !== '---') return null;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i] === '---') return { frontmatterEndLine: i };
	}
	return null;
}

/**
 * Merges `fresh` (a newly rendered version of the same note) into `existing`
 * (the file's current on-disk content): the YAML frontmatter block (if both
 * have one — fully machine-generated, see NoteBuilder.frontmatterLines(), so
 * always safe to replace outright) and every matching `%%jw:id%%` region are
 * taken from `fresh`; everything else is kept from `existing` verbatim.
 * Returns null when the two don't line up structurally (see module doc).
 */
/**
 * Wraps whatever `render()` pushes onto `lines` in a `%%jw:id%%` marker pair —
 * used by NoteBuilder to mark every purely-derived block (day/time/scripture
 * fields, headings, the "Anschließend" hint, …) so mergeNoteContent() can
 * later patch just that block in an already-existing note. A no-op (no
 * marker added) when `render()` pushes nothing, so optional fields that
 * don't apply to a given item don't leave behind an empty marker pair.
 */
/** True when `content` has no `%%jw:…%%`/`%%/jw:…%%` marker line at all —
 *  the only case where the legacy-field heuristic (util/legacyFieldPatch.ts)
 *  is safe to attempt as a fallback after mergeNoteContent() returns null.
 *  Any OTHER reason for a null result (corrupted/reordered/mismatched
 *  markers, frontmatter appearing or disappearing) must still be reported as
 *  needing a full re-import and left alone — sweeping a note with damaged
 *  markers into the marker-blind text heuristic could misinterpret content
 *  that's actually inside a broken marker region. */
export function hasNoMarkers(content: string): boolean {
	return !content.split('\n').some(line => {
		const trimmed = line.trim();
		return MARKER_START_RE.test(trimmed) || MARKER_END_RE.test(trimmed);
	});
}

export function pushMarked(lines: string[], id: string, render: () => void): void {
	const start = lines.length;
	render();
	if (lines.length === start) return;
	lines.splice(start, 0, `%%jw:${id}%%`);
	lines.push(`%%/jw:${id}%%`);
}

export function mergeNoteContent(existing: string, fresh: string): string | null {
	const existingLines = existing.split('\n');
	const freshLines = fresh.split('\n');

	const existingFm = splitFrontmatter(existingLines);
	const freshFm = splitFrontmatter(freshLines);
	if (Boolean(existingFm) !== Boolean(freshFm)) return null; // frontmatter appeared/disappeared — unexpected, bail

	const existingBodyStart = existingFm ? existingFm.frontmatterEndLine + 1 : 0;
	const freshBodyStart = freshFm ? freshFm.frontmatterEndLine + 1 : 0;
	const frontmatterPrefix = freshFm ? freshLines.slice(0, freshBodyStart) : [];

	const existingBody = existingLines.slice(existingBodyStart);
	const freshBody = freshLines.slice(freshBodyStart);

	const existingBlocks = findMarkerBlocks(existingBody);
	const freshBlocks = findMarkerBlocks(freshBody);
	if (!existingBlocks || !freshBlocks) return null;
	if (existingBlocks.length === 0 || existingBlocks.length !== freshBlocks.length) return null;
	for (let i = 0; i < existingBlocks.length; i++) {
		if (existingBlocks[i]!.id !== freshBlocks[i]!.id) return null;
	}

	const mergedBody = existingBody.slice();
	// Splice from the end backwards so earlier (not-yet-processed) indices stay valid.
	for (let i = existingBlocks.length - 1; i >= 0; i--) {
		const eb = existingBlocks[i]!;
		const fb = freshBlocks[i]!;
		const freshSpan = freshBody.slice(fb.startLine, fb.endLine + 1);
		mergedBody.splice(eb.startLine, eb.endLine - eb.startLine + 1, ...freshSpan);
	}

	return [...frontmatterPrefix, ...mergedBody].join('\n');
}
