/**
 * Unit tests for MwbParser's HTML-parsing helpers. Uses hand-written,
 * fictional markup shaped like the real meeting-workbook jwpub HTML
 * structure — never actual "Leben und Dienst" text, to keep copyrighted
 * content out of the repo (same policy as jwpubParser.test.mjs).
 *
 * Private methods are reached via bracket-notation (TypeScript's `private`
 * is compile-time only) — the same technique jwpubParser.test.mjs uses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { MwbParser } = await jiti.import('../src/parser/MwbParser.ts');

function parser() {
	return new MwbParser(new Uint8Array());
}

function parseHtml(html) {
	return new DOMParser().parseFromString(html, 'text/html');
}

// A full, fictional week document exercising every structural quirk real
// files show: item 1 of a section wrapped together with its own content
// (the real markup's oddity — every other item's heading is a plain
// top-level sibling followed by separate content divs), a sub-question list
// with screen-reader-only "Deine Antwort" labels and <textarea> answer
// placeholders that must be stripped, two different assignment-type labels,
// and the always-last "Versammlungsbibelstudium" item.
const WEEK_HTML = `
<header>
<h1>Testwoche 1.-7. Januar</h1>
<h2><a href="jwpub://b/NWTR/20:16:20-20:16:20">Testbuch 16</a></h2>
</header>
<div class="bodyTxt">
<h3 class="dc-icon--music"><a href="jwpub://p/X:1102016800/"><strong>Lied 1</strong></a> <strong>und Gebet | Einleitende Worte</strong> <span>(1 Min.)</span></h3>
<div id="w1"><h2><strong>SCHÄTZE AUS GOTTES WORT</strong></h2></div>
<div id="w2">
<h3><strong>1. Testtitel eins</strong></h3>
<div><div><p>(10 Min.)</p></div>
<p>Testinhalt mit Bibelstelle (<a href="jwpub://b/NWTR/20:16:20-20:16:20">Testbuch 16:20</a>).</p>
</div>
</div>
<h3><strong>2. Nach geistigen Testschätzen graben</strong></h3>
<div><div><p>(10 Min.)</p></div>
<ul class="du-listStyleType--none"><li><p><a href="jwpub://b/NWTR/20:21:1-20:21:1">Testbuch 21:1</a> – Testfrage?</p>
<div class="gen-field"><label class="dc-screenReaderText">Deine Antwort</label><textarea>geheimer Text</textarea></div>
</li>
<li><p>Was hast du beim Testlesen entdeckt?</p>
<div class="gen-field"><label class="dc-screenReaderText">Deine Antwort</label><textarea></textarea></div>
</li></ul>
</div>
<div><h2><strong>UNS IM DIENST VERBESSERN</strong></h2></div>
<h3><strong>3. Gespräche beginnen</strong></h3>
<div><p>(3 Min.) VON HAUS ZU HAUS. Testinhalt. (<a class="xt" href="jwpub://p/X:9999999/">tb Lektion 1</a>)</p></div>
<h3><strong>4. Interesse fördern</strong></h3>
<div><p>(2 Min.) INFORMELL. Testinhalt zwei.</p></div>
<div><h2><strong>UNSER LEBEN ALS CHRIST</strong></h2></div>
<h3 class="dc-icon--music"><a href="jwpub://p/X:1102016801/"><strong>Lied 2</strong></a></h3>
<h3><strong>5. Testabschnitt fünf</strong></h3>
<div><p>(15 Min.) Testinhalt drei.</p></div>
<h3><strong>6. Versammlungsbibelstudium</strong></h3>
<div><p>(30 Min.) <a class="xt" href="jwpub://p/X:8888888/">tb2 Geschichte 1</a></p></div>
<h3><strong>Schlussworte</strong> <span>(3 Min.)</span> <strong>|</strong> <span class="dc-icon--music"><a href="jwpub://p/X:1102016802/"><strong>Lied 3</strong></a></span> <strong>und Gebet</strong></h3>
</div>
`;

test('parseWeekDocument extracts the date range and weekly Bible reading', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	assert.equal(week.dateRangeLabel, 'Testwoche 1.-7. Januar');
	assert.equal(week.bibleReadingLabel, 'Testbuch 16');
	assert.deepEqual(week.bibleReading, [{ book: 20, chapter: 16, verseStart: 20, verseEnd: 20 }]);
});

test('parseWeekDocument classifies the 3 song headings positionally (opening/mid-week/closing)', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	assert.deepEqual(week.openingSong, { songNumber: 1, songDocid: 1102016800, includesPrayer: true, includesIntroWords: true });
	assert.deepEqual(week.midWeekSong, { songNumber: 2, songDocid: 1102016801, includesPrayer: undefined, includesIntroWords: undefined });
	assert.deepEqual(week.closingSong, { songNumber: 3, songDocid: 1102016802, includesPrayer: true, includesIntroWords: undefined });
});

test('parseWeekDocument numbers items sequentially across all 3 sections, not restarted per section', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	assert.equal(week.items.length, 6);
	assert.deepEqual(week.items.map(i => i.number), [1, 2, 3, 4, 5, 6]);
	assert.deepEqual(week.items.map(i => i.section), ['treasures', 'treasures', 'ministry', 'ministry', 'living', 'living']);
});

test('parseWeekDocument extracts item 1 correctly even though its <h3> is wrapped together with its own content (real markup quirk)', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	const item1 = week.items[0];
	assert.equal(item1.title, 'Testtitel eins');
	assert.equal(item1.durationMin, 10);
	// The standalone "(10 Min.)" paragraph is excluded from `paragraphs` (already
	// surfaced via durationMin) — only the real descriptive-text paragraph remains,
	// with its embedded scripture reference as its own segment.
	assert.equal(item1.paragraphs.length, 1);
	assert.deepEqual(item1.paragraphs[0], [
		{ type: 'text', markdown: 'Testinhalt mit Bibelstelle (' },
		{ type: 'scripture', scripture: { book: 20, chapter: 16, verseStart: 20, verseEnd: 20 } },
		{ type: 'text', markdown: ').' },
	]);
});

// Flattens a question's segments into plain text for content assertions —
// mirrors what MwbNoteBuilder.renderSegments() would show for a text-only
// segment list (scripture/citation segments aren't expected in these cases).
function flatten(segments) {
	return segments.map(s => s.markdown ?? s.label ?? '').join('');
}

test('parseWeekDocument strips <textarea> and screen-reader-only labels from sub-questions', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	const item2 = week.items[1];
	assert.equal(item2.subQuestions.length, 2);
	for (const q of item2.subQuestions) {
		const text = flatten(q);
		assert.ok(!text.includes('Deine Antwort'), 'screen-reader-only label must be stripped');
		assert.ok(!text.includes('geheimer Text'), 'textarea placeholder content must be stripped');
	}
	assert.ok(flatten(item2.subQuestions[0]).includes('Testfrage?'));
});

test('sub-questions render an embedded scripture reference as its own clickable segment, not plain text', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	const item2 = week.items[1];
	const firstQuestion = item2.subQuestions[0];
	assert.ok(firstQuestion.some(s => s.type === 'scripture'), 'the scripture reference inside the sub-question must be its own segment');
});

test('parseWeekDocument captures the assignment-type label verbatim as metadata, and the duration', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	const item3 = week.items[2];
	assert.equal(item3.assignmentType, 'VON HAUS ZU HAUS');
	assert.equal(item3.durationMin, 3);

	const item4 = week.items[3];
	assert.equal(item4.assignmentType, 'INFORMELL');
	assert.equal(item4.durationMin, 2);
});

test('parseWeekDocument strips the leading duration marker from the rendered paragraph text and bolds the assignment-type prefix in place, instead of duplicating both', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	const item3 = week.items[2];
	assert.equal(item3.paragraphs.length, 1);
	const firstSegment = item3.paragraphs[0][0];
	assert.equal(firstSegment.type, 'text');
	assert.ok(!firstSegment.markdown.includes('(3 Min.)'), 'duration marker must not remain in the paragraph text');
	assert.ok(firstSegment.markdown.startsWith('**VON HAUS ZU HAUS.**'), 'assignment-type prefix must be bolded in place');
});

test('parseWeekDocument turns a source-material citation link into its own "citation" segment carrying the real jw.org docid', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	const item3 = week.items[2];
	const citation = item3.paragraphs[0].find(seg => seg.type === 'citation');
	assert.ok(citation, 'a citation segment must be present');
	assert.equal(citation.label, 'tb Lektion 1');
	assert.equal(citation.docid, 9999999);
});

test('renderParagraphSegments preserves a plain https:// link (e.g. a "Zeig das VIDEO" prompt) as a real markdown link baked into the text', () => {
	const dom = parseHtml('<p>Schau dir <a href="https://www.jw.org/finder?lank=pub-ljf_1_VIDEO"><strong>das VIDEO</strong></a> an.</p>');
	const p = dom.querySelector('p');
	const segments = parser()['renderParagraphSegments'](p);
	assert.equal(segments.length, 1);
	assert.deepEqual(segments[0], {
		type: 'text',
		markdown: 'Schau dir [**das VIDEO**](https://www.jw.org/finder?lank=pub-ljf_1_VIDEO) an.',
	});
});

test('extractParagraphs excludes a photo\'s legal image-source credit (<p class="imgCredit">) but keeps the figcaption\'s own descriptive text', () => {
	const dom = parseHtml(`
		<div>
		<p>Besprechung.</p>
		<div id="f1"><figure>
		<img src="jwpub-media://test.jpg" alt="Testbild" />
		<p class="imgCredit">Based on NASA/Visible Earth imagery</p>
		<figcaption class="figcaption"><p>Eine echte Bildunterschrift mit Lehrinhalt</p></figcaption>
		</figure></div>
		</div>
	`);
	const paragraphs = parser()['extractParagraphs']([dom.querySelector('div')]);
	const allText = paragraphs.map(p => p.map(s => s.markdown ?? '').join('')).join(' | ');
	assert.ok(!allText.includes('NASA'), 'image credit must be excluded');
	assert.ok(allText.includes('Eine echte Bildunterschrift mit Lehrinhalt'), 'figcaption text must still be kept');
});

test('parseWeekDocument flags the last "living"-section item as the Congregation Bible Study via its title', () => {
	const dom = parseHtml(WEEK_HTML);
	const week = parser()['parseWeekDocument'](dom);
	const cbs = week.items[5];
	assert.equal(cbs.title, 'Versammlungsbibelstudium');
	assert.equal(cbs.isCongregationBibleStudy, true);
	assert.equal(cbs.durationMin, 30);
	const citation = cbs.paragraphs[0].find(seg => seg.type === 'citation');
	assert.equal(citation.label, 'tb2 Geschichte 1');
	assert.equal(citation.docid, 8888888);
	assert.ok(!week.items[4].isCongregationBibleStudy);
});

test('parseWeekDocument falls back to positional Congregation Bible Study detection when the title does not match', () => {
	const dom = parseHtml(WEEK_HTML.replace('6. Versammlungsbibelstudium', '6. Ein anderer Titel'));
	const week = parser()['parseWeekDocument'](dom);
	assert.equal(week.items[5].isCongregationBibleStudy, true);
});

test('parseWeekDocument returns null when the document has no <h1>', () => {
	const dom = parseHtml('<div class="bodyTxt"></div>');
	assert.equal(parser()['parseWeekDocument'](dom), null);
});

test('parseWeekDocument returns null when no numbered items are found at all', () => {
	const dom = parseHtml('<header><h1>Leere Woche</h1></header><div class="bodyTxt"></div>');
	assert.equal(parser()['parseWeekDocument'](dom), null);
});

test('classifySongHeadings degrades gracefully to opening+closing only when a week has 2 song headings instead of 3', () => {
	const dom = parseHtml(WEEK_HTML.replace('<h3 class="dc-icon--music"><a href="jwpub://p/X:1102016801/"><strong>Lied 2</strong></a></h3>', ''));
	const week = parser()['parseWeekDocument'](dom);
	assert.equal(week.openingSong.songNumber, 1);
	assert.equal(week.closingSong.songNumber, 3);
	assert.equal(week.midWeekSong, undefined);
});

test('classifySongHeadings rejects a week with an unexpected song-heading count (not 2 or 3)', () => {
	// Remove BOTH the mid-week and closing song headings — leaves only 1.
	const html = WEEK_HTML
		.replace('<h3 class="dc-icon--music"><a href="jwpub://p/X:1102016801/"><strong>Lied 2</strong></a></h3>', '')
		.replace('<h3><strong>Schlussworte</strong> <span>(3 Min.)</span> <strong>|</strong> <span class="dc-icon--music"><a href="jwpub://p/X:1102016802/"><strong>Lied 3</strong></a></span> <strong>und Gebet</strong></h3>', '');
	const dom = parseHtml(html);
	assert.equal(parser()['parseWeekDocument'](dom), null);
});

// ── Memorial Bible-reading-schedule document ────────────────────────────────

const MEMORIAL_HTML = `
<header>
<h1>Testleseprogramm für das Testfest</h1>
<div><p>Einleitungstext für den Test.</p></div>
</header>
<div class="bodyTxt">
<h2>TESTTAG, 1. TESTMONAT</h2>
<div class="gen-field"><input type="checkbox"/><label><a href="jwpub://b/NWTR/43:11:55-43:12:1">Testbuch 11:55-12:1</a></label></div>
<h2>TESTTAG, 2. TESTMONAT</h2>
<div class="gen-field"><input type="checkbox"/><label><a href="jwpub://b/NWTR/40:26:6-40:26:13">Testbuch 26:6-13</a></label></div>
<p><a class="xt" href="jwpub://p/X:1102014701/">Testquelle, Kap. 1</a></p>
</div>
`;

test('parseMemorialReadingDocument groups readings under each day heading', () => {
	const dom = parseHtml(MEMORIAL_HTML);
	const schedule = parser()['parseMemorialReadingDocument'](dom, 'Testleseprogramm für das Testfest');
	assert.equal(schedule.title, 'Testleseprogramm für das Testfest');
	assert.equal(schedule.intro, 'Einleitungstext für den Test.');
	assert.equal(schedule.days.length, 2);
	assert.equal(schedule.days[0].dayLabel, 'TESTTAG, 1. TESTMONAT');
	assert.deepEqual(schedule.days[0].readings, [{ scripture: { book: 43, chapter: 11, verseStart: 55, verseEnd: 1, chapterEnd: 12 } }]);
});

test('parseMemorialReadingDocument attaches a trailing source-citation link to the day\'s last reading', () => {
	const dom = parseHtml(MEMORIAL_HTML);
	const schedule = parser()['parseMemorialReadingDocument'](dom, 'Testleseprogramm für das Testfest');
	assert.equal(schedule.days[1].readings[0].sourceCitation, 'Testquelle, Kap. 1');
});

test('parseMemorialReadingDocument returns null when no day headings are found', () => {
	const dom = parseHtml('<header><h1>Titel</h1></header><div class="bodyTxt"></div>');
	assert.equal(parser()['parseMemorialReadingDocument'](dom, 'Titel'), null);
});
