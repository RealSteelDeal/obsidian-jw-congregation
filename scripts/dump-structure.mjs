// Temporary dev dump: language-relevant structure of jwpub congress files.
import { parseHTML } from 'linkedom';
import { createJiti } from 'jiti';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

globalThis.DOMParser = class {
	parseFromString(html) { return parseHTML(html).document; }
};

const jiti = createJiti(import.meta.url);
const { openJwpubDatabase, readPublication, deriveKey, decryptBlob } = await jiti.import(
	fileURLToPath(new URL('../src/util/jwpubCrypto.ts', import.meta.url)),
);

const wasmBinary = readFileSync(
	fileURLToPath(new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url)),
);

function rows(result) {
	if (!result[0]) return [];
	return result[0].values.map(row => Object.fromEntries(result[0].columns.map((c, i) => [c, row[i]])));
}

for (const path of process.argv.slice(2)) {
	console.log('\n' + '='.repeat(70));
	console.log('FILE: ' + path);
	const data = new Uint8Array(readFileSync(path));
	const { db } = await openJwpubDatabase(data, wasmBinary);
	const pub = readPublication(db);
	console.log('Publication:', JSON.stringify({
		Symbol: pub['Symbol'], Year: pub['Year'],
		MepsLanguageIndex: pub['MepsLanguageIndex'], IssueTagNumber: pub['IssueTagNumber'],
	}));
	const keyIv = await deriveKey(pub);

	const docs = rows(db.exec('SELECT DocumentId, Content FROM Document ORDER BY DocumentId'));
	for (const doc of docs) {
		const docId = Number(doc.DocumentId);
		let html;
		try { html = await decryptBlob(doc.Content, keyIv.key, keyIv.iv); } catch { continue; }
		const dom = new DOMParser().parseFromString(html, 'text/html');
		const h1 = dom.querySelector('h1')?.textContent?.trim() ?? '(none)';
		const h2s = Array.from(dom.querySelectorAll('h2')).map(h => h.textContent.trim());
		console.log(`\n--- Doc ${docId}: h1="${h1}"  h2=[${h2s.join(' | ')}]`);

		const bodyTxt = dom.querySelector('.bodyTxt');
		if (!bodyTxt || h2s.length === 0) continue;
		for (const ul of Array.from(bodyTxt.querySelectorAll('ul'))) {
			if (ul.parentElement !== bodyTxt) continue;
			for (const li of Array.from(ul.children)) {
				if (li.tagName !== 'LI') continue;
				const p = li.querySelector('p');
				const text = (p?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 90);
				const span = li.querySelector('span[class*="du-color--"]')?.textContent?.trim();
				const strong = p?.querySelector('strong')?.textContent?.trim();
				const song = li.querySelector('a[href^="jwpub://p/"]')?.getAttribute('href');
				const flags = [span ? `SPAN="${span}"` : '', strong ? `STRONG="${strong}"` : '', song ? `SONG=${song}` : ''].filter(Boolean).join('  ');
				console.log(`   li: ${text}${flags ? '\n       ' + flags : ''}`);
			}
		}
	}
}
