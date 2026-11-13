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

// `/checkin` alone is no page of the guest (the link carries a token): it stays with the app and keeps the camera off.
const APP_PATHS = ['/', '/login', '/app/short-rent/bookings', '/checkin', '/p/tassa-soggiorno/milano', '/book'];
// The guest check-in page: the one page that opens the camera, for the selfie of the identity check (E03/F04/US03/T01). With `camera=()` the browser
// refuses `getUserMedia` outright and the selfie can never start; the page can still not be framed.
const CHECKIN_PATHS = ['/checkin/some-token', '/checkin/another-token'];
const BOOKING_SITE_PATHS = ['/book/demo-org', '/book/demo-org/property/villa/checkout'];
// The public site of a supplier: the editor of its showcase previews it in a same-origin iframe (SP-09-FE).
const SUPPLIER_SITE_PATHS = ['/fornitori/pulizie-roma', '/fornitori/pulizie-roma/servizi/pulizia-standard'];

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

  it.each([...APP_PATHS, ...CHECKIN_PATHS, ...BOOKING_SITE_PATHS, ...SUPPLIER_SITE_PATHS])('headers_%s_haveBaselineHeaders', (path) => {
    const headers = headersFor(path);

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('microphone=()');
  });

  it.each([...APP_PATHS, ...BOOKING_SITE_PATHS, ...SUPPLIER_SITE_PATHS])('headers_%s_keepTheCameraOff', (path) => {
    expect(headersFor(path)['permissions-policy']).toContain('camera=()');
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

  it('contentSecurityPolicy_supplierSite_differsOnlyInFrameAncestors', () => {
    const app = directives(headersFor('/')['content-security-policy-report-only']);
    const supplierSite = directives(headersFor('/fornitori/pulizie-roma')['content-security-policy-report-only']);

    app.delete('frame-ancestors');
    supplierSite.delete('frame-ancestors');
    expect(supplierSite).toEqual(app);
  });
});
