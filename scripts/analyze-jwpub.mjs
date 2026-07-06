/**
 * Analyse-Skript für jwpub-Dateien.
 * Usage: node scripts/analyze-jwpub.mjs <path-to.jwpub>
 */
import AdmZip from 'adm-zip';
import initSqlJs from 'sql.js';
import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { basename, join } from 'path';

const inflate = promisify(zlib.inflate);

const XOR_CONSTANT = Buffer.from(
  '11cbb5587e32846d4c26790c633da289f66fe5842a3a585ce1bc3a294af5ada7',
  'hex',
);

function rows(result) {
  if (!result[0]) return [];
  return result[0].values.map(row =>
    Object.fromEntries(result[0].columns.map((c, i) => [c, row[i]]))
  );
}

async function analyzeJwpub(filePath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Analysiere: ${filePath}`);

  const data = readFileSync(filePath);
  const outerZip = new AdmZip(data);
  const contentsEntry = outerZip.getEntry('contents');
  if (!contentsEntry) throw new Error('Kein "contents"-Eintrag');

  const innerZip = new AdmZip(contentsEntry.getData());
  const dbEntry = innerZip.getEntries().find(e => e.entryName.endsWith('.db'));
  if (!dbEntry) throw new Error('Keine .db-Datei');

  const SQL = await initSqlJs();
  const db = new SQL.Database(dbEntry.getData());

  // Publication
  const pub = rows(db.exec('SELECT * FROM Publication LIMIT 1'))[0];
  console.log('\n[Publication]');
  console.log(JSON.stringify(pub, null, 2));

  const MepsLanguageIndex = Number(pub.MepsLanguageIndex);
  const Symbol = String(pub.Symbol);
  const Year = Number(pub.Year);
  const IssueTagNumber = Number(pub.IssueTagNumber); // cast! string "0" fix

  let cardString = `${MepsLanguageIndex}_${Symbol}_${Year}`;
  if (IssueTagNumber !== 0) cardString += `_${IssueTagNumber}`;
  console.log(`\n[CardString] ${cardString}`);

  const hash = crypto.createHash('sha256').update(cardString).digest();
  const xored = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xored[i] = hash[i] ^ XOR_CONSTANT[i];
  const key = xored.subarray(0, 16);
  const iv  = xored.subarray(16, 32);
  console.log(`key: ${key.toString('hex')}`);
  console.log(`iv:  ${iv.toString('hex')}`);

  // BibleCitation
  console.log('\n[BibleCitation (alle)]');
  const cits = rows(db.exec('SELECT * FROM BibleCitation LIMIT 30'));
  cits.forEach(r => console.log(JSON.stringify(r)));

  // Hyperlink
  console.log('\n[Hyperlink (erste 20)]');
  const hls = rows(db.exec('SELECT * FROM Hyperlink LIMIT 20'));
  hls.forEach(r => console.log(JSON.stringify(r)));

  // DocumentMetadata
  console.log('\n[DocumentMetadata]');
  const meta = rows(db.exec('SELECT * FROM DocumentMetadata LIMIT 30'));
  meta.forEach(r => console.log(JSON.stringify(r)));

  // Decrypt all documents
  const docRows = rows(db.exec('SELECT DocumentId, Title, Content FROM Document ORDER BY DocumentId'));
  const outDir = join('scripts', 'out', basename(filePath, '.jwpub'));
  mkdirSync(outDir, { recursive: true });

  console.log(`\n[Dokumente] → ${outDir}/`);
  for (const doc of docRows) {
    const docId = doc.DocumentId;
    const title = doc.Title ?? '';
    const contentBuf = Buffer.from(doc.Content);
    process.stdout.write(`  Doc ${docId} "${title}" (${contentBuf.length}b enc) → `);

    try {
      const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
      const dec = Buffer.concat([decipher.update(contentBuf), decipher.final()]);
      const inf = await inflate(dec);
      const html = inf.toString('utf-8');
      process.stdout.write(`OK (${html.length} chars)\n`);
      const safeName = String(title).replace(/[^a-z0-9]/gi, '_').slice(0, 40);
      writeFileSync(join(outDir, `doc_${docId}_${safeName}.html`), html, 'utf-8');
    } catch (e) {
      process.stdout.write(`FEHLER: ${e.message}\n`);
    }
  }

  db.close();
  console.log('\n✓ Fertig.');
}

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/analyze-jwpub.mjs <datei.jwpub>'); process.exit(1); }
analyzeJwpub(file).catch(e => { console.error(e); process.exit(1); });
