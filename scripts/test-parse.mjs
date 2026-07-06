/**
 * End-to-End-Test: Parst alle 3 jwpub-Dateien und gibt das Datenmodell aus.
 * Simuliert DOMParser via linkedom (Electron hat ihn nativ).
 * Usage: node scripts/test-parse.mjs
 */
import { parseHTML } from 'linkedom';
import AdmZip from 'adm-zip';
import initSqlJs from 'sql.js';
import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
import { readFileSync } from 'fs';

const inflate = promisify(zlib.inflate);

// Inject DOMParser into global (mimics Electron renderer)
globalThis.DOMParser = class {
  parseFromString(html, type) {
    return parseHTML(html).document;
  }
};

const XOR = Buffer.from(
  '11cbb5587e32846d4c26790c633da289f66fe5842a3a585ce1bc3a294af5ada7',
  'hex',
);

const BIBLE_HREF_RE = /^jwpub:\/\/b\/NWTR\/([\d:]+(?:-[\d:]+)?)$/;
const SONG_HREF_RE  = /^jwpub:\/\/p\/X:/;
const TIME_RE       = /^\s*(\d{1,2}:\d{2})/;
const SKIP_TEXT_RE  = /^\s*\d{1,2}:\d{2}\s+(Musik(?:video)?)\s*$/i;

async function parseFile(path) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Parsing: ${path}`);

  const data    = readFileSync(path);
  const outer   = new AdmZip(data);
  const inner   = new AdmZip(outer.getEntry('contents').getData());
  const dbEntry = inner.getEntries().find(e => e.entryName.endsWith('.db'));

  const SQL = await initSqlJs();
  const db  = new SQL.Database(dbEntry.getData());

  function rows(sql) {
    const res = db.exec(sql);
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
  }

  const pub = rows('SELECT * FROM Publication LIMIT 1')[0];
  const mepsLang = Number(pub.MepsLanguageIndex);
  const symbol   = String(pub.Symbol);
  const year     = Number(pub.Year);
  const issueTag = Number(pub.IssueTagNumber);
  let card = `${mepsLang}_${symbol}_${year}`;
  if (issueTag !== 0) card += `_${issueTag}`;

  const hash  = crypto.createHash('sha256').update(card).digest();
  const xored = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xored[i] = hash[i] ^ XOR[i];
  const key = xored.subarray(0, 16);
  const iv  = xored.subarray(16, 32);

  const metaRows = rows('SELECT DocumentId, MetadataKey, Value FROM DocumentMetadata');
  const meta = new Map();
  for (const r of metaRows) {
    const d = Number(r.DocumentId);
    if (!meta.has(d)) meta.set(d, new Map());
    meta.get(d).set(String(r.MetadataKey), String(r.Value ?? ''));
  }

  const theme = meta.get(0)?.get('MEPS:Title') ?? '';
  console.log(`Theme: ${theme}   Symbol: ${symbol}   Year: ${year}`);

  const docs = rows('SELECT DocumentId, Title, Content FROM Document ORDER BY DocumentId');
  const days = [];

  for (const doc of docs) {
    const docId = Number(doc.DocumentId);
    const raw   = Buffer.from(doc.Content);
    let html;
    try {
      const dec = Buffer.concat([
        crypto.createDecipheriv('aes-128-cbc', key, iv).update(raw),
        crypto.createDecipheriv('aes-128-cbc', key, iv).final(),
      ]);
      // ↑ bug: need single decipher instance
    } catch {}

    // Fix: single decipher
    try {
      const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
      const dec = Buffer.concat([decipher.update(raw), decipher.final()]);
      const inf = await inflate(dec);
      html = inf.toString('utf-8');
    } catch (e) {
      console.log(`  Doc ${docId}: decrypt failed (${e.message})`);
      continue;
    }

    const dom     = new DOMParser().parseFromString(html, 'text/html');
    const h1Text  = dom.querySelector('h1')?.textContent?.trim() ?? '';
    const dayMatch = /\b(Freitag|Samstag|Sonntag)\b/i.exec(h1Text);
    const hasSession = dom.querySelector('.bodyTxt h2') !== null;
    if (!dayMatch && !hasSession) {
      console.log(`  Doc ${docId} "${doc.Title}": kein Wochentag → übersprungen`);
      continue;
    }
    const dayName = dayMatch ? dayMatch[1] : 'Samstag';

    const sessions = parseSessions(dom, dayName);
    const itemCount = sessions.flatMap(s => s.items).length;
    console.log(`\n  Doc ${docId} "${doc.Title}" → ${sessions.length} Sessions, ${itemCount} Programmpunkte`);

    for (const session of sessions) {
      console.log(`    [${session.name}]`);
      for (const item of session.items) {
        const refStr = item.scriptures.map(s => `${s.book}:${s.chapter}:${s.verseStart}`).join(', ');
        const partsStr = item.parts?.length ? ` [${item.parts.length} Teile]` : '';
        console.log(`      ${item.time}  [${item.itemType}]  ${item.title}${partsStr}`);
        if (refStr) console.log(`             Texte: ${refStr}`);
        if (item.subtitle) console.log(`             Untertitel: ${item.subtitle}`);
        if (item.parts?.length) {
          item.parts.forEach(p => console.log(`               • ${p.title}`));
        }
      }
    }

    days.push({ name: dayName, sessions });
  }

  db.close();
  console.log(`\n✓ ${days.length} Tag(e) geparst.`);
}

function parseSessions(dom, dayName) {
  const bodyTxt = dom.querySelector('.bodyTxt');
  if (!bodyTxt) return [];

  const sessions = [];
  let sessionName = 'Vormittag';
  let items = [];

  for (const child of Array.from(bodyTxt.children)) {
    if (child.tagName === 'H2') {
      if (items.length > 0) { sessions.push({ name: sessionName, items }); items = []; }
      sessionName = child.textContent?.trim() ?? 'Vormittag';
      continue;
    }
    if (child.tagName === 'UL') {
      for (const li of Array.from(child.children)) {
        if (li.tagName !== 'LI') continue;
        const item = parseLi(li);
        if (item) items.push(item);
      }
    }
  }
  if (items.length > 0) sessions.push({ name: sessionName, items });
  return sessions;
}

function parseLi(li) {
  const firstP = li.querySelector('p');
  if (!firstP) return null;

  const firstText = firstP.textContent ?? '';
  const timeMatch = TIME_RE.exec(firstText);
  if (!timeMatch) return null;
  const time = timeMatch[1];

  if (SKIP_TEXT_RE.test(firstText)) return null;

  const hasSong  = li.querySelector('a[href^="jwpub://p/X:"]') !== null;
  const hasBible = li.querySelector('a[href^="jwpub://b/NWTR/"]') !== null;
  if (hasSong && !hasBible) return null;

  const [itemType, hasTypeMarker] = detectType(li);

  const scriptures = extractScriptures(li);

  if (itemType === 'bible-drama') {
    const ps = Array.from(li.querySelectorAll('p'));
    const title    = ps[1]?.textContent?.trim() || 'Bibeldrama';
    const subtitle = ps[2]?.textContent?.trim() || undefined;
    return { time, itemType, title, subtitle, scriptures, bulletPoints: [] };
  }

  if (itemType === 'talk-series') {
    const title = extractTitle(firstP, time, hasTypeMarker);
    if (!title) return null;
    const parts = [];
    const src = li.querySelector('ul.source');
    if (src) {
      let idx = 1;
      for (const subLi of Array.from(src.children)) {
        if (subLi.tagName !== 'LI') continue;
        const subP = subLi.querySelector('p');
        if (!subP) continue;
        const subTitle = (subP.textContent ?? '').replace(/^[•\-]\s*/, '').trim();
        if (!subTitle) continue;
        parts.push({ time: '', itemType: 'talk', title: `${idx}. ${subTitle}`, scriptures: extractScriptures(subLi), bulletPoints: [] });
        idx++;
      }
    }
    return { time, itemType, title, scriptures, bulletPoints: [], parts };
  }

  const title = extractTitle(firstP, time, hasTypeMarker);
  if (!title) return null;
  return { time, itemType, title, scriptures, bulletPoints: [] };
}

function detectType(li) {
  const spanText   = (li.querySelector('span[class*="du-color--"]')?.textContent ?? '').toUpperCase();
  const firstP     = li.querySelector('p');
  const strongText = (firstP?.querySelector('strong')?.textContent ?? '').toUpperCase();
  const marker = spanText || strongText;
  if (/BIBELDRAMA|BIBLE\s*DRAMA/.test(marker)) return ['bible-drama', true];
  if (/VORTRAGSREIHE|SYMPOSIUM/.test(marker))  return ['talk-series', true];
  if (/TAUFE|BAPTISM/.test(marker))            return ['baptism', true];
  if (/INTERVIEW/.test(marker))                return ['interview', true];
  if (/VORTRAG|TALK|REDE/.test(marker))        return ['talk', true];
  return ['talk', false];
}

function extractTitle(p, time, hasTypeMarker) {
  let text = p.textContent ?? '';
  text = text.replace(TIME_RE, '').trim();
  if (hasTypeMarker) text = text.replace(/^[^:]+:\s*/, '').trim();
  text = text.replace(/^[-–—·]\s*/, '').trim();
  return text;
}

function extractScriptures(container) {
  const out = [];
  for (const a of Array.from(container.querySelectorAll('a[href]'))) {
    const href = a.getAttribute('href') ?? '';
    const m = BIBLE_HREF_RE.exec(href);
    if (!m || !m[1]) continue;
    try {
      const parts = m[1].split('-');
      const [b, c, v] = (parts[0] ?? '').split(':').map(Number);
      const scripture = { book: b, chapter: c, verseStart: v };
      if (parts[1]) {
        const [,, ve] = (parts[1] ?? '').split(':').map(Number);
        if (ve) scripture.verseEnd = ve;
      }
      out.push(scripture);
    } catch {}
  }
  return out;
}

const files = [
  'C:\\Users\\LukasSchütter\\Downloads\\CO-pgm26_X.jwpub',
  'C:\\Users\\LukasSchütter\\Downloads\\CA-copgm27_X.jwpub',
  'C:\\Users\\LukasSchütter\\Downloads\\CA-brpgm27_X.jwpub',
];

for (const f of files) {
  await parseFile(f);
}
