// Stands in for `sql.js/dist/sql-wasm.wasm` — main.ts imports the real binary
// via esbuild's "binary" loader at bundle time, which jiti has no equivalent
// for. Tests that exercise main.ts's RTF import path never touch this value
// (JwpubParser's sql.js init only runs when actually opening a jwpub file),
// so an empty buffer is sufficient for module resolution alone.
export default new Uint8Array(0);
