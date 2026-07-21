import { unzipSync, type Unzipped } from 'fflate';
import * as pako from 'pako';
import initSqlJs, { Database } from 'sql.js';
import { hexToBytes } from './bytes';
import { ParseError } from './parseErrors';
import { assertFileSize, assertInflatedBlobSize, assertUnpackedEntrySize } from './decompressionGuard';

// jwpub decryption spec §4.3 — shared by every jwpub-format file (congress
// programs, Bible publications, ...), since they all use the same
// Publication-table-derived key scheme.
const XOR_CONSTANT = hexToBytes(
	'11cbb5587e32846d4c26790c633da289f66fe5842a3a585ce1bc3a294af5ada7',
);

export interface DbRow {
	[col: string]: unknown;
}

/** Opens a jwpub file's outer+inner zip and the SQLite database inside it. */
export async function openJwpubDatabase(
	fileBuffer: Uint8Array,
	sqlWasmBinary: Uint8Array,
): Promise<{ db: Database; innerZip: Unzipped }> {
	assertFileSize(fileBuffer);
	const outerZip = unzipSync(fileBuffer);
	const contentsData = outerZip['contents'];
	if (!contentsData) throw new ParseError('jwpubMissingContents');
	assertUnpackedEntrySize(contentsData);

	const innerZip = unzipSync(contentsData);
	const dbFileName = Object.keys(innerZip).find(name => name.endsWith('.db'));
	if (!dbFileName) throw new ParseError('jwpubNoDatabase');
	assertUnpackedEntrySize(innerZip[dbFileName]!);

	const wasmBinary = sqlWasmBinary.buffer.slice(
		sqlWasmBinary.byteOffset,
		sqlWasmBinary.byteOffset + sqlWasmBinary.byteLength,
	) as ArrayBuffer;
	const SQL = await initSqlJs({ wasmBinary });
	return { db: new SQL.Database(innerZip[dbFileName]), innerZip };
}

export function readPublication(db: Database): DbRow {
	const res = db.exec('SELECT * FROM Publication LIMIT 1');
	if (!res[0]) throw new ParseError('jwpubEmptyPublication');
	const cols = res[0].columns;
	const vals = res[0].values[0] ?? [];
	return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
}

/** Derives the AES-128-CBC key/IV pair used to decrypt this publication's content blobs. */
export async function deriveKey(pub: DbRow): Promise<{ key: Uint8Array; iv: Uint8Array }> {
	const mepsLang = Number(pub['MepsLanguageIndex']);
	const symbol   = String(pub['Symbol']);
	const year     = Number(pub['Year']);
	const issueTag = Number(pub['IssueTagNumber']); // cast: sql.js may return string "0"

	let cardString = `${mepsLang}_${symbol}_${year}`;
	if (issueTag !== 0) cardString += `_${issueTag}`;

	const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cardString));
	const hash  = new Uint8Array(hashBuffer);
	const xored = new Uint8Array(32);
	for (let i = 0; i < 32; i++) xored[i] = (hash[i] ?? 0) ^ (XOR_CONSTANT[i] ?? 0);
	return { key: xored.subarray(0, 16), iv: xored.subarray(16, 32) };
}

/** Decrypts (AES-128-CBC) + decompresses (zlib) a jwpub content blob into its UTF-8 text. */
export async function decryptBlob(content: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<string> {
	// TS's lib.dom types BufferSource views as generic over ArrayBuffer
	// specifically (excluding SharedArrayBuffer); our views are always plain
	// ArrayBuffer-backed, so this cast just papers over that type-level
	// distinction, not a real runtime concern.
	const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-CBC', false, ['decrypt']);
	// WebCrypto's AES-CBC decrypt returns the fully-assembled plaintext (with
	// PKCS#7 padding already removed) in one call — no separate update()/final()
	// step like Node's streaming Decipher API.
	const decryptedBuffer = await crypto.subtle.decrypt(
		{ name: 'AES-CBC', iv: iv as BufferSource },
		cryptoKey,
		content as BufferSource,
	);
	const inflated = pako.inflate(new Uint8Array(decryptedBuffer));
	assertInflatedBlobSize(inflated);
	return new TextDecoder('utf-8').decode(inflated);
}
