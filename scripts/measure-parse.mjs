/**
 * Misst, wie lange das Einlesen einer .jwpub den Haupt-Thread blockiert — Grundlage für die
 * Entscheidung „Import in einen Web Worker auslagern" (ROADMAP.md, „Later").
 *
 * Fährt denselben Code wie das Plugin (über jiti, DOMParser via linkedom wie in
 * test-parse.mjs). Die Art wird aus Publication.EnglishSymbol erkannt:
 *   mwb…  → MwbSourceRouter.route()  (Arbeitsheft-Import/-Update)
 *   nwt…  → BibleReader.load()       (erster Klick aufs Bibeltext-Popup)
 *   sonst → SourceRouter.route()     (Kongress-Import/-Update)
 *
 * Je Datei und Lauf:
 *   gesamt     Wanduhrzeit des Aufrufs
 *   blockiert  längste Strecke am Stück, in der die Event-Loop nicht drankam — das ist
 *              das, was in Obsidian als „eingefroren" spürbar wird
 *   öffnen     nur Entpacken + SQLite laden (openJwpubDatabase), separat gemessen
 * Lauf 1 durchläuft den Parser-Code zum ersten Mal (JIT) und kommt dem ersten Import nach
 * dem Obsidian-Start am nächsten; ab Lauf 2 wird der Median gebildet.
 *
 * Grenze: Node statt Electron, linkedom statt des nativen DOMParser. V8 ist dasselbe, das
 * HTML-Parsen kann in Obsidian schneller oder langsamer sein. Die Werte zeigen die
 * Größenordnung und welche Datei am teuersten ist, nicht die exakte Zahl in Obsidian.
 *
 * Usage: node scripts/measure-parse.mjs [--runs=5] <datei.jwpub> [weitere ...]
 */
import { parseHTML } from 'linkedom';
import { createJiti } from 'jiti';
import { readFileSync, statSync } from 'fs';
import { basename } from 'path';
import { fileURLToPath } from 'url';
import { monitorEventLoopDelay, performance } from 'perf_hooks';

globalThis.DOMParser = class {
	parseFromString(html) {
		return parseHTML(html).document;
	}
};

const src = rel => fileURLToPath(new URL(`../src/${rel}`, import.meta.url));
const jiti = createJiti(import.meta.url);
const { SourceRouter } = await jiti.import(src('parser/SourceRouter.ts'));
const { MwbSourceRouter } = await jiti.import(src('parser/MwbSourceRouter.ts'));
const { BibleReader } = await jiti.import(src('bible/BibleReader.ts'));
const { openJwpubDatabase, readPublication } = await jiti.import(src('util/jwpubCrypto.ts'));
const { englishSymbol } = await jiti.import(src('util/jwpubLinks.ts'));

const wasmBinary = new Uint8Array(readFileSync(
	fileURLToPath(new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url)),
));

const args = process.argv.slice(2);
const runsArg = args.find(a => a.startsWith('--runs='));
const runs = runsArg ? Math.max(1, Number(runsArg.slice('--runs='.length))) : 5;
const files = args.filter(a => !a.startsWith('--'));
if (!files.length) {
	console.error('Usage: node scripts/measure-parse.mjs [--runs=5] <datei.jwpub> [weitere ...]');
	process.exit(1);
}

async function detectKind(data) {
	const { db } = await openJwpubDatabase(data, wasmBinary);
	const symbol = englishSymbol(readPublication(db));
	db.close();
	if (/^mwb/i.test(symbol)) return { kind: 'mwb', symbol };
	if (/^nwt/i.test(symbol)) return { kind: 'bibel', symbol };
	return { kind: 'kongress', symbol };
}

async function runOnce(kind, filename, data) {
	switch (kind) {
		case 'mwb':
			await new MwbSourceRouter(wasmBinary).route(filename, data);
			return;
		case 'bibel':
			await new BibleReader(wasmBinary).load(data);
			return;
		default: {
			const result = await new SourceRouter(wasmBinary).route(filename, data);
			// SourceRouter fällt bei einem jwpub-Fehler still auf RTF zurück — dann wäre
			// etwas anderes gemessen worden als der echte Import.
			if (result.source !== 'jwpub') throw new Error(`jwpub-Parse fehlgeschlagen, RTF-Fallback (${result.source})`);
		}
	}
}

async function measure(fn) {
	const loop = monitorEventLoopDelay({ resolution: 1 });
	loop.enable();
	const start = performance.now();
	await fn();
	const total = performance.now() - start;
	// Ein Tick nach dem Ende, damit die letzte blockierte Strecke im Histogramm landet.
	await new Promise(resolve => setTimeout(resolve, 5));
	loop.disable();
	return { total, blocked: loop.max / 1e6 };
}

const median = values => {
	const s = [...values].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const ms = v => `${Math.round(v).toString().padStart(6)} ms`;

const summary = [];
for (const path of files) {
	const filename = basename(path);
	const data = new Uint8Array(readFileSync(path));
	const sizeMb = statSync(path).size / 1024 / 1024;
	let kind, symbol;
	try {
		({ kind, symbol } = await detectKind(data));
	} catch (err) {
		console.log(`\n${filename}: keine lesbare .jwpub — ${err.message ?? err}`);
		continue;
	}

	console.log(`\n${filename}  (${sizeMb.toFixed(1)} MB, ${symbol}, ${kind})`);
	const rows = [];
	for (let i = 1; i <= runs; i++) {
		let full;
		try {
			full = await measure(() => runOnce(kind, filename, data));
		} catch (err) {
			console.log(`  Lauf ${i}: Fehler — ${err.message ?? err}`);
			break;
		}
		const open = await measure(async () => (await openJwpubDatabase(data, wasmBinary)).db.close());
		rows.push({ ...full, open: open.total });
		console.log(`  Lauf ${i}${i === 1 ? ' (erster)' : '         '}  gesamt ${ms(full.total)}   blockiert ${ms(full.blocked)}   öffnen ${ms(open.total)}`);
	}
	if (!rows.length) continue;
	const warm = rows.length > 1 ? rows.slice(1) : rows;
	const result = {
		filename, kind,
		total: median(warm.map(r => r.total)),
		blocked: median(warm.map(r => r.blocked)),
		coldTotal: rows[0].total,
	};
	console.log(`  Median ab Lauf 2 gesamt ${ms(result.total)}   blockiert ${ms(result.blocked)}`);
	summary.push(result);
}

// Kongress und Arbeitsheft lesen beim Import zweimal: einmal für die Vorschau nach der
// Dateiauswahl, einmal beim Klick auf „Importieren".
console.log('\nZusammenfassung (Median ab Lauf 2)');
for (const r of summary) {
	const importTotal = r.kind === 'bibel' ? '' : `   Import (Vorschau + Import) ≈ ${ms(r.total * 2)}`;
	console.log(`  ${r.filename.padEnd(34)} ${r.kind.padEnd(8)} blockiert ${ms(r.blocked)}   je Aufruf ${ms(r.total)}   erster ${ms(r.coldTotal)}${importTotal}`);
}
