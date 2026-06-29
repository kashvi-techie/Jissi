/**
 * Self-host CanvasKit for Skia Web.
 *
 * Copies the wasm binary FROM the installed `canvaskit-wasm` package INTO
 * `public/canvaskit.wasm`, which Expo serves at `/canvaskit.wasm` in both dev
 * (`expo start`) and production (`expo export` copies `public/` into `dist/`).
 *
 * Because the source is always the installed package — the same one
 * `@shopify/react-native-skia` imports its CanvasKit JS glue from — the wasm
 * version can NEVER drift, and there is no CDN/external dependency.
 */
import { mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const pkgPath = require.resolve('canvaskit-wasm/package.json');
const version = require('canvaskit-wasm/package.json').version;
const src = resolve(dirname(pkgPath), 'bin/full/canvaskit.wasm');

if (!existsSync(src)) {
  console.error(`[copy-canvaskit] ERROR: canvaskit.wasm not found at ${src}`);
  process.exit(1);
}

const destDir = resolve(projectRoot, 'public');
const dest = resolve(destDir, 'canvaskit.wasm');
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);

console.log(
  `[copy-canvaskit] canvaskit-wasm@${version} -> public/canvaskit.wasm (${statSync(dest).size} bytes)`
);
