import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Decision D3 (SE-02, SE-03): no CasaZen domain is written in the shipped frontend. Public links come from the
 * backend (built on `App__PublicSiteBaseUrl`) or from `VITE_PUBLIC_SITE_URL`; the Privacy and Terms links from the
 * documents configured on the backend. Tests are fixtures and are not scanned.
 */
const ROOT = process.cwd();
const SCANNED = ['src', 'api', 'public', 'index.html', 'vercel.json', 'vite.config.ts'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.json', '.html', '.txt', '.css']);
const DOMAIN = /casazen\.app/i;

/**
 * Not addresses of a site: the namespace of the custom claims added by the Auth0 Action (runbook auth0.md). It must
 * match the Action whatever domain the web app is on.
 */
const CLAIM_NAMESPACES = ['https://casazen.app/roles'];

function isTest(path: string): boolean {
  return /(^|\/)(__tests__|test)\//.test(path) || /\.test\.[jt]sx?$/.test(path);
}

function files(path: string): string[] {
  const absolute = resolve(ROOT, path);
  let stats;
  try {
    stats = statSync(absolute);
  } catch {
    return [];
  }
  if (stats.isFile()) return [absolute];
  return readdirSync(absolute).flatMap((entry) => files(join(path, entry)));
}

describe('no hardcoded domain (D3)', () => {
  it('shippedFrontend_HasNoCasazenAppDomain', () => {
    const offending: string[] = [];
    let scanned = 0;
    for (const file of SCANNED.flatMap(files)) {
      const path = relative(ROOT, file).split('\\').join('/');
      if (isTest(path) || !EXTENSIONS.has(extname(path))) continue;
      scanned += 1;

      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          const rest = CLAIM_NAMESPACES.reduce((text, claim) => text.split(claim).join(''), line);
          if (DOMAIN.test(rest)) offending.push(`${path}:${index + 1}: ${line.trim()}`);
        });
    }

    // The scan really covers the sources (the Footer, the auth bridge, the locales...).
    expect(scanned).toBeGreaterThan(100);
    expect(offending, 'build the URL from configuration (VITE_PUBLIC_SITE_URL or the backend)').toEqual([]);
  });
});
