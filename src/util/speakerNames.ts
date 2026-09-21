/**
 * Turning the free-text Speaker field into wiki links — the grouping half,
 * kept pure so it can be tested without a vault (see tests/speakerNames.test.mjs).
 *
 * The plugin never fills the Speaker field in: NoteBuilder writes the bare
 * label and the name is typed by hand, so the same person appears as "Br.
 * Sieberer", "Hannes Sieberer" and "Sieberer Hannes" in three different
 * notes. A directory built by parsing that text would have to re-decide on
 * every run which spellings mean the same brother — and would eventually
 * merge two people or split one, silently.
 *
 * So this does not decide anything. It PROPOSES groups, once, and the user
 * confirms them (SpeakerLinkModal); what gets written afterwards is a wiki
 * link to one agreed name, which Obsidian then resolves on its own forever
 * after. The heuristic below therefore only has to be good enough to sort a
 * list for review — a missed grouping costs one extra confirmation, never a
 * wrong merge.
 */

/** Forms of address that precede a name and say nothing about who it is.
 *  Deliberately covers all seven supported note languages at once: the field
 *  is free text, so nothing guarantees it was written in the note's own
 *  language, and stripping a word too many only ever splits a group that the
 *  user can still merge by hand. */
const HONORIFICS = new Set([
	'br', 'bro', 'bruder', 'brother', 'schw', 'schwester', 'sister', 'sr',
	'frere', 'frère', 'soeur', 'sœur', 'fratello', 'sorella',
	'irmao', 'irmão', 'irma', 'irmã', 'hermano', 'hermana', 'hno', 'hna',
	'брат', 'сестра',
]);

/** One place a name was found: which note, and exactly how it was written. */
export interface SpeakerOccurrence {
	path: string;
	/** Zero-based line index within that note. */
	line: number;
	/** The name as typed, untouched — what gets preserved as the link's
	 *  display text so the migration changes nothing the reader sees. */
	text: string;
}

/** A set of spellings proposed as one and the same person. */
export interface SpeakerGroup {
	/** The spelling suggested as the link target: the most complete one
	 *  found. Always overridable in the review dialog — this is the one
	 *  decision that should be the user's. */
	suggested: string;
	/** Every distinct spelling in this group, most frequent first. */
	variants: string[];
	occurrences: SpeakerOccurrence[];
	/** True when this group's name is a shortening that fits more than one
	 *  other group ("Br. Hannes" where both Hannes Sieberer and Hannes Müller
	 *  exist). Kept separate rather than assigned to whichever matched first,
	 *  and flagged so the dialog can say why it was left alone. */
	ambiguous: boolean;
}

/** Comparable words of a name: honorifics dropped, case and punctuation
 *  ignored. Order is NOT preserved — "Sieberer Hannes" and "Hannes Sieberer"
 *  produce the same set, which is the whole point. */
export function nameTokens(name: string): Set<string> {
	const tokens = name
		.toLowerCase()
		.replace(/[.,;:()[\]{}"'`]/g, ' ')
		.split(/\s+/)
		.filter(token => token.length > 0 && !HONORIFICS.has(token));
	return new Set(tokens);
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
	for (const token of a) {
		if (!b.has(token)) return false;
	}
	return true;
}

/**
 * Proposes which of the spellings found belong together.
 *
 * Two spellings are treated as one person when one's words are contained in
 * the other's — which is what makes "Br. Sieberer" reach "Hannes Sieberer"
 * while "Hannes Müller" stays separate. A shortening that fits several
 * groups at once is never assigned to one of them: it is returned on its own
 * with `ambiguous`, because picking would be a guess and guessing is the
 * failure this whole approach exists to avoid.
 */
export function groupSpeakerVariants(occurrences: SpeakerOccurrence[]): SpeakerGroup[] {
	const byText = new Map<string, SpeakerOccurrence[]>();
	for (const occurrence of occurrences) {
		const text = occurrence.text.trim();
		if (text.length === 0) continue;
		const list = byText.get(text);
		if (list) list.push(occurrence);
		else byText.set(text, [occurrence]);
	}

	const entries = [...byText.entries()]
		.map(([text, list]) => ({ text, list, tokens: nameTokens(text) }))
		.filter(entry => entry.tokens.size > 0)
		// Most complete spellings first, so a group is anchored by a full name
		// rather than by whichever abbreviation happened to come first.
		.sort((a, b) => b.tokens.size - a.tokens.size || b.list.length - a.list.length || a.text.localeCompare(b.text));

	interface Building { tokens: Set<string>; entries: typeof entries }
	const groups: Building[] = [];

	for (const entry of entries) {
		const matches = groups.filter(group => isSubset(entry.tokens, group.tokens) || isSubset(group.tokens, entry.tokens));
		if (matches.length === 1) {
			matches[0]!.entries.push(entry);
			// A longer spelling widens the group it joins, so a later, shorter
			// one is still recognised against the fuller name.
			for (const token of entry.tokens) matches[0]!.tokens.add(token);
		} else {
			// No match, or several — both mean "start your own group". The
			// several case is what `ambiguous` reports below.
			groups.push({ tokens: new Set(entry.tokens), entries: [entry] });
		}
	}

	return groups.map(group => {
		const sorted = [...group.entries].sort(
			(a, b) => b.list.length - a.list.length || b.tokens.size - a.tokens.size || a.text.localeCompare(b.text),
		);
		const fullest = [...group.entries].sort(
			(a, b) => b.tokens.size - a.tokens.size || b.list.length - a.list.length || a.text.localeCompare(b.text),
		)[0]!;
		const ambiguous = group.entries.length === 1
			&& groups.some(other => other !== group && isSubset(group.tokens, other.tokens));
		return {
			suggested: fullest.text,
			variants: sorted.map(entry => entry.text),
			occurrences: group.entries.flatMap(entry => entry.list),
			ambiguous,
		};
	});
}

/** A wiki link to `target`, keeping `original` as the visible text whenever
 *  the two differ — so converting a name to a link never changes a single
 *  character the reader sees, only what Obsidian resolves underneath. */
export function speakerLink(target: string, original: string): string {
	return target === original ? `[[${target}]]` : `[[${target}|${original}]]`;
}

/** The same as speakerLineValue(), tried against every label a note could
 *  carry. A vault can hold notes imported in several languages, and nothing
 *  records which language any one note was written in — so all of them are
 *  tried rather than guessed between. */
export function findSpeakerValue(line: string, labels: string[]): string | null {
	for (const label of labels) {
		const value = speakerLineValue(line, label);
		if (value !== null) return value;
	}
	return null;
}

/** Rewrites a Speaker line to carry `replacement` as its value, keeping the
 *  label exactly as the note spells it. */
export function replaceSpeakerValue(line: string, replacement: string): string {
	const end = line.indexOf(':**');
	if (end === -1) return line;
	return `${line.slice(0, end + 3)} ${replacement}`;
}

/** Matches a written-out Speaker line, e.g. `**Redner:** Br. Sieberer`. The
 *  label comes from the note's own language (NoteStrings.speakerLabel), and
 *  a line whose value is empty or already a link is deliberately not matched:
 *  those are the two cases with nothing to convert. */
export function speakerLineValue(line: string, label: string): string | null {
	const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const match = new RegExp(`^\\*\\*${escaped}:\\*\\*(.*)$`).exec(line);
	if (!match) return null;
	// Trimmed separately rather than in the pattern: `(.+?)\s*$` backtracks on
	// a label followed by nothing but a space and hands back that space as if
	// it were a name.
	const value = match[1]!.trim();
	if (value.length === 0) return null;
	if (value.includes('[[')) return null;
	return value;
}
