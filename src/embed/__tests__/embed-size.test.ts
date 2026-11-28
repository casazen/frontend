// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';
import { ENTRIES, embedBuildConfig } from '../../../scripts/build-embed.mjs';

/**
 * The size and the content of the bundle of the loader (E41/F02/US01/T01, NF-145): at most 6 KB gzip, no dependency, and none of the things a
 * script in the page of another website must never do: store anything, write a cookie, call the network, evaluate text as code, or write the style
 * of a page in a way a strict content security policy blocks. The bundle is built in memory, the same way the build writes it.
 */
const MAX_GZIP_BYTES = 6144;
const BUILD_TIMEOUT = 120_000;

async function bundleOf(name: string): Promise<string> {
  const entry = ENTRIES.find((item: { name: string }) => item.name === name);
  const result = (await build(embedBuildConfig({ name, entry: entry.entry, write: false }))) as unknown as { output: { fileName: string; code?: string }[] } | { output: { fileName: string; code?: string }[] }[];
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
  expect(outputs.map((output) => output.fileName)).toEqual([`${name}.js`]);
  return outputs[0].code ?? '';
}

const gzipBytes = (code: string) => gzipSync(Buffer.from(code, 'utf8')).length;

const FORBIDDEN: [string, RegExp][] = [
  ['the network (fetch)', /\bfetch\(/],
  ['the network (XMLHttpRequest)', /XMLHttpRequest/],
  ['the network (a beacon)', /sendBeacon/],
  ['the network (a socket)', /WebSocket|EventSource/],
  ['storage (localStorage)', /localStorage/],
  ['storage (sessionStorage)', /sessionStorage/],
  ['storage (indexedDB)', /indexedDB/],
  ['a cookie', /document\.cookie/],
  ['text evaluated as code (eval)', /\beval\(/],
  ['text evaluated as code (Function)', /new Function\b|\bFunction\(/],
  ['a script written as text', /document\.write/],
  ['HTML written as text', /innerHTML|outerHTML|insertAdjacentHTML/],
  ['a style attribute set as text (blocked by a strict policy)', /setAttribute\(\s*[`'"]style[`'"]/],
  ['a style element (blocked by a strict policy)', /createElement\(\s*[`'"]style[`'"]/],
];

describe('embed.js: size and content (AC8)', () => {
  it(
    'embedLoader_bundle_IsAtMost6KilobytesGzip',
    async () => {
      const code = await bundleOf('embed');

      expect(gzipBytes(code)).toBeLessThanOrEqual(MAX_GZIP_BYTES);
      expect(gzipBytes(code)).toBeGreaterThan(1000);
    },
    BUILD_TIMEOUT,
  );

  it(
    'embedLoader_bundle_usesNoStorageCookieOrNetwork',
    async () => {
      const code = await bundleOf('embed');

      for (const [reason, pattern] of FORBIDDEN) {
        expect(code, reason).not.toMatch(pattern);
      }
    },
    BUILD_TIMEOUT,
  );

  it(
    'embedLoader_bundle_IsAScriptThatAssignsNothingToAGlobalName',
    async () => {
      const code = await bundleOf('embed');

      expect(code.startsWith('(function(){')).toBe(true);
      expect(code).not.toMatch(/^\s*(var|let|const)\s/);
      expect(code).not.toMatch(/CasaZenEmbed\s*=\s*\(function/);
      expect(code).toContain('CasaZenEmbed');
    },
    BUILD_TIMEOUT,
  );

  it(
    'embedLoader_bundle_LeavesTheSearchBarToItsOwnFile',
    async () => {
      const code = await bundleOf('embed');

      expect(code).not.toContain('Verifica disponibilità');
      expect(code).not.toContain('Check availability');
      expect(code).not.toContain('czs-');
    },
    BUILD_TIMEOUT,
  );
});

describe('the sources of the bundles import nothing of the app (AC9)', () => {
  const folder = resolve(process.cwd(), 'src/embed');
  const sources = readdirSync(folder).filter((file) => file.endsWith('.ts'));

  it('embedSources_AreThere', () => {
    expect(sources).toEqual(expect.arrayContaining(['embed.ts', 'mount-widget.ts', 'page-params.ts', 'protocol.ts', 'texts.ts']));
  });

  it.each(sources)('embedSources_%s_ImportsOnlyItsNeighbours', (file) => {
    const text = readFileSync(resolve(folder, file), 'utf8');
    const imports = [...text.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((match) => match[1]);

    for (const specifier of imports) expect(specifier, `${file} imports ${specifier}`).toMatch(/^\.\/[a-z-]+$/);
    expect(text).not.toMatch(/\brequire\(|\bimport\(/);
  });
});
