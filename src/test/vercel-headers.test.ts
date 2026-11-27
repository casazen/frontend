import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Security headers of the deployed SPA (vercel.json, FD-17 / A9-29). The sources only use groups, so they are read
 * here as anchored regular expressions, like Vercel's path-to-regexp does for them.
 */
interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as { headers: HeaderRule[] };

function headersFor(path: string): Record<string, string> {
  const matching = vercel.headers.filter((rule) => new RegExp(`^${rule.source}$`).test(path));
  // Disjoint rules: a path never gets two values for the same header.
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
  // The page where an administrator confirms that the plugin of a site connects to the agency (PLG-FE-CONSOLE): never framed, or a site could put its button under another.
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
// The guest check-in page: the one page that opens the camera, for the selfie of the identity check (E03/F04/US03/T01). With `camera=()` the browser
// refuses `getUserMedia` outright and the selfie can never start; the page can still not be framed.
const CHECKIN_PATHS = ['/checkin/some-token', '/checkin/another-token'];
const BOOKING_SITE_PATHS = ['/book/demo-org', '/book/demo-org/property/villa/checkout'];
// The public site of a supplier: the editor of its showcase previews it in a same-origin iframe (SP-09-FE).
const SUPPLIER_SITE_PATHS = ['/fornitori/pulizie-roma', '/fornitori/pulizie-roma/servizi/pulizia-standard'];
// The pages of the embeddable widgets (E41, NF-144): the only pages that another website may frame, on the agency's domain and under its org on CasaZen's.
const EMBED_PAGE_PATHS = [
  '/embed/booking',
  '/embed/property/casa-mare',
  '/embed/guest-access',
  '/embed/demo-org/booking',
  '/embed/demo-org/property/casa-mare',
  '/embed/demo-org/guest-access',
];
// The static files of the loader script and its manifest: scripts, not pages.
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

    // The "Vetrina" settings page previews the booking site in a same-origin iframe.
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

    // The enforced policy lets any https page frame it; there is no `X-Frame-Options` to contradict it (it has no value for «any https page»).
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
    // The loader files are scripts and data, framed by nobody. But a path under them that is no file is answered with the page of the app (the fallback of
    // `rewrites`), and that document must not be framable: it would not be a widget, and it holds routes that no widget is meant to show in another site.
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
    // The one rule in the file that lets other websites frame something is the one of the pages of the widgets.
    const framableByOthers = vercel.headers.filter((rule) => rule.headers.some((header) => /frame-ancestors[^;]*\bhttps:/.test(header.value)));

    expect(framableByOthers.map((rule) => rule.source)).toEqual(['/embed/((?!v1/).*)']);
    const [pageRule] = framableByOthers;
    expect(pageRule.headers.find((header) => header.key === 'Content-Security-Policy')?.value).toBe('frame-ancestors https:');
    expect(pageRule.headers.some((header) => header.key.toLowerCase() === 'x-frame-options')).toBe(false);

    // Every other rule keeps `frame-ancestors` on `'none'` or `'self'`, with the old header saying the same: no wildcard, no host, no scheme.
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
    // The app, the sign-in, the check-in, the checkout and the portals of an agency's domain, the booking site and the supplier site: the browser refuses
    // every frame of another website. `/embed` alone and the paths that only start like it are the app's too (they are in `APP_PATHS`).
    for (const path of [...APP_PATHS, ...CHECKIN_PATHS, ...BOOKING_SITE_PATHS, ...SUPPLIER_SITE_PATHS, '/book/demo-org/property/villa/checkout']) {
      const headers = headersFor(path);
      expect(['DENY', 'SAMEORIGIN'], path).toContain(headers['x-frame-options']);
      expect(["frame-ancestors 'none'", "frame-ancestors 'self'"], path).toContain(headers['content-security-policy']);
    }
    // The app and the check-in are not framed at all, as before.
    for (const path of [...APP_PATHS, ...CHECKIN_PATHS]) {
      expect(headersFor(path)['x-frame-options'], path).toBe('DENY');
      expect(headersFor(path)['content-security-policy'], path).toBe("frame-ancestors 'none'");
    }
  });

  it.each(CHECKIN_PATHS)('headers_checkinPath_%s_letsThePageOpenTheCameraForTheSelfie', (path) => {
    const policy = headersFor(path)['permissions-policy'];

    // `camera=()` would make the browser refuse `getUserMedia` before the guest is even asked: the selfie step could never start.
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
    // API origin comes from VITE_API_BASE_URL at build time and vercel.json cannot read it: https: covers the API,
    // Auth0 (/oauth/token), api.stripe.com and Supabase.
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

    // The report-only policy of a page of a widget is the one of the app, with the frame ancestors of the widgets.
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
