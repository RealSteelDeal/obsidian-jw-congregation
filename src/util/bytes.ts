/**
 * Decodes a byte array using a strict 1:1 codepoint mapping (true Latin-1 /
 * ISO-8859-1), matching Node's `Buffer.toString('latin1')` exactly. RTF
 * sources and the jwpub XOR constant rely on this precise byte↔codepoint
 * correspondence — the Web `TextDecoder('iso-8859-1')` label doesn't
 * guarantee it, since the WHATWG Encoding spec aliases that label to
 * windows-1252, which differs from true Latin-1 in the 0x80–0x9F range.
 */
export function latin1Decode(bytes: Uint8Array): string {
	const CHUNK = 8192; // avoids "Maximum call stack size exceeded" on `...spread` for large inputs
	let out = '';
	for (let i = 0; i < bytes.length; i += CHUNK) {
		out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return out;
}

/** Decodes a hex string into bytes, e.g. "0a1b" → Uint8Array([0x0a, 0x1b]). */
export function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}
