import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const {
	findFirstScriptureLinkInText, findLineWithScripture, findQuoteBlockRange, findQuoteInsertionPoint,
	findScriptureLinkInText, findScriptureLinkSpan, findPluginLinkSpanAt, solePluginLinkSpan,
	findBrokenPluginLinkAt, findPluginLinkToRemoveAt, pluginLinkLabel, cutSpan, parseScriptureFromHref,
} = await jiti.import('../src/util/scriptureLinkScan.ts');

const PSALM_1_1_LINK = '[Psalm 1:1](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=19001001&pub=nwtsty)';
const MATTHEW_5_1_HTML_LINK = '<a href="jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=40005001&pub=nwtsty">Matthäus 5:1</a>';

test('parseScriptureFromHref reads the bible= param of a jwlibrary link', () => {
	const href = 'jwlibrary:///finder?srcid=jwlshare&wtlocale=X&bible=19001001&pub=nwtsty';
	assert.deepEqual(parseScriptureFromHref(href), { book: 19, chapter: 1, verseStart: 1 });
});

test('findScriptureLinkInText finds a markdown-form link covering the given offset', () => {
	const text = `Siehe ${PSALM_1_1_LINK} für mehr.`;
	const offset = text.indexOf('Psalm');
	const found = findScriptureLinkInText(text, offset);
	assert.ok(found);
	assert.deepEqual(found.scripture, { book: 19, chapter: 1, verseStart: 1 });
});

test('findFirstScriptureLinkInText finds a link regardless of the given position (unlike findScriptureLinkInText)', () => {
	const text = `> [!quote] ${PSALM_1_1_LINK}`;
	const found = findFirstScriptureLinkInText(text);
	assert.ok(found);
	assert.deepEqual(found.scripture, { book: 19, chapter: 1, verseStart: 1 });
});

test('findFirstScriptureLinkInText returns undefined when the text has no scripture link at all', () => {
	assert.equal(findFirstScriptureLinkInText('Kein Link hier.'), undefined);
});

test('findLineWithScripture finds the line whose markdown link matches the target scripture', () => {
	const lines = [
		'Bibeltexte: (Matthäus 12:1-14)',
		'Redner:',
		'',
		'',
		'',
		PSALM_1_1_LINK,
	];
	const line = findLineWithScripture(lines, { book: 19, chapter: 1, verseStart: 1 });
	assert.equal(line, 5);
});

test('findLineWithScripture also finds the raw-HTML link form used by the overview note', () => {
	const lines = ['## Vormittag', `- **9:40** – ${MATTHEW_5_1_HTML_LINK}`];
	const line = findLineWithScripture(lines, { book: 40, chapter: 5, verseStart: 1 });
	assert.equal(line, 1);
});

test('findLineWithScripture returns undefined when no link matches the target scripture', () => {
	const lines = [PSALM_1_1_LINK];
	const line = findLineWithScripture(lines, { book: 40, chapter: 5, verseStart: 1 });
	assert.equal(line, undefined);
});

test('findLineWithScripture does not match a link for a different verse range of the same book/chapter', () => {
	const lines = ['[Psalm 1:1-3](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&bible=19001001-19001003&pub=nwtsty)'];
	const line = findLineWithScripture(lines, { book: 19, chapter: 1, verseStart: 1 });
	assert.equal(line, undefined);
});

test('findQuoteBlockRange finds a single-line quote callout body (start inclusive, end exclusive)', () => {
	const lines = [
		'Ist ewiges Glück möglich?',
		`> [!quote] ${PSALM_1_1_LINK}`,
		'> 1 Glücklich ist der Mensch …',
		'',
		'Nächster Absatz',
	];
	const range = findQuoteBlockRange(lines, { book: 19, chapter: 1, verseStart: 1 });
	assert.deepEqual(range, { start: 1, end: 3 });
});

test('findQuoteBlockRange consumes every immediately-following blockquote line', () => {
	const lines = [
		`> [!quote] ${PSALM_1_1_LINK}`,
		'> 1 Erste Zeile',
		'> 2 Zweite Zeile',
		'Kein Blockquote mehr',
	];
	const range = findQuoteBlockRange(lines, { book: 19, chapter: 1, verseStart: 1 });
	assert.deepEqual(range, { start: 0, end: 3 });
});

test('findQuoteBlockRange ignores a plain inline reference (no "> [!quote]" start)', () => {
	const lines = [PSALM_1_1_LINK];
	const range = findQuoteBlockRange(lines, { book: 19, chapter: 1, verseStart: 1 });
	assert.equal(range, undefined);
});

test('findQuoteBlockRange returns undefined once the callout no longer matches (e.g. edited away)', () => {
	const lines = ['Kein Zitat hier', 'auch keins'];
	const range = findQuoteBlockRange(lines, { book: 19, chapter: 1, verseStart: 1 });
	assert.equal(range, undefined);
});

test('findQuoteBlockRange extends to the end of the document when the callout is the last content', () => {
	const lines = [`> [!quote] ${PSALM_1_1_LINK}`, '> 1 Glücklich ist der Mensch …'];
	const range = findQuoteBlockRange(lines, { book: 19, chapter: 1, verseStart: 1 });
	assert.deepEqual(range, { start: 0, end: 2 });
});

// Regression test for a reported bug: opening the popup by clicking an
// EXISTING quote's title, navigating to a cross-reference inside it, then
// "insert as quote" for that cross-reference landed the new callout right
// after the existing one's TITLE line — inside its own blockquote — instead
// of after the whole callout, corrupting both (the existing callout's body
// ended up orphaned into its own bare, title-less blockquote underneath).
test('findQuoteInsertionPoint skips past an existing quote callout entirely, not just its title line', () => {
	const lines = [
		`> [!quote] ${PSALM_1_1_LINK}`,
		'> 1 Glücklich ist der Mensch …',
		'Nächster Absatz',
	];
	const point = findQuoteInsertionPoint(lines, { book: 19, chapter: 1, verseStart: 1 });
	assert.deepEqual(point, { line: 1, separator: '\n\n' });
});

test('findQuoteInsertionPoint uses a single-newline separator for a plain inline reference (not a callout)', () => {
	const lines = ['Bibeltexte: (Matthäus 12:1-14)', PSALM_1_1_LINK, 'Redner:'];
	const point = findQuoteInsertionPoint(lines, { book: 19, chapter: 1, verseStart: 1 });
	assert.deepEqual(point, { line: 1, separator: '\n' });
});

test('findQuoteInsertionPoint returns undefined when the target scripture is not linked anywhere', () => {
	const lines = ['Kein Link hier.'];
	const point = findQuoteInsertionPoint(lines, { book: 19, chapter: 1, verseStart: 1 });
	assert.equal(point, undefined);
});

const PHIL_LINK = '[Phil. 4:6,7](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=50004006-50004007&pub=nwtsty)';

test('findScriptureLinkSpan returns the exact span and the label as written', () => {
	const text = `Siehe ${PHIL_LINK} dazu`;
	const span = findScriptureLinkSpan(text, { book: 50, chapter: 4, verseStart: 6, verseEnd: 7 });
	assert.ok(span);
	assert.equal(text.slice(span.index, span.index + span.length), PHIL_LINK);
	// The label carries the user's own abbreviation, which is what lets a
	// caller rewrite the reference without expanding "Phil." to "Philipper".
	assert.equal(span.label, 'Phil. 4:6,7');
});

test('findScriptureLinkSpan picks the matching link, not the first one on the line', () => {
	const text = `${PSALM_1_1_LINK} und ${PHIL_LINK}`;
	const span = findScriptureLinkSpan(text, { book: 50, chapter: 4, verseStart: 6, verseEnd: 7 });
	assert.ok(span);
	assert.equal(text.slice(span.index, span.index + span.length), PHIL_LINK);
});

test('findScriptureLinkSpan returns undefined when no link matches the target', () => {
	assert.equal(findScriptureLinkSpan(PSALM_1_1_LINK, { book: 50, chapter: 4, verseStart: 6 }), undefined);
	assert.equal(findScriptureLinkSpan('Kein Link hier.', { book: 19, chapter: 1, verseStart: 1 }), undefined);
});

test('findScriptureLinkSpan skips a raw-HTML anchor, which has no label to rewrite', () => {
	// The overview note writes anchors rather than markdown links; those carry
	// no "[label]" and must not be offered up as something to replace in place.
	const html = '<a href="jwlibrary:///finder?bible=19001001">Psalm 1:1</a>';
	assert.equal(findScriptureLinkSpan(html, { book: 19, chapter: 1, verseStart: 1 }), undefined);
});

// ── Removing the reference under the cursor ───────────────────────────────
// A typed reference turns into a long markdown link, so deleting it by hand
// means backspacing through a URL nobody wants to read (reported 22.09.2026).

test('findPluginLinkSpanAt covers the whole link, from the first bracket to the last', () => {
	const text = `Siehe ${PSALM_1_1_LINK} für mehr.`;
	const span = findPluginLinkSpanAt(text, text.indexOf('Psalm'));
	assert.equal(span.index, text.indexOf('['));
	assert.equal(span.length, PSALM_1_1_LINK.length);
	assert.equal(text.slice(span.index, span.index + span.length), PSALM_1_1_LINK);
});

test('findPluginLinkSpanAt works from anywhere inside the link, including its ends', () => {
	const text = `Siehe ${PSALM_1_1_LINK} für mehr.`;
	const start = text.indexOf('[');
	const end = start + PSALM_1_1_LINK.length;
	for (const offset of [start, start + 3, text.indexOf('jwlibrary'), end]) {
		assert.ok(findPluginLinkSpanAt(text, offset), `offset ${offset}`);
	}
});

test('findPluginLinkSpanAt returns nothing when the cursor is outside any link', () => {
	const text = `Siehe ${PSALM_1_1_LINK} für mehr.`;
	assert.equal(findPluginLinkSpanAt(text, 0), undefined);
	assert.equal(findPluginLinkSpanAt(text, text.length - 1), undefined);
	assert.equal(findPluginLinkSpanAt('Ganz ohne Link.', 5), undefined);
});

test('findPluginLinkSpanAt picks the link the cursor is in, not the first on the line', () => {
	// A line often holds several references; removing the wrong one would be
	// the worst possible outcome of a delete command.
	const second = PSALM_1_1_LINK.replace('19001001', '19002002').replace('Psalm 1:1', 'Psalm 2:2');
	const text = `${PSALM_1_1_LINK} und ${second}`;
	const span = findPluginLinkSpanAt(text, text.indexOf('Psalm 2:2'));
	assert.equal(text.slice(span.index, span.index + span.length), second);
});

test('cutSpan removes the link and collapses the double space it would leave behind', () => {
	const text = `Lesen wir ${PSALM_1_1_LINK} dazu.`;
	const span = findPluginLinkSpanAt(text, text.indexOf('Psalm'));
	assert.equal(cutSpan(text, span.index, span.length), 'Lesen wir dazu.');
});

test('cutSpan leaves surrounding punctuation exactly as it was written', () => {
	// Brackets the reference stood in are the user's own sentence, not part of
	// the reference — tidying them would be editing their text.
	const text = `Vortrag (${PSALM_1_1_LINK}), danach Lied.`;
	const span = findPluginLinkSpanAt(text, text.indexOf('Psalm'));
	assert.equal(cutSpan(text, span.index, span.length), 'Vortrag (), danach Lied.');
});

test('cutSpan keeps a single leading or trailing space rather than joining words', () => {
	const atEnd = `Siehe ${PSALM_1_1_LINK}`;
	const spanEnd = findPluginLinkSpanAt(atEnd, atEnd.indexOf('Psalm'));
	assert.equal(cutSpan(atEnd, spanEnd.index, spanEnd.length), 'Siehe ');

	const atStart = `${PSALM_1_1_LINK} steht dort.`;
	const spanStart = findPluginLinkSpanAt(atStart, atStart.indexOf('Psalm'));
	assert.equal(cutSpan(atStart, spanStart.index, spanStart.length), ' steht dort.');
});

test('findPluginLinkSpanAt also finds the raw-HTML link form the overview notes use', () => {
	const text = `Programm: ${MATTHEW_5_1_HTML_LINK} danach`;
	const span = findPluginLinkSpanAt(text, text.indexOf('Matthäus'));
	assert.equal(text.slice(span.index, span.index + span.length), MATTHEW_5_1_HTML_LINK);
});

test('solePluginLinkSpan returns the only reference on a line', () => {
	// The caret can hardly be placed inside a rendered link on a phone, so a
	// line with one reference has to work from anywhere on it.
	const text = `Lesen wir ${PSALM_1_1_LINK} dazu.`;
	const span = solePluginLinkSpan(text);
	assert.equal(text.slice(span.index, span.index + span.length), PSALM_1_1_LINK);
});

test('solePluginLinkSpan refuses a line with two references rather than picking one', () => {
	const second = PSALM_1_1_LINK.replace('19001001', '19002002').replace('Psalm 1:1', 'Psalm 2:2');
	assert.equal(solePluginLinkSpan(`${PSALM_1_1_LINK} und ${second}`), undefined);
});

test('solePluginLinkSpan returns nothing for a line without any reference', () => {
	assert.equal(solePluginLinkSpan('Ein Satz ganz ohne Bibelstelle.'), undefined);
});

// ── Noticing that a reference is being deleted ────────────────────────────
// The suggestion that offers to finish the job (RemoveScriptureLinkSuggest)
// hangs entirely off this: it must fire on the first backspace over a
// reference's closing bracket, and stay quiet the rest of the time.

test('findBrokenPluginLinkAt fires the moment the closing bracket is deleted', () => {
	const line = `Lesen wir ${PSALM_1_1_LINK} dazu.`;
	// Exactly what one backspace at the end of the link leaves behind.
	const broken = line.replace(')', '');
	const ch = broken.indexOf(' dazu.');
	const hit = findBrokenPluginLinkAt(broken, ch);
	assert.equal(hit.start, broken.indexOf('['));
	assert.equal(hit.end, ch);
});

test('findBrokenPluginLinkAt stays quiet while the link is still intact', () => {
	// Including with the caret inside the URL: nothing is being deleted there,
	// and offering to remove a reference merely being passed through is noise.
	const line = `Lesen wir ${PSALM_1_1_LINK} dazu.`;
	for (const ch of [0, line.indexOf('Psalm'), line.indexOf('bible='), line.length]) {
		assert.equal(findBrokenPluginLinkAt(line, ch), undefined, `ch ${ch}`);
	}
});

test('findBrokenPluginLinkAt ignores ordinary text and other links', () => {
	assert.equal(findBrokenPluginLinkAt('Ein Satz ganz ohne Link.', 10), undefined);
	assert.equal(findBrokenPluginLinkAt('[Eine Notiz](andere-notiz.md', 20), undefined);
	// A half-typed markdown link to something else must not be swept up.
	assert.equal(findBrokenPluginLinkAt('[Titel](https://example.invalid/seite', 25), undefined);
});

test('findBrokenPluginLinkAt keeps firing as the deletion eats into the URL', () => {
	// Holding backspace walks back through the address; the offer has to stay
	// up for that whole stretch, not just the first keystroke.
	const line = `Siehe ${PSALM_1_1_LINK}`;
	const fullEnd = line.length - 1; // the ")" removed
	for (const ch of [fullEnd, fullEnd - 5, line.indexOf('bible=') + 3]) {
		assert.ok(findBrokenPluginLinkAt(line.slice(0, ch), ch), `ch ${ch}`);
	}
});

test('findBrokenPluginLinkAt reports the span that is left to remove', () => {
	const line = `Siehe ${PSALM_1_1_LINK}`;
	const broken = line.slice(0, line.length - 1);
	const hit = findBrokenPluginLinkAt(broken, broken.length);
	assert.equal(broken.slice(hit.start, hit.end), PSALM_1_1_LINK.slice(0, -1));
});

// ── When the removal suggestion shows itself ─────────────────────────────
// Inserting a reference leaves a space after it with the caret beyond that
// space. So "caret exactly at the link's end, no space after it" is not a
// state writing produces — it is the state deleting that space produces,
// which is one keystroke earlier than the broken-link case above.

test('findPluginLinkToRemoveAt fires once the space after an inserted reference is deleted', () => {
	const line = `Siehe ${PSALM_1_1_LINK}`; // the trailing space removed
	const span = findPluginLinkToRemoveAt(line, line.length);
	assert.equal(line.slice(span.start, span.end), PSALM_1_1_LINK);
});

test('findPluginLinkToRemoveAt stays quiet while the inserted space is still there', () => {
	// The caret merely being moved to the end of a finished reference is not
	// an intention to delete it.
	const line = `Siehe ${PSALM_1_1_LINK} und weiter`;
	assert.equal(findPluginLinkToRemoveAt(line, `Siehe ${PSALM_1_1_LINK}`.length), undefined);
});

test('findPluginLinkToRemoveAt stays quiet with the caret inside or before an intact reference', () => {
	const line = `Siehe ${PSALM_1_1_LINK}`;
	for (const ch of [0, line.indexOf('Psalm'), line.indexOf('bible=')]) {
		assert.equal(findPluginLinkToRemoveAt(line, ch), undefined, `ch ${ch}`);
	}
});

test('findPluginLinkToRemoveAt still covers the half-deleted link', () => {
	const line = `Siehe ${PSALM_1_1_LINK}`.slice(0, -1); // ")" gone
	assert.ok(findPluginLinkToRemoveAt(line, line.length));
});

test('pluginLinkLabel recovers the visible text, from an intact and a half-deleted link alike', () => {
	// This is what "remove only the link" leaves behind, so a wrong verse can
	// be corrected by typing over it instead of written again from nothing.
	assert.equal(pluginLinkLabel(PSALM_1_1_LINK), 'Psalm 1:1');
	assert.equal(pluginLinkLabel(PSALM_1_1_LINK.slice(0, -1)), 'Psalm 1:1');
	assert.equal(pluginLinkLabel(MATTHEW_5_1_HTML_LINK), 'Matthäus 5:1');
	assert.equal(pluginLinkLabel('kein Link'), undefined);
});

test('the removal suggestion covers every link this plugin writes', () => {
	// Songs and source citations are jw.org/finder links rather than
	// jwlibrary:// ones (see NoteBuilder.songLink), but they are just as much
	// the plugin's own, and just as tedious to delete by hand.
	const song = '[Lied 12](https://www.jw.org/finder?srcid=jwlshare&wtlocale=X&prefer=lang&docid=1011214)';
	const citation = '[Werde ein besserer Leser](https://www.jw.org/finder?wtlocale=X&docid=1102016100)';

	for (const link of [song, citation]) {
		const line = `Siehe ${link}`;
		const span = findPluginLinkToRemoveAt(line, line.length);
		assert.ok(span, link);
		assert.equal(line.slice(span.start, span.end), link);
		// And half-deleted, the state the suggestion watches for.
		const broken = line.slice(0, -1);
		assert.ok(findPluginLinkToRemoveAt(broken, broken.length), `broken: ${link}`);
	}
});

test('the removal suggestion stays out of links this plugin did not write', () => {
	// An ordinary note link or an outside URL is none of this plugin's
	// business — asserted rather than assumed, since the suggestion offers to
	// delete whatever it fires on.
	const internal = '[Eine andere Notiz](andere-notiz.md)';
	const external = '[Eine Seite](https://example.invalid/seite)';
	const otherJw = '[Etwas](https://www.jw.org/de/bibliothek/)'; // jw.org, but not a finder link

	for (const link of [internal, external, otherJw]) {
		const line = `Siehe ${link}`;
		for (const ch of [line.length, line.length - 1, line.indexOf('('), line.indexOf('[') + 2]) {
			assert.equal(findPluginLinkToRemoveAt(line, ch), undefined, `${link} @ ${ch}`);
		}
		const broken = line.slice(0, -1);
		assert.equal(findPluginLinkToRemoveAt(broken, broken.length), undefined, `broken: ${link}`);
	}
});
