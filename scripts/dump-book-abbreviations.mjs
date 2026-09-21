// Dev tool: harvests the Bible book abbreviations a publication actually
// prints, so BOOK_ABBREVIATIONS in src/normalizer/bookNames.ts can be filled
// from evidence instead of memory.
//
// Every scripture citation in a programme or meeting workbook is an
// <a href="jwpub://b/NWTR/B:C:V…"> whose visible text is the abbreviation as
// that publication writes it, while the href carries the book number. Reading
// the pair off the same element is what makes the result verified — the Bible
// jwpub itself is NOT a source here: its whole schema was searched on
// 21.09.2026 and carries no book abbreviation at all (the Symbol columns are
// publication symbols), because JW Library renders those labels itself.
//
// Only labels the current lookup cannot already resolve are reported; those
// are exactly the entries the table needs. Coverage is limited to the books a
// given file happens to cite, which is why BOOK_ABBREVIATIONS extends the
// prefix rule rather than replacing it — and why the output lists the books
// with no evidence at all, so nobody mistakes silence for confirmation.
//
// Usage:
//   node scripts/dump-book-abbreviations.mjs <lang> <file.jwpub> [more.jwpub ...]
//   node scripts/dump-book-abbreviations.mjs de ~/Obsidian/.dateien/Deutsch/*.jwpub
import { parseHTML } from 'linkedom';
import { createJiti } from 'jiti';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

globalThis.DOMParser = class {
	parseFromString(html) { return parseHTML(html).document; }
};

const jiti = createJiti(import.meta.url);
const { openJwpubDatabase, readPublication, deriveKey, decryptBlob } = await jiti.import(
	fileURLToPath(new URL('../src/util/jwpubCrypto.ts', import.meta.url)),
);
const { getBookName, lookupBookNumber } = await jiti.import(
	fileURLToPath(new URL('../src/normalizer/bookNames.ts', import.meta.url)),
);
const wasmBinary = readFileSync(
	fileURLToPath(new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url)),
);

// A book label: an optional ordinal ("1.", "2 "), then letters, spaces, dots
// and soft hyphens only. This is what separates a real label from the
// continuation links a citation list produces ("22, 23" in "Mat. 24:14;
// 22, 23") and from chapter-range reading headings ("JESAJA 17-20") — both
// are anchors with the same href shape and would otherwise be harvested as
// if they named a book.
const BOOK_LABEL_RE = /^(?:[123]\.?\s*)?\p{L}[\p{L}.­\s]*$/u;

const [lang, ...files] = process.argv.slice(2);
if (!lang || files.length === 0) {
	console.error('usage: node scripts/dump-book-abbreviations.mjs <lang> <file.jwpub> ...');
	process.exit(1);
}

const seen = new Map(); // label -> Map(book -> occurrences)

for (const file of files) {
	let db;
	let keyIv;
	try {
		({ db } = await openJwpubDatabase(new Uint8Array(readFileSync(file)), wasmBinary));
		keyIv = await deriveKey(readPublication(db));
	} catch (error) {
		console.log(`  (skipped ${path.basename(file)}: ${error.message})`);
		continue;
	}
	for (const [content] of db.exec('SELECT Content FROM Document')[0]?.values ?? []) {
		let html;
		try { html = await decryptBlob(content, keyIv.key, keyIv.iv); } catch { continue; }
		const dom = new DOMParser().parseFromString(html, 'text/html');
		for (const anchor of Array.from(dom.querySelectorAll('a[href^="jwpub://b/NWTR/"]'))) {
			const book = Number(/^jwpub:\/\/b\/NWTR\/(\d+):/.exec(anchor.getAttribute('href'))?.[1]);
			if (!book || book < 1 || book > 66) continue;
			const text = (anchor.textContent ?? '').replace(/\s+/g, ' ').trim();
			const label = text.replace(/\s*\d{1,3}\s*:\s*\d.*$/, '').trim();
			if (!BOOK_LABEL_RE.test(label)) continue;
			if (!seen.has(label)) seen.set(label, new Map());
			const byBook = seen.get(label);
			byBook.set(book, (byBook.get(book) ?? 0) + 1);
		}
	}
	db.close();
}

const missingEntries = [];
const conflicts = [];
const covered = new Set();

for (const [label, byBook] of [...seen].sort()) {
	// The same label pointing at different books means the harvest picked up
	// something that is not a book label after all — dropped, never resolved
	// by majority, since a wrong entry here would silently mislink references.
	if (byBook.size > 1) {
		conflicts.push(`${label} -> ${[...byBook.keys()].join('/')}`);
		continue;
	}
	const book = [...byBook.keys()][0];
	covered.add(book);
	if (lookupBookNumber(label, lang) === book) continue;
	missingEntries.push({ label, book, count: byBook.get(book) });
}

console.log(`\n${lang}: ${seen.size} usable labels, ${missingEntries.length} not resolvable today`);
for (const entry of missingEntries.sort((a, b) => a.book - b.book)) {
	console.log(`  ${String(entry.book).padStart(2)}  ${getBookName(entry.book, lang).padEnd(20)} "${entry.label}"  (${entry.count}x)`);
}
if (conflicts.length) console.log(`  dropped as ambiguous: ${conflicts.join(', ')}`);

const noEvidence = [];
for (let book = 1; book <= 66; book++) if (!covered.has(book)) noEvidence.push(getBookName(book, lang));
console.log(`  no evidence at all (${noEvidence.length}): ${noEvidence.join(', ')}`);
