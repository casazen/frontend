import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seoRoute } from '../../api/seo';

/**
 * Routing of the deployed SPA (vercel.json, SE-02 / A8-02). Vercel serves static files and functions first, then
 * applies the rewrites in order; the sources only use groups, so they are read here as anchored regular expressions,
 * like Vercel's path-to-regexp does for them.
 */
interface Rewrite {
  source: string;
  destination: string;
  has?: { type: string; key: string; value: string }[];
}

const vercelJson = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8');
const vercel = JSON.parse(vercelJson) as { rewrites: Rewrite[]; outputDirectory: string };

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** `:name` parameters become named groups (path-to-regexp), the rest of a source is already a regular expression. */
function sourceRegExp(source: string): RegExp {
  return new RegExp(`^${source.replace(/:([A-Za-z]+)/g, '(?<$1>[^/]+)')}$`);
}

/** Destination of the first rewrite that matches the path and, when it has a `user-agent` condition, the user agent. */
function rewriteFor(path: string, userAgent = CHROME): string | undefined {
  for (const rule of vercel.rewrites) {
    const match = sourceRegExp(rule.source).exec(path);
    if (!match) continue;
    const conditionsMet = (rule.has ?? []).every(
      (condition) => condition.type === 'header' && condition.key === 'user-agent' && new RegExp(condition.value).test(userAgent),
    );
    if (!conditionsMet) continue;
    return rule.destination.replace(/:([A-Za-z]+)/g, (_all, name: string) => match.groups?.[name] ?? `:${name}`);
  }
  return undefined;
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

  it('rewrites_bookingSitemaps_goToTheSitemapFunctionForEveryUserAgent', () => {
    // BK-15: the index of the booking sites and the sitemap of one org (under the org's own path).
    expect(rewriteFor('/sitemap-book.xml')).toBe('/api/sitemap?name=book');
    expect(rewriteFor('/book/villa-rossi/sitemap.xml')).toBe('/api/sitemap?org=villa-rossi');
    expect(rewriteFor('/book/villa-rossi/sitemap.xml', 'Googlebot/2.1')).toBe('/api/sitemap?org=villa-rossi');
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

  const CRAWLERS = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'WhatsApp/2.23.20.0',
    'Twitterbot/1.0',
    'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    'TelegramBot (like TwitterBot)',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
    'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
    'Mozilla/5.0 (compatible; DuckDuckBot-Https/1.1; https://duckduckgo.com/duckduckbot)',
  ];
  const PEOPLE = [
    CHROME,
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    // A phone brand with "bot" in its name: a generic "bot" pattern would have taken its owner's browser for a crawler.
    'Mozilla/5.0 (Linux; Android 9; Cubot X19) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    '',
  ];

  describe('crawler pages (BK-15)', () => {
    it.each([
      ['/book/villa-rossi', '/api/seo?kind=org&orgSlug=villa-rossi'],
      ['/book/villa-rossi/property/casa-mare', '/api/seo?kind=property&orgSlug=villa-rossi&propertySlugOrId=casa-mare'],
      ['/p/affitti-brevi', '/api/seo?kind=hub'],
      ['/p/affitti-brevi/lombardia/como', '/api/seo?kind=guide&region=lombardia&comune=como'],
      ['/p/tassa-soggiorno/como', '/api/seo?kind=tourist-tax&comune=como'],
      // BK-16: the landing page and the properties of an org's own host (the function tells the app's own host apart).
      ['/', '/api/seo?kind=host&path=/'],
      ['/property/casa-mare', '/api/seo?kind=host&path=/property/casa-mare'],
    ])('rewrites_%s_forACrawler_goesToTheSeoFunction', (path, destination) => {
      for (const userAgent of CRAWLERS) {
        expect(rewriteFor(path, userAgent), userAgent).toBe(destination);
      }
    });

    it.each(['/', '/property/casa-mare', '/book/villa-rossi', '/book/villa-rossi/property/casa-mare', '/p/affitti-brevi', '/p/affitti-brevi/lombardia/como', '/p/tassa-soggiorno/como'])(
      'rewrites_%s_forPeople_keepsServingTheSinglePageApp',
      (path) => {
        // A failure of the function or of the API can only ever affect crawlers.
        for (const userAgent of PEOPLE) {
          expect(rewriteFor(path, userAgent), userAgent).toBe('/index.html');
        }
      },
    );

    it.each([
      '/book/villa-rossi/my-bookings',
      '/book/villa-rossi/property/casa-mare/checkout',
      '/book/villa-rossi/booking/0f6c',
      '/book/villa-rossi/requests/0f6c/confirm',
      '/property/casa-mare/checkout',
      '/my-bookings',
      '/p/affitti-brevi/lombardia',
    ])('rewrites_%s_forACrawler_isNotARenderedPage', (path) => {
      // Token and booking pages are disallowed in robots.txt and never rendered for crawlers.
      expect(rewriteFor(path, CRAWLERS[0])).toBe('/index.html');
    });

    it('rewrites_everyCrawlerDestination_isAcceptedByTheSeoFunction', () => {
      for (const path of ['/', '/property/c-d', '/book/a-b', '/book/a/property/c-d', '/p/affitti-brevi', '/p/affitti-brevi/r/c', '/p/tassa-soggiorno/c']) {
        const destination = rewriteFor(path, CRAWLERS[0])!;
        expect(destination.startsWith('/api/seo?')).toBe(true);
        expect(seoRoute(new URL(destination, 'https://site.test').searchParams), destination).not.toBeNull();
      }
    });
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
