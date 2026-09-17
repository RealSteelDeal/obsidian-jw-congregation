// Dev tool: reads the Bible book names out of a Bible jwpub (nwt / nwtsty).
//
// Adding a language needs three facts, and this covers the one nothing else
// does. The MEPS locale symbol for the wtlocale= link parameter comes from
// jw.org's own media API (GETPUBMEDIALINKS?pub=nwt&langwritten=<symbol>, which
// answers with the language's own name), and Publication.MepsLanguageIndex is
// already the first line dump-structure.mjs prints. The 66 book names for
// src/normalizer/bookNames.ts are only in here.
//
// --compare=<lang> is the important part, not a convenience. It diffs the
// file's own titles against what bookNames.ts already holds for a language
// this project supports, so the METHOD can be checked before its result is
// trusted for a language nobody here reads. That caught a real error: for
// German, BookDisplayTitle holds the formal title ("Das erste Buch Mose
// (Genesis)"), not the short form used when citing ("1. Mose") — all 66 names
// would have been wrong while looking perfectly plausible. Korean happens to
// put the short form in that same column. Always run a compare against a known
// language first, and treat a column that disagrees there as unproven for the
// new language too.
//
// Usage:
//   node scripts/dump-book-names.mjs <file.jwpub> [more.jwpub ...]
//   node scripts/dump-book-names.mjs --compare=de <german.jwpub>
import { parseHTML } from 'linkedom';
import { createJiti } from 'jiti';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

globalThis.DOMParser = class {
	parseFromString(html) { return parseHTML(html).document; }
};

const jiti = createJiti(import.meta.url);
const { openJwpubDatabase, readPublication } = await jiti.import(
	fileURLToPath(new URL('../src/util/jwpubCrypto.ts', import.meta.url)),
);
const { getBookName } = await jiti.import(
	fileURLToPath(new URL('../src/normalizer/bookNames.ts', import.meta.url)),
);

const wasmBinary = readFileSync(
	fileURLToPath(new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url)),
);

const args = process.argv.slice(2);
const compareLang = args.find(a => a.startsWith('--compare='))?.slice('--compare='.length);
const files = args.filter(a => !a.startsWith('--'));

if (files.length === 0) {
	console.error('usage: node scripts/dump-book-names.mjs [--compare=<lang>] <file.jwpub> ...');
	process.exit(1);
}

for (const path of files) {
	console.log('\n' + '='.repeat(70));
	console.log('FILE: ' + path);

	const { db } = await openJwpubDatabase(new Uint8Array(readFileSync(path)), wasmBinary);
	const pub = readPublication(db);
	console.log(`Publication: Symbol=${pub['Symbol']}  Year=${pub['Year']}  MepsLanguageIndex=${pub['MepsLanguageIndex']}`);

	const result = db.exec(
		'SELECT BibleBookId, BookDisplayTitle, ChapterDisplayTitle FROM BibleBook ORDER BY BibleBookId',
	);
	if (!result[0]) {
		console.log('No BibleBook table — not a Bible publication?');
		continue;
	}

	// Both columns are printed because which one carries the citation form
	// differs by language (see the note at the top of this file).
	let mismatches = 0;
	for (const [id, bookTitle, chapterTitle] of result[0].values) {
		const line = `${String(id).padStart(2)}  BookDisplayTitle="${bookTitle}"  ChapterDisplayTitle="${chapterTitle}"`;
		if (!compareLang) {
			console.log(line);
			continue;
		}
		const known = getBookName(Number(id), compareLang);
		const agrees = known === bookTitle || known === chapterTitle;
		if (!agrees) mismatches++;
		console.log(`${line}  bookNames.ts="${known}"${agrees ? '' : '   <-- neither column matches'}`);
	}

	console.log(`${result[0].values.length} books`);
	if (compareLang) {
		console.log(mismatches === 0
			? `Compare against "${compareLang}": every book matches one of the two columns.`
			: `Compare against "${compareLang}": ${mismatches} of ${result[0].values.length} match NEITHER column — `
				+ 'do not trust either column as the citation form for an unknown language.');
	}
}
