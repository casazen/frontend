import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as { headers: HeaderRule[] };

function headersFor(path: string): Record<string, string> {
  const matching = vercel.headers.filter((rule) => new RegExp(`^${rule.source}$`).test(path));
  expect(matching).toHaveLength(1);
  return Object.fromEntries(matching[0].headers.map((h) => [h.key.toLowerCase(), h.value]));
}

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((parts) => parts[0])
      .map(([name, ...values]) => [name, values]),
  );
}

// `/checkin` alone is no page of the guest (the link carries a token): it stays with the app and keeps the camera off. `/embed` alone, and what only
// starts like it, is no page of a widget (E41): it stays with the app too. The guest area, the checkout and the owner portal of an agency's own domain
// (NF-140) are never framed either: «Book» takes the whole page there.
const APP_PATHS = [
  '/',
  '/login',
  '/app/short-rent/bookings',
  '/app/connect/wordpress',
  '/checkin',
  '/p/tassa-soggiorno/milano',
  '/book',
  '/embed',
  '/embedded',
  '/embed-x/booking',
  '/my-bookings',
  '/property/casa-mare/checkout',
  '/portale-proprietari/accedi',
];
const CHECKIN_PATHS = ['/checkin/some-token', '/checkin/another-token'];
const BOOKING_SITE_PATHS = ['/book/demo-org', '/book/demo-org/property/villa/checkout'];
const SUPPLIER_SITE_PATHS = ['/fornitori/pulizie-roma', '/fornitori/pulizie-roma/servizi/pulizia-standard'];
const EMBED_PAGE_PATHS = [
  '/embed/booking',
  '/embed/property/casa-mare',
  '/embed/guest-access',
  '/embed/demo-org/booking',
  '/embed/demo-org/property/casa-mare',
  '/embed/demo-org/guest-access',
];
const EMBED_FILE_PATHS = ['/embed/v1/embed.js', '/embed/v1/search.js', '/embed/v1/manifest.json'];

describe('vercel.json security headers', () => {
  it.each([...APP_PATHS, ...CHECKIN_PATHS])('headers_appPath_%s_cannotBeFramed', (path) => {
    const headers = headersFor(path);

    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['content-security-policy']).toBe("frame-ancestors 'none'");
    expect(directives(headers['content-security-policy-report-only']).get('frame-ancestors')).toEqual(["'none'"]);
  });

  it.each(BOOKING_SITE_PATHS)('headers_bookingSitePath_%s_framedOnlyBySameOriginPreview', (path) => {
    const headers = headersFor(path);

    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['content-security-policy']).toBe("frame-ancestors 'self'");
    expect(directives(headers['content-security-policy-report-only']).get('frame-ancestors')).toEqual(["'self'"]);
  });

  it.each(SUPPLIER_SITE_PATHS)('headers_supplierSitePath_%s_framedOnlyBySameOriginPreview', (path) => {
    const headers = headersFor(path);

    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['content-security-policy']).toBe("frame-ancestors 'self'");
    expect(directives(headers['content-security-policy-report-only']).get('frame-ancestors')).toEqual(["'self'"]);
  });

  it.each(EMBED_PAGE_PATHS)('headers_embedPage_%s_canBeFramedByAnyHttpsPageAndIsNeverIndexed', (path) => {
    const headers = headersFor(path);

    expect(headers['content-security-policy']).toBe('frame-ancestors https:');
    expect(headers['x-frame-options']).toBeUndefined();
    expect(directives(headers['content-security-policy-report-only']).get('frame-ancestors')).toEqual(['https:']);
    expect(headers['x-robots-tag']).toContain('noindex');
    expect(headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
  });

  it.each(EMBED_FILE_PATHS)('headers_embedFile_%s_getsTheShortRevalidatingCacheAndCanBeLoadedByAnyPage', (path) => {
    const headers = headersFor(path);

    expect(headers['cache-control']).toBe('public, max-age=300, must-revalidate');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(headers['x-robots-tag']).toContain('noindex');
  });

  it.each([...EMBED_FILE_PATHS, '/embed/v1/', '/embed/v1/not-a-file'])('headers_embedFile_%s_cannotBeFramed', (path) => {
    const headers = headersFor(path);

    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['content-security-policy']).toBe("frame-ancestors 'none'");
  });

  it.each([...APP_PATHS, ...CHECKIN_PATHS, ...BOOKING_SITE_PATHS, ...SUPPLIER_SITE_PATHS, ...EMBED_PAGE_PATHS])('headers_%s_haveBaselineHeaders', (path) => {
    const headers = headersFor(path);

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('microphone=()');
  });

  it.each([...APP_PATHS, ...BOOKING_SITE_PATHS, ...SUPPLIER_SITE_PATHS, ...EMBED_PAGE_PATHS])('headers_%s_keepTheCameraOff', (path) => {
    expect(headersFor(path)['permissions-policy']).toContain('camera=()');
  });

  it('headers_frameAncestorsHttps_onlyOnEmbedPages', () => {
    const framableByOthers = vercel.headers.filter((rule) => rule.headers.some((header) => /frame-ancestors[^;]*\bhttps:/.test(header.value)));

    expect(framableByOthers.map((rule) => rule.source)).toEqual(['/embed/((?!v1/).*)']);
    const [pageRule] = framableByOthers;
    expect(pageRule.headers.find((header) => header.key === 'Content-Security-Policy')?.value).toBe('frame-ancestors https:');
    expect(pageRule.headers.some((header) => header.key.toLowerCase() === 'x-frame-options')).toBe(false);

    for (const rule of vercel.headers.filter((candidate) => candidate !== pageRule)) {
      for (const header of rule.headers.filter((candidate) => /^content-security-policy/i.test(candidate.key))) {
        const frameAncestors = directives(header.value).get('frame-ancestors');
        if (frameAncestors) expect(["'none'", "'self'"], rule.source).toContain(frameAncestors.join(' '));
      }
      const frameOptions = rule.headers.find((header) => header.key.toLowerCase() === 'x-frame-options')?.value;
      expect(['DENY', 'SAMEORIGIN', undefined], rule.source).toContain(frameOptions);
    }
  });

  it('headers_appPaths_stillCannotBeFramed', () => {
    for (const path of [...APP_PATHS, ...CHECKIN_PATHS, ...BOOKING_SITE_PATHS, ...SUPPLIER_SITE_PATHS, '/book/demo-org/property/villa/checkout']) {
      const headers = headersFor(path);
      expect(['DENY', 'SAMEORIGIN'], path).toContain(headers['x-frame-options']);
      expect(["frame-ancestors 'none'", "frame-ancestors 'self'"], path).toContain(headers['content-security-policy']);
    }
    for (const path of [...APP_PATHS, ...CHECKIN_PATHS]) {
      expect(headersFor(path)['x-frame-options'], path).toBe('DENY');
      expect(headersFor(path)['content-security-policy'], path).toBe("frame-ancestors 'none'");
    }
  });

  it.each(CHECKIN_PATHS)('headers_checkinPath_%s_letsThePageOpenTheCameraForTheSelfie', (path) => {
    const policy = headersFor(path)['permissions-policy'];

    expect(policy).not.toContain('camera=()');
    expect(policy).toContain('camera=(self)');
    expect(policy).toContain('microphone=()');
  });

  it('permissionsPolicy_onlyTheCheckinRuleOpensTheCamera', () => {
    const opening = vercel.headers.filter((rule) =>
      rule.headers.some((header) => header.key.toLowerCase() === 'permissions-policy' && !header.value.includes('camera=()')),
    );

    expect(opening.map((rule) => rule.source)).toEqual(['/checkin/(.*)']);
  });

  it('headers_checkinPage_differFromTheAppOnlyInTheCamera', () => {
    const app = headersFor('/');
    const checkin = headersFor('/checkin/some-token');
    delete app['permissions-policy'];
    delete checkin['permissions-policy'];

    expect(checkin).toEqual(app);
  });

  it('contentSecurityPolicy_allowsStripeAuth0ApiAndStorage_withoutInlineScriptsOrEval', () => {
    const csp = directives(headersFor('/')['content-security-policy-report-only']);

    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('script-src')).toEqual(["'self'", 'https://js.stripe.com', 'https://*.js.stripe.com']);
    expect(csp.get('frame-src')).toEqual(
      expect.arrayContaining(["'self'", 'https://js.stripe.com', 'https://*.js.stripe.com', 'https://hooks.stripe.com']),
    );
    expect(csp.get('connect-src')).toEqual(["'self'", 'https:']);
    expect(csp.get('img-src')).toEqual(expect.arrayContaining(["'self'", 'data:', 'blob:', 'https:']));
    expect(csp.get('font-src')).toEqual(expect.arrayContaining(["'self'", 'https://*.supabase.co']));
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    for (const [name, values] of csp) {
      if (name === 'style-src') continue;
      expect(values).not.toContain("'unsafe-inline'");
    }
    for (const values of csp.values()) expect(values).not.toContain("'unsafe-eval'");
  });

  it('contentSecurityPolicy_bookingSite_differsOnlyInFrameAncestors', () => {
    const app = directives(headersFor('/')['content-security-policy-report-only']);
    const bookingSite = directives(headersFor('/book/demo-org')['content-security-policy-report-only']);

    app.delete('frame-ancestors');
    bookingSite.delete('frame-ancestors');
    expect(bookingSite).toEqual(app);
  });

  it('contentSecurityPolicy_embedPage_differsOnlyInFrameAncestors', () => {
    const app = directives(headersFor('/')['content-security-policy-report-only']);
    const embedPage = directives(headersFor('/embed/booking')['content-security-policy-report-only']);

    expect(embedPage.get('frame-ancestors')).toEqual(['https:']);
    app.delete('frame-ancestors');
    embedPage.delete('frame-ancestors');
    expect(embedPage).toEqual(app);
  });

  it('contentSecurityPolicy_supplierSite_differsOnlyInFrameAncestors', () => {
    const app = directives(headersFor('/')['content-security-policy-report-only']);
    const supplierSite = directives(headersFor('/fornitori/pulizie-roma')['content-security-policy-report-only']);

    app.delete('frame-ancestors');
    supplierSite.delete('frame-ancestors');
    expect(supplierSite).toEqual(app);
  });
});
