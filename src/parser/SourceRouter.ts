import { Congress } from '../models/congress';
import { JwpubParser } from './JwpubParser';
import { RtfParser } from './RtfParser';
import { ParseError } from '../util/parseErrors';
import { hasPkZipSignature, looksLikeJwpub } from '../util/fileSignature';

export type ParseResult =
	| { congress: Congress; source: 'jwpub' }
	| { congress: Congress; source: 'rtf'; fallback: true };

export class SourceRouter {

	private readonly jwpub: JwpubParser;
	private readonly rtf = new RtfParser();

	constructor(sqlWasmBinary: Uint8Array) {
		this.jwpub = new JwpubParser(sqlWasmBinary);
	}

	async route(filename: string, data: Uint8Array): Promise<ParseResult> {
		if (looksLikeJwpub(filename, data)) {
			try {
				const congress = await this.jwpub.parse(data);
				return { congress, source: 'jwpub' };
			} catch (err) {
				console.warn('jwpub parsing failed, falling back to RTF:', err);
				// fall through to RTF attempt
			}
		}

		if (this.isRtfZip(filename, data)) {
			const congress = await this.rtf.parse(data);
			return { congress, source: 'rtf', fallback: true };
		}

		throw new ParseError('unknownFormat', filename);
	}

	private isRtfZip(filename: string, data: Uint8Array): boolean {
		return (
			filename.toLowerCase().endsWith('.zip') ||
			filename.toLowerCase().endsWith('.rtf') ||
			hasPkZipSignature(data)
		);
	}
}
