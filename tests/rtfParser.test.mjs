/**
 * Unit tests for RtfParser. All RTF snippets below are hand-written and
 * shaped after the real jw.org RTF export structure (verified against real
 * congress files during development) but use fictional titles/quotes — never
 * actual congress programme text — to keep copyrighted content out of the repo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { RtfParser } = await jiti.import('../src/parser/RtfParser.ts');

function parser() {
	return new RtfParser();
}

// Wraps a body in the boilerplate every real export has: a font/color/style
// table and an \info destination — both of which must never leak into the
// decoded text.
function rtfDoc(body) {
	return (
		'{\\rtf1\\ansi\\uc1{\\*\\generator WTS5;}' +
		'{\\fonttbl{\\f0\\fcharset0 Times New Roman;}}' +
		'{\\colortbl ;\\red128\\green0\\blue128;}' +
		'{\\stylesheet{\\s2 Title;}}' +
		'{\\info{\\upr{\\*\\ud{\\author Copyright text here}}}}' +
		body +
		'}'
	);
}

function hyperlinkField(url, label) {
	return `{\\field{\\*\\fldinst {HYPERLINK "${url}" }}{\\fldrslt{\\ul ${label}}}}`;
}

test('rtfToText strips font/color/stylesheet/info destinations, keeps body text', () => {
	const rtf = rtfDoc('\\pard Hallo Welt\\par');
	const text = parser()['rtfToText'](rtf);
	assert.equal(text, 'Hallo Welt');
	assert.ok(!text.includes('Times New Roman'));
	assert.ok(!text.includes('Copyright'));
});

test('rtfToText decodes \\uNNNN unicode escapes and skips the "?" fallback char', () => {
	const rtf = rtfDoc('\\pard Gl\\u252?ck\\par');
	assert.equal(parser()['rtfToText'](rtf), 'Glück');
});

test('rtfToText excludes the invisible \\fldinst URL but keeps the visible \\fldrslt text', () => {
	const rtf = rtfDoc(`\\pard Lied ${hyperlinkField('https://example.invalid/x', 'Beispiel 1')}\\par`);
	const text = parser()['rtfToText'](rtf);
	assert.equal(text, 'Lied Beispiel 1');
	assert.ok(!text.includes('https://'));
});

test('matchTime parses "H Uhr MM" and normalizes to H:MM', () => {
	const p = parser();
	assert.deepEqual(p['matchTime']('9 Uhr 20 Beispieltext'), { time: '9:20', raw: '9 Uhr 20' });
});

test('matchTime defaults minutes to 00 when only the hour is given ("H Uhr")', () => {
	const p = parser();
	assert.deepEqual(p['matchTime']('15 Uhr Beispieltext'), { time: '15:00', raw: '15 Uhr' });
});

test('matchTime returns null when there is no time in the text', () => {
	assert.equal(parser()['matchTime']('Kein Zeitstempel hier'), null);
});

test('cleanTitle strips a leading "TYPE: " marker and a trailing "(... Vers ...)" citation', () => {
	const p = parser();
	assert.equal(
		p['cleanTitle']('Vortrag des Vorsitzenden: Ist ewiges Glück möglich? (Psalm 16 Vers 11; 100 Vers 2)'),
		'Ist ewiges Glück möglich?',
	);
});

test('cleanTitle leaves a bare title (no type marker, no citation) unchanged', () => {
	const p = parser();
	assert.equal(p['cleanTitle']('Was Jesus lehrte'), 'Was Jesus lehrte');
});

test('matchScriptures dedupes repeated HYPERLINK runs that share the same url', () => {
	// A single citation's display text is split across several formatting runs
	// (e.g. "Beispielbuch " / "5 Vers 1" / ",2"), each with an identical url.
	const raw =
		hyperlinkField('https://example.invalid/finder?bible=40005001-40005002', 'Beispielbuch ') +
		hyperlinkField('https://example.invalid/finder?bible=40005001-40005002', '5 Vers 1') +
		hyperlinkField('https://example.invalid/finder?bible=40005001-40005002', ',2');
	const scriptures = parser()['matchScriptures'](raw);
	assert.deepEqual(scriptures, [{ book: 40, chapter: 5, verseStart: 1, verseEnd: 2 }]);
});

test('extractDayTheme reads the quote + scripture paragraph right after the standalone weekday paragraph', () => {
	const rtf = rtfDoc(
		'\\pard Freitag\\par' +
		`\\pard „Ein Beispielzitat“ (${hyperlinkField('https://example.invalid/finder?bible=40005003', 'Beispielbuch 5 Vers 3')})\\par` +
		'\\pard Vormittag\\par',
	);
	const paragraphs = parser()['splitParagraphs'](rtf);
	const { theme, themeScripture } = parser()['extractDayTheme'](paragraphs);
	assert.equal(theme, '„Ein Beispielzitat“');
	assert.deepEqual(themeScripture, { book: 40, chapter: 5, verseStart: 3 });
});

test('extractCongressThemeYear reads "Motto Kongress von Jehovas Zeugen YYYY"', () => {
	const rtf = rtfDoc('\\pard Beispielmotto Kongress von Jehovas Zeugen 2026\\par');
	const paragraphs = parser()['splitParagraphs'](rtf);
	assert.deepEqual(parser()['extractCongressThemeYear'](paragraphs), { theme: 'Beispielmotto', year: 2026 });
});

test('parse() builds a full day with song, aside, talk, bible-drama and talk-series items', async () => {
	const bibleLink = (bible, label) => hyperlinkField(`https://example.invalid/finder?bible=${bible}`, label);
	// Real exports always encode non-ASCII characters as \uNNNN escapes (RTF
	// itself is plain ASCII) — using the literal characters here instead would
	// get mangled by the latin1 buffer encoding below.
	const oq = '\\u8222?'; // „
	const cq = '\\u8220?'; // "
	const bullet = '\\u8226?'; // •

	const rtf = rtfDoc(
		'\\pard Freitag\\par' +
		`\\pard ${oq}Beispielmotto${cq} (${bibleLink('40005003', 'Beispielbuch 5 Vers 3')})\\par` +
		'\\pard Vormittag\\par' +
		'\\pard 9 Uhr 20 Musikvideo\\par' +
		`\\pard 9 Uhr 30 ${hyperlinkField('https://example.invalid/finder?srcid=share&lank=pub-sjjm_611_VIDEO', 'Lied 111')} und Gebet\\par` +
		`\\pard 9 Uhr 40 Vortrag: Ein Beispieltitel? (${bibleLink('19016011', 'Psalm 16 Vers 11')})\\par` +
		'\\pard 10 Uhr 10 Bibeldrama:\\par' +
		'\\pard Die Beispielserie: Folge 1\\par' +
		`\\pard ${oq}Ein Beispielzitat${cq} (${bibleLink('40005003-40007029', 'Beispielbuch 5 Vers 3 bis 7 Vers 29')})\\par` +
		'\\pard 11 Uhr 15 Vortragsreihe: Eine Beispielreihe\\par' +
		`\\pard ${bullet} Erster Teil (${bibleLink('40008016-40008017', 'Beispielbuch 8 Vers 16,17')})\\par` +
		`\\pard ${bullet} Zweiter Teil (${bibleLink('19032001-19032002', 'Beispielbuch 32 Vers 1,2')})\\par`,
	);

	const congress = await parser().parse(Buffer.from(rtf, 'latin1'));

	assert.equal(congress.days.length, 1);
	const day = congress.days[0];
	assert.equal(day.weekday, 'Freitag');
	assert.equal(day.theme, '„Beispielmotto“');
	assert.deepEqual(day.themeScripture, { book: 40, chapter: 5, verseStart: 3 });

	const items = day.sessions[0].items;
	assert.deepEqual(items.map(i => i.itemType), ['aside', 'song', 'talk', 'bible-drama', 'talk-series']);

	const song = items[1];
	assert.equal(song.songNumber, 111);
	assert.equal(song.title, 'Lied 111 und Gebet');

	const talk = items[2];
	assert.equal(talk.title, 'Ein Beispieltitel?');
	assert.deepEqual(talk.scriptures, [{ book: 19, chapter: 16, verseStart: 11 }]);

	const drama = items[3];
	assert.equal(drama.title, 'Die Beispielserie');
	assert.equal(drama.subtitle, 'Folge 1: „Ein Beispielzitat“');
	// Matthäus 5:3–7:29 — a real cross-chapter citation shape; verseEnd/chapterEnd
	// preserve the full range (see ScriptureNormalizer.fromRtf()).
	assert.deepEqual(drama.scriptures, [{ book: 40, chapter: 5, verseStart: 3, verseEnd: 29, chapterEnd: 7 }]);

	const series = items[4];
	assert.equal(series.title, 'Eine Beispielreihe');
	assert.equal(series.parts.length, 2);
	assert.equal(series.parts[0].title, 'Erster Teil');
	assert.deepEqual(series.parts[0].scriptures, [{ book: 40, chapter: 8, verseStart: 16, verseEnd: 17 }]);
	assert.equal(series.parts[1].title, 'Zweiter Teil');
});
