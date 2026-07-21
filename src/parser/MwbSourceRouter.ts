import { Mwb } from '../models/mwb';
import { MwbParser } from './MwbParser';
import { ParseError } from '../util/parseErrors';
import { looksLikeJwpub } from '../util/fileSignature';
import { openJwpubDatabase, readPublication } from '../util/jwpubCrypto';

export type MwbParseResult = { mwb: Mwb; source: 'jwpub' };

/**
 * Deliberately its own class rather than an extension of SourceRouter/
 * ParseResult (congress programs): every existing caller of SourceRouter
 * (ImportModal, main.ts's importFile()/updateFile()) is written entirely
 * around Congress-shaped results, so folding a second, unrelated publication
 * type into that union would be pure churn for no benefit and risks a
 * congress file's structural parse failure being silently retried against
 * the mwb parser (or vice versa) instead of a clean, type-based rejection.
 *
 * No RTF fallback: there is no RTF export format for meeting workbooks.
 */
export class MwbSourceRouter {

	private readonly mwb: MwbParser;

	constructor(private readonly sqlWasmBinary: Uint8Array) {
		this.mwb = new MwbParser(sqlWasmBinary);
	}

	async route(filename: string, data: Uint8Array): Promise<MwbParseResult> {
		if (!looksLikeJwpub(filename, data)) {
			throw new ParseError('unknownFormat', filename);
		}

		// Peek Publication.Symbol BEFORE committing to a full MwbParser.parse()
		// run, so picking a congress .jwpub file in this import flow fails with
		// a clear, specific message instead of a confusing structural-parse
		// error (or, worse, silently misinterpreting it). Opens the database
		// twice on the happy path (here, and again inside MwbParser.parse()) —
		// an accepted trade-off for a one-shot user action on a small file,
		// rather than adding a "continue from an already-opened db" entry
		// point to both parsers just for this.
		const { db } = await openJwpubDatabase(data, this.sqlWasmBinary);
		const pub = readPublication(db);
		db.close();
		if (!/^mwb/i.test(String(pub['Symbol']))) {
			throw new ParseError('notMwbPublication', filename);
		}

		const mwb = await this.mwb.parse(data);
		return { mwb, source: 'jwpub' };
	}
}
