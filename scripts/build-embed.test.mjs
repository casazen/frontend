// @vitest-environment node
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, test } from 'vitest';
import assert from 'node:assert/strict';
import { DEV_API_BASE, ENTRIES, OUT_DIR, WIDGETS, buildEmbed, buildManifest, embedBuildConfig, resolveApiBase } from './build-embed.mjs';

const temporary = [];
afterAll(async () => {
  for (const folder of temporary) await rm(folder, { recursive: true, force: true });
});

test('the manifest has exactly the shape of the contract', () => {
  const manifest = buildManifest({ apiBase: 'https://casazen-api.example.test/api' });
  assert.deepEqual(manifest, {
    v: 1,
    apiBase: 'https://casazen-api.example.test/api',
    widgets: ['booking', 'property', 'guest-access', 'search'],
    loader: '/embed/v1/embed.js',
    search: '/embed/v1/search.js',
  });
  // The order of the members is the one of §6 of the analysis: the plugin and the people who read the file expect it.
  assert.deepEqual(Object.keys(manifest), ['v', 'apiBase', 'widgets', 'loader', 'search']);
});

test('the paths of the scripts are relative: they belong to the host that serves the file', () => {
  const { loader, search } = buildManifest({ apiBase: 'https://api.example.test/api' });
  for (const path of [loader, search]) assert.match(path, /^\/embed\/v1\/[a-z]+\.js$/);
});

test('the address of the API has no slash at the end', () => {
  assert.equal(buildManifest({ apiBase: 'https://api.example.test/api/' }).apiBase, 'https://api.example.test/api');
  assert.equal(buildManifest({ apiBase: 'https://api.example.test/api///' }).apiBase, 'https://api.example.test/api');
});

test('the list of widgets of a manifest is its own copy', () => {
  buildManifest({ apiBase: 'https://api.example.test/api' }).widgets.push('x');
  assert.deepEqual(buildManifest({ apiBase: 'https://api.example.test/api' }).widgets, WIDGETS);
});

test('VITE_API_BASE_URL is the address of the API, trimmed and without a slash at the end', () => {
  assert.equal(resolveApiBase({ env: { VITE_API_BASE_URL: '  https://casazen-api.example.test/api/ ' } }), 'https://casazen-api.example.test/api');
  assert.equal(resolveApiBase({ env: { VITE_API_BASE_URL: 'http://localhost:5000/api' } }), 'http://localhost:5000/api');
});

test('without the variable, outside Vercel, the development default is used', () => {
  assert.equal(resolveApiBase({ env: {} }), DEV_API_BASE);
  assert.equal(resolveApiBase({ env: { VITE_API_BASE_URL: '' } }), DEV_API_BASE);
  assert.equal(resolveApiBase({ env: { VITE_API_BASE_URL: '   ' }, vercelEnv: undefined }), DEV_API_BASE);
});

test('a relative address is no address of an API for the plugin: outside Vercel the default is used', () => {
  assert.equal(resolveApiBase({ env: { VITE_API_BASE_URL: '/api' } }), DEV_API_BASE);
  assert.equal(resolveApiBase({ env: { VITE_API_BASE_URL: 'api.example.test/api' } }), DEV_API_BASE);
});

test('on Vercel a missing or a relative address fails the build and names the variable', () => {
  for (const vercelEnv of ['preview', 'production']) {
    assert.throws(() => resolveApiBase({ env: {}, vercelEnv }), /VITE_API_BASE_URL is missing/);
    assert.throws(() => resolveApiBase({ env: { VITE_API_BASE_URL: '/api' }, vercelEnv }), /VITE_API_BASE_URL is not an absolute URL/);
    assert.throws(() => resolveApiBase({ env: { VITE_API_BASE_URL: 'ftp://api.example.test/api' }, vercelEnv }), /VITE_API_BASE_URL is not an absolute URL/);
  }
});

test('on Vercel an absolute address is the one of the manifest', () => {
  assert.equal(resolveApiBase({ env: { VITE_API_BASE_URL: 'https://casazen-api.example.test/api' }, vercelEnv: 'production' }), 'https://casazen-api.example.test/api');
});

test('the development default is the one of the application', async () => {
  const config = await readFile(new URL('../src/config/api.config.ts', import.meta.url), 'utf8');
  assert.ok(config.includes(`'${DEV_API_BASE}'`), 'src/config/api.config.ts no longer has the development default of the manifest');
});

test('every bundle is a library build of one IIFE for ES2018 that deletes nothing', () => {
  for (const { name, entry } of ENTRIES) {
    const { build, configFile, publicDir } = embedBuildConfig({ name, entry });
    assert.equal(configFile, false);
    assert.equal(publicDir, false);
    assert.deepEqual(build.lib.formats, ['iife']);
    assert.equal(build.lib.entry, entry);
    assert.equal(build.lib.fileName(), `${name}.js`);
    assert.equal(build.outDir, OUT_DIR);
    assert.equal(build.emptyOutDir, false);
    assert.equal(build.copyPublicDir, false);
    assert.equal(build.minify, true);
    assert.equal(build.target, 'es2018');
    assert.equal(build.sourcemap, false);
    assert.equal(build.write, true);
  }
  assert.equal(embedBuildConfig({ name: 'embed', entry: 'src/embed/embed.ts', write: false }).build.write, false);
});

test('the loader is one of the bundles and the manifest names its file', () => {
  assert.ok(ENTRIES.some(({ name, entry }) => name === 'embed' && entry === 'src/embed/embed.ts'));
  assert.ok(buildManifest({ apiBase: DEV_API_BASE }).loader.endsWith('/embed.js'));
});

test('the build writes its files and the manifest and leaves every other file as it was', { timeout: 120_000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), 'casazen-embed-'));
  temporary.push(folder);
  const outDir = join(folder, 'dist', 'embed', 'v1');
  await mkdir(join(outDir, 'later'), { recursive: true });
  await writeFile(join(outDir, 'keep.txt'), 'kept', 'utf8');
  await writeFile(join(outDir, 'later', 'other.js'), '// kept too', 'utf8');
  await writeFile(join(folder, 'dist', 'index.html'), '<html></html>', 'utf8');

  const written = await buildEmbed({ outDir, env: { VITE_API_BASE_URL: 'https://casazen-api.example.test/api/' } });

  assert.deepEqual(written.map(({ file }) => file.split('/').pop()).sort(), ['embed.js', 'manifest.json', 'search.js']);
  for (const { gzip } of written) assert.ok(gzip > 0);
  assert.deepEqual(JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8')), buildManifest({ apiBase: 'https://casazen-api.example.test/api' }));
  const loader = await readFile(join(outDir, 'embed.js'), 'utf8');
  assert.ok(loader.includes('CasaZenEmbed'));
  // The search bar is written next to the loader, and registers itself with it.
  assert.ok((await readFile(join(outDir, 'search.js'), 'utf8')).includes('register'));
  // Nothing else was written, and nothing was deleted.
  assert.deepEqual((await readdir(outDir)).sort(), ['embed.js', 'keep.txt', 'later', 'manifest.json', 'search.js']);
  assert.equal(await readFile(join(outDir, 'keep.txt'), 'utf8'), 'kept');
  assert.equal(await readFile(join(outDir, 'later', 'other.js'), 'utf8'), '// kept too');
  assert.equal(await readFile(join(folder, 'dist', 'index.html'), 'utf8'), '<html></html>');
});

test('the build of the application runs this step after the main build and the prerender, and in the demo build as well', async () => {
  const { scripts } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  for (const name of ['build', 'build:demo']) {
    const steps = scripts[name].split(' && ');
    const prerender = steps.findIndex((step) => step.startsWith('node scripts/prerender-site.mjs'));
    const embed = steps.findIndex((step) => step.startsWith('node scripts/build-embed.mjs'));
    assert.ok(prerender >= 0 && embed > prerender, `${name} must run build-embed.mjs after prerender-site.mjs`);
    assert.equal(steps.at(-1).startsWith('node scripts/build-embed.mjs'), true, `${name} must end with build-embed.mjs: it must run after everything that empties dist`);
  }
  assert.equal(scripts['build:embed'], 'node scripts/build-embed.mjs');
});
