import { Congress } from '../models/congress';
import { JwpubParser } from './JwpubParser';
import { RtfParser } from './RtfParser';

export type ParseResult =
	| { congress: Congress; source: 'jwpub' }
	| { congress: Congress; source: 'rtf'; fallback: true };

export class SourceRouter {

	private readonly jwpub: JwpubParser;
	private readonly rtf = new RtfParser();

	constructor(pluginDir: string) {
		this.jwpub = new JwpubParser(pluginDir);
	}

	async route(filename: string, data: Buffer): Promise<ParseResult> {
		if (this.isJwpub(filename, data)) {
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

		throw new Error(`Unbekanntes Dateiformat: ${filename}`);
	}

	private isJwpub(filename: string, data: Buffer): boolean {
		return filename.toLowerCase().endsWith('.jwpub') || this.hasPkZipSignature(data);
	}

	private isRtfZip(filename: string, data: Buffer): boolean {
		return (
			filename.toLowerCase().endsWith('.zip') ||
			filename.toLowerCase().endsWith('.rtf') ||
			this.hasPkZipSignature(data)
		);
	}

	private hasPkZipSignature(data: Buffer): boolean {
		return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b;
	}
}
