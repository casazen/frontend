import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Routing of the deployed SPA (vercel.json, SE-02 / A8-02). Vercel serves static files and functions first, then
 * applies the rewrites in order; the sources only use groups, so they are read here as anchored regular expressions,
 * like Vercel's path-to-regexp does for them.
 */
interface Rewrite {
  source: string;
  destination: string;
}

const vercelJson = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8');
const vercel = JSON.parse(vercelJson) as { rewrites: Rewrite[]; outputDirectory: string };

function rewriteFor(path: string): string | undefined {
  return vercel.rewrites.find((rule) => new RegExp(`^${rule.source}$`).test(path))?.destination;
}

describe('vercel.json routing', () => {
  it('rewrites_robotsTxt_isNotCaughtByTheSpaFallback', () => {
    // Served as the static dist/robots.txt built by vite.config.ts; if it were missing Vercel answers 404, never
    // index.html with 200.
    expect(rewriteFor('/robots.txt')).toBeUndefined();
  });

  it('rewrites_sitemapXml_goesToTheSitemapFunctionNotToIndexHtml', () => {
    expect(rewriteFor('/sitemap.xml')).toBe('/api/sitemap');
    expect(existsSync(resolve(process.cwd(), 'api/sitemap.ts'))).toBe(true);
  });

  it.each([
    '/',
    '/login',
    '/p/affitti-brevi',
    '/p/affitti-brevi/lombardia/como',
    '/p/tassa-soggiorno/como',
    '/book/demo-org',
    '/app/short-rent/bookings',
    '/robots.txt/extra',
    '/p/sitemap.xml',
  ])('rewrites_spaRoute_%s_fallsBackToIndexHtml', (path) => {
    expect(rewriteFor(path)).toBe('/index.html');
  });

  it('vercelJson_hasNoDomainOfOurOwn', () => {
    // Decision D3: the public domain comes only from environment variables (VITE_PUBLIC_SITE_URL,
    // VITE_API_BASE_URL); the only absolute URLs allowed here are the third-party origins of the CSP.
    const hosts = [...vercelJson.matchAll(/https?:\/\/([^\s'";/]+)/g)].map((match) => match[1]);
    for (const host of hosts) {
      expect(host).toMatch(/(^|\.)(stripe\.com|auth0\.com|supabase\.co)$/);
    }
    expect(vercelJson).not.toMatch(/casazen|vercel\.app|railway\.app/i);
  });
});
