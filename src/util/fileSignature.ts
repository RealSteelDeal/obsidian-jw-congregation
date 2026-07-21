/** True for the first four bytes of any zip-based file (jwpub, RTF-ZIP export, …). */
export function hasPkZipSignature(data: Uint8Array): boolean {
	return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b;
}

/** Filename/signature check shared by every jwpub-consuming router
 *  (SourceRouter for congress programs, MwbSourceRouter for meeting
 *  workbooks) — a jwpub file is just a zip, so the extension is the primary
 *  signal and the PK magic bytes are a fallback for a renamed/extension-less file. */
export function looksLikeJwpub(filename: string, data: Uint8Array): boolean {
	return filename.toLowerCase().endsWith('.jwpub') || hasPkZipSignature(data);
}
