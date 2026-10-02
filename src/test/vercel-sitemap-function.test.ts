// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, HEAD, sitemapUpstreamPath, sitemapUpstreamUrl } from '../../api/sitemap';

/** Vercel function behind /sitemap.xml (SE-02 / A8-02): the backend sitemap, proxied on the web app domain. */
const API_BASE = 'https://api.example.test/api';
const SITEMAP =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
  '<url><loc>https://public-site.example.test/p/affitti-brevi</loc></url></urlset>';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('VITE_API_BASE_URL', API_BASE);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('api/sitemap.ts', () => {
  it.each([
    [API_BASE, `${API_BASE}/public/sitemap.xml`],
    [`${API_BASE}/`, `${API_BASE}/public/sitemap.xml`],
    [' http://localhost:5000/api ', 'http://localhost:5000/api/public/sitemap.xml'],
  ])('sitemapUpstreamUrl_%s_pointsToTheBackendSitemap', (apiBaseUrl, expected) => {
    expect(sitemapUpstreamUrl(apiBaseUrl)?.toString()).toBe(expected);
  });

  it.each([[undefined], [''], ['api.example.test'], ['ftp://api.example.test/api']])(
    'sitemapUpstreamUrl_invalidApiBase_%s_isNull',
    (apiBaseUrl) => {
      expect(sitemapUpstreamUrl(apiBaseUrl)).toBeNull();
    },
  );

  it('GET_backendAnswersSitemap_returnsItAsXmlCachedByTheCdn', async () => {
    fetchMock.mockResolvedValue(new Response(SITEMAP, { status: 200, headers: { 'Content-Type': 'application/xml' } }));

    const response = await GET();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${API_BASE}/public/sitemap.xml`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(await response.text()).toBe(SITEMAP);
  });

  it.each([
    ['backend error', () => new Response('boom', { status: 500 })],
    ['html instead of a sitemap', () => new Response('<!doctype html><html></html>', { status: 200 })],
  ])('GET_%s_is503NeverCached', async (_case, answer) => {
    fetchMock.mockResolvedValue(answer());

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('3600');
  });

  it('GET_backendUnreachable_is503', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    expect((await GET()).status).toBe(503);
  });

  it('GET_apiBaseUrlMissing_is503WithoutCallingAnyHost', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    const response = await GET();

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('HEAD_returnsTheStatusAndHeadersOfGetWithoutBody', async () => {
    fetchMock.mockResolvedValue(new Response(SITEMAP, { status: 200 }));

    const response = await HEAD();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(await response.text()).toBe('');
  });

  // BK-15: the sitemaps of the booking sites go through the same function.
  it.each([
    ['', 'public/sitemap.xml'],
    ['name=book', 'public/sitemap-book.xml'],
    ['org=villa-rossi', 'public/orgs/villa-rossi/sitemap.xml'],
  ])('sitemapUpstreamPath_%s_is%s', (query, expected) => {
    expect(sitemapUpstreamPath(new URLSearchParams(query))).toBe(expected);
  });

  it.each(['org=', 'org=../admin', 'org=a/b', 'org=a b', `org=${'a'.repeat(101)}`])(
    'sitemapUpstreamPath_%s_isNullSoNothingIsCalled',
    (query) => {
      expect(sitemapUpstreamPath(new URLSearchParams(query))).toBeNull();
    },
  );

  it('GET_BookingSitemapIndex_isProxiedFromItsOwnBackendEndpoint', async () => {
    const index =
      '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      '<sitemap><loc>https://public-site.example.test/book/villa/sitemap.xml</loc></sitemap></sitemapindex>';
    fetchMock.mockResolvedValue(new Response(index, { status: 200 }));

    const response = await GET(new Request('https://public-site.example.test/api/sitemap?name=book'));

    expect(String(fetchMock.mock.calls[0][0])).toBe(`${API_BASE}/public/sitemap-book.xml`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(await response.text()).toBe(index);
  });

  it('GET_OrgSitemap_isProxiedFromTheOrgEndpoint', async () => {
    fetchMock.mockResolvedValue(new Response(SITEMAP, { status: 200 }));

    const response = await GET(new Request('https://public-site.example.test/api/sitemap?org=villa-rossi'));

    expect(String(fetchMock.mock.calls[0][0])).toBe(`${API_BASE}/public/orgs/villa-rossi/sitemap.xml`);
    expect(response.status).toBe(200);
  });

  it('GET_OrgWithoutSitemap_isA404NotAnOutage', async () => {
    // Unknown org, renamed org or nothing published: the backend answers 404, which is not a 503 to retry.
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));

    const response = await GET(new Request('https://public-site.example.test/api/sitemap?org=villa-rossi'));

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('GET_InvalidOrgSlug_is404WithoutCallingTheBackend', async () => {
    const response = await GET(new Request('https://public-site.example.test/api/sitemap?org=..%2Fadmin'));

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET_BackendErrorOnAnOrgSitemap_is503', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

    expect((await GET(new Request('https://public-site.example.test/api/sitemap?org=villa-rossi'))).status).toBe(503);
  });

  // BK-16: the Host of the request makes /sitemap.xml the sitemap of an org's own site.
  it('sitemapUpstreamUrl_GuidesSitemapWithAHost_CarriesTheHost', () => {
    expect(sitemapUpstreamUrl(API_BASE, 'public/sitemap.xml', 'www.villa-rossi.example.test')?.toString()).toBe(
      `${API_BASE}/public/sitemap.xml?host=www.villa-rossi.example.test`,
    );
  });

  it('sitemapUpstreamUrl_OtherSitemapsWithAHost_NeverCarryIt', () => {
    expect(sitemapUpstreamUrl(API_BASE, 'public/sitemap-book.xml', 'www.villa-rossi.example.test')?.search).toBe('');
  });

  it('GET_RequestOnAnOrgHost_AsksTheGuidesSitemapEndpointWithThatHost', async () => {
    fetchMock.mockResolvedValue(new Response(SITEMAP, { status: 200 }));

    const response = await GET(
      new Request('https://www.villa-rossi.example.test/api/sitemap', { headers: { 'x-forwarded-host': 'WWW.Villa-Rossi.example.test' } }),
    );

    expect(String(fetchMock.mock.calls[0][0])).toBe(`${API_BASE}/public/sitemap.xml?host=www.villa-rossi.example.test`);
    expect(response.status).toBe(200);
  });

  it('GET_HostThatIsNotAPlainHostName_IsNotForwarded', async () => {
    fetchMock.mockResolvedValue(new Response(SITEMAP, { status: 200 }));

    await GET(new Request('https://x.example.test/api/sitemap', { headers: { 'x-forwarded-host': 'evil.test/path?a=b' } }));

    expect(String(fetchMock.mock.calls[0][0])).toBe(`${API_BASE}/public/sitemap.xml`);
  });

  it('GET_OrgHostWithNothingPublished_isA404NotAnOutage', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));

    const response = await GET(
      new Request('https://www.villa-rossi.example.test/api/sitemap', { headers: { 'x-forwarded-host': 'www.villa-rossi.example.test' } }),
    );

    expect(response.status).toBe(404);
  });
});
