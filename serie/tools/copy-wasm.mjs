// Copies the WebAssembly runtimes used by the WEB build only (Skia CanvasKit, sql.js)
// from node_modules into public/. Runs on `npm install` (postinstall). iOS does not use them.
import fs from 'node:fs';
import path from 'node:path';

const files = [
  ['node_modules/canvaskit-wasm/bin/full/canvaskit.wasm', 'public/canvaskit.wasm'],
  ['node_modules/sql.js/dist/sql-wasm.wasm', 'public/sql-wasm.wasm'],
];
fs.mkdirSync('public', { recursive: true });
for (const [from, to] of files) {
  if (!fs.existsSync(from)) {
    console.warn(`copy-wasm: ${from} not found (web build will not work until it is installed)`);
    continue;
  }
  fs.copyFileSync(from, path.resolve(to));
}
