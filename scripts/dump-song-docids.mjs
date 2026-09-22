// Dev tool: reads the song number → MepsDocumentId mapping out of a songbook
// jwpub (sjj/sjjm), the one fact a song link needs and cannot derive.
//
// The link SHAPE is already settled and confirmed on a real device (see
// NoteBuilder.songLink): https://www.jw.org/finder?…&docid=<id>. What no
// formula supplies is the id itself — "Lied 14/54/94" happen to sit at
// 1102016800 + n, but Lied 160 is 1102022960, not the predicted 1102016960.
// Hence this: read it, never compute it.
//
// Usage: node scripts/dump-song-docids.mjs <file.jwpub> [--json] [--check]
//   --json   print the table as JSON, ready to paste into a source file
//   --check  verify the four cases documented in NoteBuilder.songLink
import { parseHTML } from 'linkedom';
import { createJiti } from 'jiti';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

globalThis.DOMParser = class {
	parseFromString(html) { return parseHTML(`<html><body>${html}</body></html>`).document; }
};

const jiti = createJiti(import.meta.url);
const { openJwpubDatabase, readPublication } = await jiti.import(
	fileURLToPath(new URL('../src/util/jwpubCrypto.ts', import.meta.url)),
);

const wasmBinary = readFileSync(
	fileURLToPath(new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url)),
);

function rows(result) {
	if (!result[0]) return [];
	return result[0].values.map(row => Object.fromEntries(result[0].columns.map((c, i) => [c, row[i]])));
}

const args = process.argv.slice(2);
const files = args.filter(a => !a.startsWith('--'));
const asJson = args.includes('--json');
const check = args.includes('--check');

for (const path of files) {
	const data = new Uint8Array(readFileSync(path));
	const { db } = await openJwpubDatabase(data, wasmBinary);
	const pub = readPublication(db);

	if (!asJson) {
		console.log('\n' + '='.repeat(70));
		console.log('FILE:', path);
		console.log('Publication:', JSON.stringify({
			Symbol: pub['Symbol'], Year: pub['Year'],
			MepsLanguageIndex: pub['MepsLanguageIndex'],
		}));
		// Print the schema once, so a wrong column assumption shows up here
		// rather than as silently missing songs.
		const tables = rows(db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"));
		console.log('Tables:', tables.map(t => t.name).join(', '));
		const cols = rows(db.exec('PRAGMA table_info(Document)'));
		console.log('Document columns:', cols.map(c => c.name).join(', '));
	}

	const docs = rows(db.exec(
		'SELECT DocumentId, MepsDocumentId, ChapterNumber, Title FROM Document ORDER BY DocumentId',
	));

	// The song number is Document.ChapterNumber, and the id is
	// Document.MepsDocumentId — established on 22.09.2026 against this file,
	// then confirmed twice over: the four ids NoteBuilder.songLink documents
	// from real shared links all match, and the same ids appear in the
	// convention programmes of German, English and Russian alike.
	//
	// Not the title (those are song titles, not numbers) and not the position
	// (front matter and indexes sit among the songs).
	const table = {};
	const unmatched = [];
	for (const doc of docs) {
		const num = doc.ChapterNumber === null || doc.ChapterNumber === undefined ? undefined : Number(doc.ChapterNumber);
		if (num === undefined || !doc.MepsDocumentId) {
			unmatched.push({ DocumentId: doc.DocumentId, Title: String(doc.Title ?? '') });
			continue;
		}
		if (table[num] !== undefined && table[num] !== Number(doc.MepsDocumentId)) {
			console.error(`CONFLICT for song ${num}: ${table[num]} vs ${doc.MepsDocumentId}`);
		}
		table[num] = Number(doc.MepsDocumentId);
	}

	const numbers = Object.keys(table).map(Number).sort((a, b) => a - b);

	if (asJson) {
		console.log(JSON.stringify(table));
	} else {
		console.log(`Songs found: ${numbers.length} (${numbers[0]}–${numbers[numbers.length - 1]})`);
		const missing = [];
		for (let n = numbers[0]; n <= numbers[numbers.length - 1]; n++) if (table[n] === undefined) missing.push(n);
		console.log('Gaps in the range:', missing.length ? missing.join(', ') : 'none');
		console.log('Documents without a song number:', unmatched.length);
		for (const u of unmatched.slice(0, 10)) console.log('   ', u.DocumentId, JSON.stringify(u.Title));
		for (const n of [1, 14, 54, 94, 160, numbers[numbers.length - 1]]) {
			if (table[n] !== undefined) console.log(`  song ${String(n).padStart(3)} → ${table[n]}`);
		}
	}

	if (check) {
		// The four cases NoteBuilder.songLink documents from real, confirmed
		// links. Fixed before looking at this file, precisely so the result
		// cannot be talked into agreeing.
		const expected = { 14: 1102016814, 54: 1102016854, 94: 1102016894, 160: 1102022960 };
		let ok = true;
		for (const [n, want] of Object.entries(expected)) {
			const got = table[n];
			const verdict = got === want ? 'OK  ' : 'FAIL';
			if (got !== want) ok = false;
			console.log(`  ${verdict} song ${n}: expected ${want}, read ${got ?? '(missing)'}`);
		}
		// The formula must disagree for 160 — otherwise this file is not
		// evidence of anything a formula could not already do.
		console.log(`  formula for 160 would give ${1102016800 + 160} (real: ${table[160] ?? '?'})`);
		console.log(ok ? '\nCHECK PASSED' : '\nCHECK FAILED');
		if (!ok) process.exitCode = 1;
	}

	db.close();
}
