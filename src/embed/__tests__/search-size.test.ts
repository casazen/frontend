// @vitest-environment node
import { gzipSync } from 'node:zlib';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';
// The build script is a plain `.mjs`: the test builds the bundles with the very options `npm run build` uses.
import { ENTRIES, embedBuildConfig } from '../../../scripts/build-embed.mjs';

/**
 * The size and the content of the bundle of the search bar (E41/F02/US01/T02, NF-146): at most 16 KB gzip, while the core loader keeps its 6 KB; and,
 * as for the loader, nothing in it that stores, calls a server, evaluates text as code or writes HTML or a style attribute as text. The bar draws no
 * frame and loads no image either. The bundles are built in memory, the same way the build writes them.
 */
const MAX_SEARCH_GZIP_BYTES = 16384;
const MAX_LOADER_GZIP_BYTES = 6144;
const BUILD_TIMEOUT = 120_000;

type Output = { output: { fileName: string; code?: string }[] };

async function bundleOf(name: string): Promise<string> {
  const entry = ENTRIES.find((item: { name: string }) => item.name === name);
  const result = (await build(embedBuildConfig({ name, entry: entry.entry, write: false }))) as unknown as Output | Output[];
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
  expect(outputs.map((output) => output.fileName)).toEqual([`${name}.js`]);
  return outputs[0].code ?? '';
}

const gzipBytes = (code: string) => gzipSync(Buffer.from(code, 'utf8')).length;

/** What the bar must not contain, each with the reason. */
const FORBIDDEN: [string, RegExp][] = [
  ['the network (fetch)', /\bfetch\(/],
  ['the network (XMLHttpRequest)', /XMLHttpRequest/],
  ['the network (a beacon)', /sendBeacon/],
  ['the network (a socket)', /WebSocket|EventSource/],
  ['the network (an image)', /new Image\b|\bImage\(/],
  ['storage (localStorage)', /localStorage/],
  ['storage (sessionStorage)', /sessionStorage/],
  ['storage (indexedDB)', /indexedDB/],
  ['a cookie', /document\.cookie/],
  ['text evaluated as code (eval)', /\beval\(/],
  ['text evaluated as code (Function)', /new Function\b|\bFunction\(/],
  ['a script written as text', /document\.write/],
  ['HTML written as text', /innerHTML|outerHTML|insertAdjacentHTML/],
  ['a frame', /iframe/i],
  ['a style attribute set as text (blocked by a strict policy)', /setAttribute\(\s*[`'"]style[`'"]/],
  ['the day taken from an instant (it moves the day for time zones ahead of UTC)', /toISOString|toJSON\(\)|toUTCString/],
];

describe('search.js: size and content (AC5, AC8)', () => {
  it(
    'searchBar_bundle_IsAtMost16KilobytesGzip',
    async () => {
      const code = await bundleOf('search');

      expect(gzipBytes(code)).toBeLessThanOrEqual(MAX_SEARCH_GZIP_BYTES);
      expect(gzipBytes(code)).toBeGreaterThan(2000);
    },
    BUILD_TIMEOUT,
  );

  it(
    'searchBar_makesNoNetworkCall_TheBundleHasNoNetworkStorageCookieOrEvalCall',
    async () => {
      const code = await bundleOf('search');

      for (const [reason, pattern] of FORBIDDEN) {
        expect(code, reason).not.toMatch(pattern);
      }
    },
    BUILD_TIMEOUT,
  );

  it(
    'searchBar_bundle_IsAScriptThatAssignsNothingToAGlobalName',
    async () => {
      const code = await bundleOf('search');

      expect(code.startsWith('(function(){')).toBe(true);
      expect(code).not.toMatch(/^\s*(var|let|const)\s/);
      expect(code).not.toMatch(/CasaZenEmbed\s*=\s*\(function/);
      // It reaches the loader through the global it keeps, to register itself, and writes nothing to it.
      expect(code).toContain('CasaZenEmbed');
      expect(code).toContain('register');
    },
    BUILD_TIMEOUT,
  );

  it(
    'searchBar_bundle_HasTheBarAndNotTheLoader',
    async () => {
      const code = await bundleOf('search');

      expect(code).toContain('Verifica disponibilità');
      expect(code).toContain('Check availability');
      expect(code).toContain('czs-');
      // The protocol and the frames are the loader's: the bar does not carry them.
      expect(code).not.toContain('casazen:event');
      expect(code).not.toContain('postMessage');
      expect(code).not.toContain('MutationObserver');
      expect(code).not.toContain('Prenota su');
    },
    BUILD_TIMEOUT,
  );

  it(
    'embedLoader_bundle_KeepsItsSizeWithTheBarBesideIt',
    async () => {
      const code = await bundleOf('embed');

      expect(gzipBytes(code)).toBeLessThanOrEqual(MAX_LOADER_GZIP_BYTES);
      // Nothing of the bar travels in the core.
      expect(code).not.toContain('Verifica disponibilità');
      expect(code).not.toContain('Check availability');
      expect(code).not.toContain('czs-');
      expect(code).not.toContain('adoptedStyleSheets');
    },
    BUILD_TIMEOUT,
  );

  it('theBuildWritesBothFilesNextToEachOther', () => {
    expect(ENTRIES.map((entry: { name: string }) => entry.name)).toEqual(['embed', 'search']);
    expect(ENTRIES.map((entry: { entry: string }) => entry.entry)).toEqual(['src/embed/embed.ts', 'src/embed/search.ts']);
  });
});
