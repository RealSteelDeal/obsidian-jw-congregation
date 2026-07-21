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

function item(overrides = {}) {
	return {
		number: 1,
		section: 'treasures',
		title: 'Testtitel',
		durationMin: 10,
		assignmentType: undefined,
		sourceCitation: undefined,
		scriptures: [{ book: 20, chapter: 16, verseStart: 20 }],
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
			item({ number: 2, section: 'ministry', title: 'Testdienst', assignmentType: 'VON HAUS ZU HAUS', durationMin: 3 }),
			item({ number: 3, section: 'living', title: 'Versammlungsbibelstudium', durationMin: 30, isCongregationBibleStudy: true }),
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

test('buildNotes produces exactly one note per week, named after the date-range label', () => {
	const result = builder().buildNotes(mwb({ weeks: [week({ dateRangeLabel: '1.-7. Januar' }), week({ dateRangeLabel: '8.-14. Januar' })] }));
	assert.equal(result.notes.length, 2);
	assert.deepEqual(result.notes.map(n => n.filename).sort(), ['1.-7. Januar.md', '8.-14. Januar.md']);
});

test('buildNotes adds one extra note for the Memorial reading schedule when present', () => {
	const result = builder().buildNotes(mwb({
		memorialReading: { title: 'Testleseprogramm', days: [{ dayLabel: 'TESTTAG', readings: [{ scripture: { book: 20, chapter: 1, verseStart: 1 } }] }] },
	}));
	assert.equal(result.notes.length, 2);
	assert.ok(result.notes.some(n => n.filename === 'Bibelleseprogramm für das Gedächtnismahl.md'));
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

test('week note shows the assignment-type label and duration for items that have them', () => {
	const result = builder().buildNotes(mwb());
	const content = result.notes[0].content;
	assert.match(content, /\*VON HAUS ZU HAUS\*/);
	assert.match(content, /\*\*Dauer:\*\* 3 Min\./);
});

test('duration and source-citation fields are omitted when their toggles are off', () => {
	const result = builder({ showDurationField: false, showSourceCitationField: false }).buildNotes(
		mwb({ weeks: [week({ items: [item({ sourceCitation: 'Testquelle Lektion 1' })] })] }),
	);
	const content = result.notes[0].content;
	assert.doesNotMatch(content, /\*\*Dauer:\*\*/);
	assert.doesNotMatch(content, /Testquelle Lektion 1/);
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

test('Memorial-reading note renders one checkbox line per reading, grouped under each day heading', () => {
	const result = builder().buildNotes(mwb({
		memorialReading: {
			title: 'Testleseprogramm',
			intro: 'Testeinleitung',
			days: [
				{ dayLabel: 'TESTTAG EINS', readings: [{ scripture: { book: 20, chapter: 1, verseStart: 1 }, sourceCitation: 'Testquelle' }] },
				{ dayLabel: 'TESTTAG ZWEI', readings: [{ scripture: { book: 20, chapter: 2, verseStart: 2 } }] },
			],
		},
	}));
	const note = result.notes.find(n => n.filename === 'Bibelleseprogramm für das Gedächtnismahl.md');
	assert.match(note.content, /# Testleseprogramm/);
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
				item({ number: 2, section: 'ministry', title: 'Testdienst', assignmentType: 'VON HAUS ZU HAUS', durationMin: 4 }),
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
