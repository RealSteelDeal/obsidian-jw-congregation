/**
 * End-to-End-Test: Parst jwpub-Dateien mit dem echten JwpubParser (src/parser/JwpubParser.ts)
 * über jiti (TypeScript direkt in Node, ohne separaten Build-Schritt) und gibt das
 * Datenmodell aus. DOMParser wird via linkedom injiziert (Electron hat ihn nativ).
 *
 * Usage: node scripts/test-parse.mjs <datei1.jwpub> [datei2.jwpub ...]
 */
import { parseHTML } from 'linkedom';
import { createJiti } from 'jiti';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

// Inject DOMParser into global (mimics Electron renderer)
globalThis.DOMParser = class {
	parseFromString(html) {
		return parseHTML(html).document;
	}
};

const jiti = createJiti(import.meta.url);
const { JwpubParser } = await jiti.import(
	fileURLToPath(new URL('../src/parser/JwpubParser.ts', import.meta.url)),
);

const wasmBinary = readFileSync(
	fileURLToPath(new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url)),
);

function summarize(scriptures) {
	return scriptures.map(s => `${s.book}:${s.chapter}:${s.verseStart}${s.verseEnd ? `-${s.verseEnd}` : ''}`).join(', ');
}

function printItem(item, indent = '      ') {
	const partsStr = item.parts?.length ? ` [${item.parts.length} Teile]` : '';
	console.log(`${indent}${item.time}  [${item.itemType}]  ${item.title}${partsStr}`);
	if (item.scriptures.length) console.log(`${indent}       Texte: ${summarize(item.scriptures)}`);
	if (item.subtitle) console.log(`${indent}       Untertitel: ${item.subtitle}`);
	for (const part of item.parts ?? []) {
		console.log(`${indent}  • ${part.title}${part.scriptures.length ? ` — ${summarize(part.scriptures)}` : ''}`);
	}
}

async function parseFile(path) {
	console.log(`\n${'='.repeat(60)}`);
	console.log(`Parsing: ${path}`);

	const parser = new JwpubParser(wasmBinary);
	const congress = await parser.parse(readFileSync(path));

	console.log(`Typ: ${congress.type}   Motto: ${congress.theme}   Jahr: ${congress.year}`);
	for (const day of congress.days) {
		const itemCount = day.sessions.flatMap(s => s.items).length;
		console.log(`\n  [${day.name}] ${day.sessions.length} Sessions, ${itemCount} Programmpunkte`);
		for (const session of day.sessions) {
			console.log(`    -- ${session.name} --`);
			for (const item of session.items) printItem(item);
		}
	}
	console.log(`\n✓ ${congress.days.length} Tag(e) geparst.`);
}

const files = process.argv.slice(2);
if (files.length === 0) {
	console.error('Usage: node scripts/test-parse.mjs <datei1.jwpub> [datei2.jwpub ...]');
	process.exit(1);
}

for (const f of files) {
	await parseFile(f);
}
