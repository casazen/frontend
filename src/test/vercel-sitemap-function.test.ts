// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, HEAD, sitemapUpstreamUrl } from '../../api/sitemap';

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
});
