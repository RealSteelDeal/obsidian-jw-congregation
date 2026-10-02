import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { MwbNoteBuilder } = await jiti.import('../src/builder/MwbNoteBuilder.ts');
const { mergeNoteContent } = await jiti.import('../src/util/noteMerge.ts');

function builder(opts = {}) {
	return new MwbNoteBuilder({
		scriptureLinks: true,
		showDurationField: true,
		showSourceCitationField: true,
		frontmatter: false,
		...opts,
	});
}

function song(overrides = {}) {
	return { songNumber: 1, songDocid: 1102016800, ...overrides };
}

// A single text segment is the common case in these tests — most assertions
// don't need a scripture/citation segment mixed in.
function textParagraph(markdown) {
	return [{ type: 'text', markdown }];
}

function item(overrides = {}) {
	return {
		number: 1,
		section: 'treasures',
		title: 'Testtitel',
		durationMin: 10,
		assignmentType: undefined,
		paragraphs: [textParagraph('Testinhalt für Punkt eins.')],
		subQuestions: [],
		isCongregationBibleStudy: false,
		...overrides,
	};
}

function week(overrides = {}) {
	return {
		dateRangeLabel: '1.-7. Testmonat',
		bibleReadingLabel: 'Testbuch 16',
		bibleReading: [{ book: 20, chapter: 16, verseStart: 1, verseEnd: 20 }],
		openingSong: song({ songNumber: 1 }),
		midWeekSong: song({ songNumber: 2, songDocid: 1102016801 }),
		closingSong: song({ songNumber: 3, songDocid: 1102016802 }),
		items: [
			item({ number: 1, section: 'treasures' }),
			item({
				number: 2, section: 'ministry', title: 'Testdienst', durationMin: 3,
				paragraphs: [textParagraph('**VON HAUS ZU HAUS.** Sprich mit jemandem über eine Testwahrheit.')],
			}),
			item({
				number: 3, section: 'living', title: 'Versammlungsbibelstudium', durationMin: 30,
				isCongregationBibleStudy: true,
				paragraphs: [[{ type: 'citation', label: 'tb Geschichte 1', docid: 1234567 }]],
			}),
		],
		...overrides,
	};
}

function mwb(overrides = {}) {
	return { symbol: 'mwb26', year: 2026, issueTagNumber: '20260100', weeks: [week()], memorialReading: undefined, lang: 'de', ...overrides };
}

test('issueFolderName derives a "Jan/Feb"-style label from a bimonthly IssueTagNumber', () => {
	// The folder-name sanitizer replaces the filesystem-forbidden "/" with a
	// visually similar fraction-slash (U+2044), same convention as NoteBuilder
	// uses for congress folder names — not a plain slash in the real folder.
	assert.equal(builder().issueFolderName(mwb({ issueTagNumber: '20260100', year: 2026 })), 'Leben und Dienst 2026 Jan⁄Feb');
	assert.equal(builder().issueFolderName(mwb({ issueTagNumber: '20260900', year: 2026 })), 'Leben und Dienst 2026 Sep⁄Okt');
	assert.equal(builder().issueFolderName(mwb({ issueTagNumber: '20261100', year: 2026 })), 'Leben und Dienst 2026 Nov⁄Dez');
});

test('issueFolderName falls back to just the year when IssueTagNumber is malformed', () => {
	assert.equal(builder().issueFolderName(mwb({ issueTagNumber: 'not-a-number', year: 2026 })), 'Leben und Dienst 2026');
});

test('buildNotes produces exactly one note per week, named with a zero-padded chronological number before the date-range label', () => {
	const result = builder().buildNotes(mwb({ weeks: [week({ dateRangeLabel: '1.-7. Januar' }), week({ dateRangeLabel: '8.-14. Januar' })] }));
	assert.equal(result.notes.length, 2);
	// Confirms the fix for "10.-16. AUGUST" sorting before "3.-9. AUGUST"
	// alphabetically — a numeric prefix makes the file explorer's default sort
	// match chronological order regardless of the raw date-range text.
	assert.deepEqual(result.notes.map(n => n.filename), ['01. 1.-7. Januar.md', '02. 8.-14. Januar.md']);
});

test('buildNotes adds one extra note for the Memorial reading schedule when present, named after its own title (year included)', () => {
	const result = builder().buildNotes(mwb({
		memorialReading: { title: 'Testleseprogramm 2026', days: [{ dayLabel: 'TESTTAG', readings: [{ scripture: { book: 20, chapter: 1, verseStart: 1 } }] }] },
	}));
	assert.equal(result.notes.length, 2);
	assert.ok(result.notes.some(n => n.filename === 'Testleseprogramm 2026.md'));
});

test('week note has no in-body "# <date range>" heading — Obsidian\'s own inline title (from the filename) already shows it, and a second one duplicated it', () => {
	const result = builder().buildNotes(mwb({ weeks: [week({ dateRangeLabel: '1.-7. Januar' })] }));
	const content = result.notes[0].content;
	assert.doesNotMatch(content, /^# 1\.-7\. Januar$/m);
});

test('week note renders all 3 section headings and every item under its own section', () => {
	const result = builder().buildNotes(mwb());
	const content = result.notes[0].content;
	assert.match(content, /## SCHÄTZE AUS GOTTES WORT/);
	assert.match(content, /## UNS IM DIENST VERBESSERN/);
	assert.match(content, /## UNSER LEBEN ALS CHRIST/);
	assert.match(content, /### 1\. Testtitel/);
	assert.match(content, /### 2\. Testdienst/);
	assert.match(content, /### 3\. Versammlungsbibelstudium/);
});

test('week note renders the item\'s actual descriptive text (not just metadata), with the assignment-type prefix already bolded by the parser', () => {
	const result = builder().buildNotes(mwb());
	const content = result.notes[0].content;
	assert.match(content, /Testinhalt für Punkt eins\./);
	assert.match(content, /\*\*VON HAUS ZU HAUS\.\*\* Sprich mit jemandem über eine Testwahrheit\./);
});

test('week note shows the duration for items that have it', () => {
	const result = builder().buildNotes(mwb());
	const content = result.notes[0].content;
	assert.match(content, /\*\*Dauer:\*\* 3 Min\./);
});

test('source-material citations render as jw.org/finder links using the real docid', () => {
	const result = builder().buildNotes(mwb());
	const content = result.notes[0].content;
	assert.match(content, /\[tb Geschichte 1\]\(https:\/\/www\.jw\.org\/finder\?srcid=jwlshare&wtlocale=X&prefer=lang&docid=1234567\)/);
});

test('duration line and citation link are omitted (but text/label kept) when their toggles are off', () => {
	const result = builder({ showDurationField: false, showSourceCitationField: false }).buildNotes(mwb());
	const content = result.notes[0].content;
	assert.doesNotMatch(content, /\*\*Dauer:\*\*/);
	assert.doesNotMatch(content, /\[tb Geschichte 1\]\(/, 'the citation must not be a link when the toggle is off (songs still are — unaffected by this toggle)');
	assert.match(content, /tb Geschichte 1/, 'the citation label itself must still be shown, just not as a link');
});

test('the Congregation Bible Study item gets the dedicated "cbs" marker id, not a positional item-N id', () => {
	const result = builder().buildNotes(mwb());
	const content = result.notes[0].content;
	assert.match(content, /data-jw-start="cbs"/);
	assert.doesNotMatch(content, /data-jw-start="item-3"/);
	assert.match(content, /data-jw-start="item-1"/);
	assert.match(content, /data-jw-start="item-2"/);
});

test('opening/mid-week/closing songs render as jw.org links using the real songDocid when available', () => {
	const result = builder().buildNotes(mwb());
	const content = result.notes[0].content;
	assert.match(content, /\[Lied 1\]\(https:\/\/www\.jw\.org\/finder\?srcid=jwlshare&wtlocale=X&prefer=lang&docid=1102016800\)/);
	assert.match(content, /\[Lied 2\]\(https:\/\/www\.jw\.org\/finder\?srcid=jwlshare&wtlocale=X&prefer=lang&docid=1102016801\)/);
	assert.match(content, /\[Lied 3\]\(https:\/\/www\.jw\.org\/finder\?srcid=jwlshare&wtlocale=X&prefer=lang&docid=1102016802\)/);
});

test('a week\'s cover image is embedded at the very top of the note and returned as its own attachment, named after the week number', () => {
	const result = builder().buildNotes(mwb({
		weeks: [week({ coverImage: { data: new Uint8Array([1, 2, 3]), filename: 'foo.jpg', mimeType: 'image/jpeg' } })],
	}));
	assert.equal(result.attachments.length, 1);
	assert.equal(result.attachments[0].filename, '01. Titelbild.jpg');
	assert.deepEqual(Array.from(result.attachments[0].data), [1, 2, 3]);
	const content = result.notes[0].content;
	assert.match(content, /!\[\[01\. Titelbild\.jpg\]\]/);
	// The embed must come before the rest of the header content (Wochenlesung, opening song).
	assert.ok(content.indexOf('01. Titelbild.jpg') < content.indexOf('Wochenlesung'));
});

test('a week with no cover image produces no attachment and no embed line', () => {
	const result = builder().buildNotes(mwb());
	assert.equal(result.attachments.length, 0);
	assert.doesNotMatch(result.notes[0].content, /!\[\[/);
});

test('Memorial-reading note renders one checkbox line per reading, grouped under each day heading, with no separate title heading', () => {
	const result = builder().buildNotes(mwb({
		memorialReading: {
			title: 'Testleseprogramm 2026',
			intro: 'Testeinleitung',
			days: [
				{ dayLabel: 'TESTTAG EINS', readings: [{ scripture: { book: 20, chapter: 1, verseStart: 1 }, sourceCitation: 'Testquelle' }] },
				{ dayLabel: 'TESTTAG ZWEI', readings: [{ scripture: { book: 20, chapter: 2, verseStart: 2 } }] },
			],
		},
	}));
	const note = result.notes.find(n => n.filename === 'Testleseprogramm 2026.md');
	assert.doesNotMatch(note.content, /^# Testleseprogramm/m);
	assert.match(note.content, /\*Testeinleitung\*/);
	assert.match(note.content, /## TESTTAG EINS/);
	assert.match(note.content, /- \[ \] .*\(Testquelle\)/);
	assert.match(note.content, /## TESTTAG ZWEI/);
});

// ── Marker-merge round trip — the whole point of marking each item individually ──

test('a re-import only patches marked fields, preserving the user\'s own writing space between items', () => {
	const b = builder();
	const original = b.buildNotes(mwb()).notes[0].content;

	// Simulate the user typing their own preparation notes right after item 1's
	// marker (in the writing-space gap NoteBuilder-style rendering leaves there).
	const withUserNotes = original.replace(
		'<span class="jw-marker" data-jw-end="item-1"></span>',
		'<span class="jw-marker" data-jw-end="item-1"></span>\nMeine eigene Vorbereitungsnotiz zu Punkt 1.',
	);

	// Re-parse the SAME week, but with item 2's duration corrected (3 → 4 Min.) —
	// same number of items, same order, so the merge must succeed.
	const corrected = mwb({
		weeks: [week({
			items: [
				item({ number: 1, section: 'treasures' }),
				item({
					number: 2, section: 'ministry', title: 'Testdienst', durationMin: 4,
					paragraphs: [textParagraph('**VON HAUS ZU HAUS.** Sprich mit jemandem über eine Testwahrheit.')],
				}),
				item({ number: 3, section: 'living', title: 'Versammlungsbibelstudium', durationMin: 30, isCongregationBibleStudy: true }),
			],
		})],
	});
	const fresh = b.buildNotes(corrected).notes[0].content;

	const merged = mergeNoteContent(withUserNotes, fresh);
	assert.ok(merged, 'merge must succeed when item count/order is unchanged');
	assert.match(merged, /Meine eigene Vorbereitungsnotiz zu Punkt 1\./, 'user note must survive the merge');
	assert.match(merged, /\*\*Dauer:\*\* 4 Min\./, 'corrected duration must be picked up');
	assert.doesNotMatch(merged, /\*\*Dauer:\*\* 3 Min\./);
});

test('merge returns null (needs full reimport) when the number of items changes between re-imports', () => {
	const b = builder();
	const original = b.buildNotes(mwb()).notes[0].content;

	const changed = mwb({
		weeks: [week({
			items: [
				item({ number: 1, section: 'treasures' }),
				item({ number: 2, section: 'living', title: 'Versammlungsbibelstudium', durationMin: 30, isCongregationBibleStudy: true }),
			],
		})],
	});
	const fresh = b.buildNotes(changed).notes[0].content;

	assert.equal(mergeNoteContent(original, fresh), null);
});

// ── Korean workbooks ────────────────────────────────────────────────────────

function koreanMwb() {
	return mwb({
		lang: 'ko',
		weeks: [week({
			dateRangeLabel: '1월 5-11일',
			openingSong: song({ songNumber: 153, songDocid: 1102022953, includesPrayer: true, includesIntroWords: true }),
			closingSong: song({ songNumber: 73, songDocid: 1102016873, includesPrayer: true }),
			items: [
				item({ number: 1, section: 'treasures', title: '예시 제목', durationMin: 10 }),
				item({ number: 2, section: 'living', title: '회중 성서 연구', durationMin: 30, isCongregationBibleStudy: true }),
			],
		})],
	});
}

test('a Korean issue folder uses the publication\u2019s own short title and month wording', () => {
	// "생활과 봉사" is the publication's short title, "2026년 1-2월" its cover's.
	assert.equal(builder().issueFolderName(koreanMwb()), '생활과 봉사 2026년 1-2월');
	assert.equal(builder().issueFolderName(mwb({ lang: 'ko', issueTagNumber: '20261100' })), '생활과 봉사 2026년 11-12월');
	assert.equal(builder().issueFolderName(mwb({ lang: 'ko', issueTagNumber: 'x' })), '생활과 봉사 2026년');
});

test('a Korean week note is written in Korean throughout', () => {
	const note = builder().buildNotes(koreanMwb()).notes[0].content;
	assert.match(note, /## 성경에 담긴 보물/);
	assert.match(note, /## 그리스도인 생활/);
	assert.match(note, /\*\*소요 시간:\*\* 10분/);
	assert.match(note, /\*\*이번 주 성경 읽기:\*\* /);
	// The workbook prints a song without the 번 the convention programmes use.
	assert.match(note, /\[노래 153\]\(https:\/\/www\.jw\.org\/finder\?[^)]*wtlocale=KO[^)]*\) 및 기도 \| 소개말/);
	assert.match(note, /\*\*맺음말\*\* \| \[노래 73\]/);
	assert.match(note, /jwlibrary:[^)]*wtlocale=KO/);
	assert.doesNotMatch(note, /Lied|Gebet|Schlussworte|Min\.|Wochenlesung|Dauer/);
});

test('a German week note is written exactly as before', () => {
	const note = builder().buildNotes(mwb()).notes[0].content;
	assert.match(note, /\*\*Dauer:\*\* 10 Min\./);
	assert.match(note, /\[Lied 1\]\(https:\/\/www\.jw\.org\/finder\?[^)]*wtlocale=X/);
	assert.match(note, /\*\*Schlussworte\*\* \| \[Lied 3\]/);
});
