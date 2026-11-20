/**
 * The files the embeddable widgets are loaded from (NF-145, NF-146): the last step of `npm run build` and of `npm run build:demo`, and `npm run build:embed`
 * on its own. It writes, under `dist/embed/v1/`, one IIFE per entry of `ENTRIES` (the loader `embed.js` and the search bar `search.js`) and the
 * `manifest.json` that says where the API is. Vercel serves them as static files (they win over the rewrite of the single-page app).
 *
 * Why a build and not files by hand in `public/embed/v1/`: the sources are TypeScript in `src/embed/` (typed, unit-tested, sharing `protocol.ts` with
 * the app), and the manifest needs `VITE_API_BASE_URL`, which only the build knows. Why one build per entry: an IIFE cannot have several entries.
 *
 * It runs AFTER `vite build`, which empties `dist/`, and it never deletes anything: `emptyOutDir` is off and only its own files are written.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build, loadEnv } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Where the files are written (relative to the root of the repository) and the path they are served from: the version is part of it. */
export const OUT_DIR = 'dist/embed/v1';
export const URL_DIR = '/embed/v1';

/** The bundles, in the order they are built. Each is an IIFE with no export; its file is `<name>.js`. */
export const ENTRIES = [
  { name: 'embed', entry: 'src/embed/embed.ts' },
  { name: 'search', entry: 'src/embed/search.ts' },
];

/** The widgets the manifest lists: three frames and the search bar. */
export const WIDGETS = ['booking', 'property', 'guest-access', 'search'];

/** What `src/config/api.config.ts` uses outside production when `VITE_API_BASE_URL` is not set. */
export const DEV_API_BASE = 'http://localhost:5000/api';

/**
 * The manifest (`/embed/v1/manifest.json`, contract §6): the version, the address of the API (the plugin reads it on its server to check the connection
 * and to know where to ask for the destinations), the widgets, and the two paths of the scripts, which belong to the host that serves the file.
 */
export function buildManifest({ apiBase }) {
  return {
    v: 1,
    apiBase: apiBase.replace(/\/+$/, ''),
    widgets: [...WIDGETS],
    loader: `${URL_DIR}/embed.js`,
    search: `${URL_DIR}/search.js`,
  };
}

function isAbsoluteHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * The address of the API the manifest names: `VITE_API_BASE_URL` without the slash at the end, which must be absolute (the plugin reads the manifest, not a
 * browser, so a relative address means nothing). Without it the development default is used. On Vercel (`VERCEL_ENV` set) a missing or relative value
 * fails the build: a manifest that points to the wrong API would send the plugin to the wrong place, silently.
 */
export function resolveApiBase({ env, vercelEnv }) {
  const value = (env.VITE_API_BASE_URL ?? '').trim();
  if (isAbsoluteHttpUrl(value)) return value.replace(/\/+$/, '');
  if (vercelEnv) {
    throw new Error(`build-embed: VITE_API_BASE_URL is ${value ? 'not an absolute URL' : 'missing'}: the manifest of the embeddable widgets needs the address of the API (https://<backend host>/api)`);
  }
  return DEV_API_BASE;
}

/**
 * The options of the Vite build of one bundle: library mode, `iife`, ES2018, minified, no source map, nothing copied from `public/`. The test of the size
 * builds the same bundle in memory (`write: false`) with the same options.
 */
export function embedBuildConfig({ root = ROOT, name, entry, outDir = OUT_DIR, write = true }) {
  return {
    configFile: false,
    root,
    logLevel: 'warn',
    publicDir: false,
    build: {
      lib: { entry, name: 'CasaZenEmbed', formats: ['iife'], fileName: () => `${name}.js` },
      outDir,
      emptyOutDir: false,
      copyPublicDir: false,
      minify: true,
      target: 'es2018',
      sourcemap: false,
      reportCompressedSize: false,
      write,
    },
  };
}

/** Builds every bundle and writes the manifest into `outDir`; returns what was written, with sizes. */
export async function buildEmbed({ root = ROOT, outDir = OUT_DIR, env = {}, vercelEnv } = {}) {
  const apiBase = resolveApiBase({ env, vercelEnv });
  for (const { name, entry } of ENTRIES) {
    await build(embedBuildConfig({ root, name, entry, outDir }));
  }

  const target = resolve(root, outDir);
  await mkdir(target, { recursive: true });
  const manifest = resolve(target, 'manifest.json');
  await writeFile(manifest, `${JSON.stringify(buildManifest({ apiBase }), null, 2)}\n`, 'utf8');

  const written = [];
  for (const file of [...ENTRIES.map(({ name }) => `${name}.js`), 'manifest.json']) {
    const content = await readFile(resolve(target, file));
    written.push({ file: relative(root, resolve(target, file)).replaceAll('\\', '/'), bytes: content.length, gzip: gzipSync(content).length });
  }
  return written;
}

// `node scripts/build-embed.mjs [--mode <mode>]`: the same environment files as the main build (`--mode demo` for `build:demo`).
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const modeAt = process.argv.indexOf('--mode');
  const mode = modeAt >= 0 && process.argv[modeAt + 1] ? process.argv[modeAt + 1] : 'production';
  const written = await buildEmbed({ env: loadEnv(mode, ROOT, 'VITE_'), vercelEnv: process.env.VERCEL_ENV });
  for (const { file, bytes, gzip } of written) console.log(`build-embed: ${file} (${bytes} bytes, ${gzip} gzip)`);
}
