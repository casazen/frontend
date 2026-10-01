// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, HEAD, requestHost, seoRoute, seoUpstreamUrl } from '../../api/seo';

/**
 * Vercel function that serves crawlers the HTML of the public pages (BK-15): the route table, the validation of what
 * reaches the backend, the Host of the request, and how every backend answer is passed on (200, real 404, 301, outage).
 */
const API_BASE = 'https://api.example.test/api';
const PAGE =
  '<!doctype html><html lang="it"><head><title>Villa Lago — Rossi</title></head><body><h1>Villa Lago</h1></body></html>';

const fetchMock = vi.fn<typeof fetch>();

function request(query: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://www.rossi.example.test/api/seo?${query}`, { headers });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('VITE_API_BASE_URL', API_BASE);
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('seoRoute', () => {
  it.each([
    ['kind=org&orgSlug=villa-rossi', 'orgs/villa-rossi', true],
    ['kind=property&orgSlug=villa-rossi&propertySlugOrId=casa-mare', 'orgs/villa-rossi/properties/casa-mare', true],
    [
      'kind=property&orgSlug=villa-rossi&propertySlugOrId=0f6c1b2a-1111-2222-3333-444455556666',
      'orgs/villa-rossi/properties/0f6c1b2a-1111-2222-3333-444455556666',
      true,
    ],
    ['kind=guide&region=lombardia&comune=como', 'guides/lombardia/como', false],
    ['kind=tourist-tax&comune=como', 'tourist-tax/como', false],
    ['kind=hub', 'hub', false],
  ])('seoRoute_%s_isTheBackendRoute', (query, path, needsHost) => {
    expect(seoRoute(new URLSearchParams(query))).toMatchObject({ path, needsHost });
  });

  it.each([
    'kind=unknown',
    'orgSlug=villa-rossi',
    'kind=org',
    'kind=org&orgSlug=',
    'kind=org&orgSlug=../admin',
    'kind=org&orgSlug=a/b',
    'kind=org&orgSlug=a%20b',
    'kind=org&orgSlug=a?b=c',
    `kind=org&orgSlug=${'a'.repeat(101)}`,
    'kind=property&orgSlug=villa-rossi',
    'kind=property&orgSlug=villa-rossi&propertySlugOrId=..%2Fx',
    'kind=guide&region=lombardia',
    'kind=guide&region=lombardia&comune=co%2Fmo',
    'kind=tourist-tax',
  ])('seoRoute_%s_isRejectedBeforeTheBackendIsCalled', (query) => {
    expect(seoRoute(new URLSearchParams(query))).toBeNull();
  });
});

describe('seoUpstreamUrl', () => {
  const org = { kind: 'org', path: 'orgs/villa-rossi', needsHost: true } as const;
  const hub = { kind: 'hub', path: 'hub', needsHost: false } as const;

  it.each([
    [API_BASE, `${API_BASE}/public/seo/orgs/villa-rossi?host=www.rossi.example.test`],
    [`${API_BASE}/`, `${API_BASE}/public/seo/orgs/villa-rossi?host=www.rossi.example.test`],
  ])('seoUpstreamUrl_%s_pointsToTheBackendWithTheHost', (apiBase, expected) => {
    expect(seoUpstreamUrl(apiBase, org, 'www.rossi.example.test')?.toString()).toBe(expected);
  });

  it('seoUpstreamUrl_PageWithoutHostRules_DoesNotSendTheHost', () => {
    expect(seoUpstreamUrl(API_BASE, hub, 'www.rossi.example.test')?.toString()).toBe(`${API_BASE}/public/seo/hub`);
  });

  it('seoUpstreamUrl_HostIsEncodedNotInterpreted', () => {
    const url = seoUpstreamUrl(API_BASE, org, 'a.test&path=/admin#x');

    expect(url?.searchParams.get('host')).toBe('a.test&path=/admin#x');
    expect(url?.searchParams.size).toBe(1);
    expect(url?.pathname).toBe('/api/public/seo/orgs/villa-rossi');
  });

  it.each([[undefined], [''], ['api.example.test'], ['ftp://api.example.test/api']])(
    'seoUpstreamUrl_invalidApiBase_%s_isNull',
    (apiBase) => {
      expect(seoUpstreamUrl(apiBase, hub, null)).toBeNull();
    },
  );
});

describe('requestHost', () => {
  it('requestHost_ForwardedHostWins_OverTheHostOfTheFunction', () => {
    const headers = new Headers({ 'x-forwarded-host': 'www.rossi.example.test', host: 'casazen-abc.vercel.example' });

    expect(requestHost(headers)).toBe('www.rossi.example.test');
  });

  it('requestHost_ChainOfHosts_TakesTheFirst', () => {
    expect(requestHost(new Headers({ 'x-forwarded-host': 'a.example.test, b.example.test' }))).toBe('a.example.test');
  });

  it('requestHost_NoHeader_IsNull', () => {
    expect(requestHost(new Headers())).toBeNull();
  });
});

describe('api/seo.ts GET', () => {
  it('GET_BackendPage_IsServedUnchangedWithTheHostOfTheRequestAndNeverCached', async () => {
    fetchMock.mockResolvedValue(new Response(PAGE, { status: 200, headers: { 'Content-Type': 'text/html' } }));

    const response = await GET(
      request('kind=property&orgSlug=villa-rossi&propertySlugOrId=casa-mare', { 'x-forwarded-host': 'www.rossi.example.test' }),
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${API_BASE}/public/seo/orgs/villa-rossi/properties/casa-mare?host=www.rossi.example.test`);
    expect(init?.redirect).toBe('manual');
    expect(new Headers(init?.headers).has('accept-language')).toBe(false);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('vary')).toBe('User-Agent');
    expect(response.headers.get('x-robots-tag')).toBeNull();
    expect(await response.text()).toBe(PAGE);
  });

  it('GET_BackendNotFound_IsARealNotFoundWithTheNoindexPageOfTheBackend', async () => {
    fetchMock.mockResolvedValue(new Response(PAGE, { status: 404 }));

    const response = await GET(request('kind=org&orgSlug=gone'));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe(PAGE);
  });

  it('GET_BackendRedirect_IsAPermanentRedirectToThePathOnTheSameHost', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 301, headers: { Location: '/book/new-slug/property/casa-mare' } }));

    const response = await GET(request('kind=property&orgSlug=old&propertySlugOrId=casa-mare'));

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('/book/new-slug/property/casa-mare');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it.each([
    ['another host', 'https://evil.example.test/book/x'],
    ['a protocol-relative URL', '//evil.example.test/book/x'],
    ['a path outside the public pages', '/app/short-rent'],
    ['a path with a query', '/book/x?next=https://evil.example.test'],
    ['a path with a traversal', '/book/../app'],
    ['an encoded traversal', '/book/%2e%2e/app'],
    ['nothing', ''],
  ])('GET_BackendRedirectTo_%s_IsNeverFollowed', async (_case, location) => {
    fetchMock.mockResolvedValue(new Response('', { status: 301, headers: location ? { Location: location } : {} }));

    const response = await GET(request('kind=org&orgSlug=old'));

    expect(response.status).toBe(503);
    expect(response.headers.get('location')).toBeNull();
  });

  it.each([
    ['backend error', () => new Response('boom', { status: 500 })],
    ['rate limit', () => new Response('slow down', { status: 429 })],
    ['a bad request', () => new Response('{}', { status: 400 })],
    ['something that is not a page', () => new Response('{"ok":true}', { status: 200 })],
  ])('GET_%s_is503NeverCachedWithRetryAfter', async (_case, answer) => {
    fetchMock.mockResolvedValue(answer());

    const response = await GET(request('kind=hub'));

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('3600');
  });

  it('GET_BackendUnreachable_is503', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    expect((await GET(request('kind=hub'))).status).toBe(503);
  });

  it('GET_ApiBaseUrlMissing_is503WithoutCallingAnyHost', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    const response = await GET(request('kind=hub'));

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET_UnknownKindOrInvalidSlug_is404WithoutCallingTheBackend', async () => {
    const unknown = await GET(request('kind=admin'));
    const invalid = await GET(request('kind=org&orgSlug=../../admin'));

    expect(unknown.status).toBe(404);
    expect(invalid.status).toBe(404);
    expect(invalid.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['preview', 'development', undefined])(
    'GET_NotProduction_%s_AddsNoindexToTheHeadersOfTheCrawlerPage',
    async (vercelEnv) => {
      // Test and preview deployments are never indexed (their robots.txt is Disallow: /, this is the second line).
      vi.stubEnv('VERCEL_ENV', vercelEnv as string);
      fetchMock.mockResolvedValue(new Response(PAGE, { status: 200 }));

      const response = await GET(request('kind=hub'));

      expect(response.status).toBe(200);
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    },
  );

  it('HEAD_returnsTheStatusAndHeadersOfGetWithoutBody', async () => {
    fetchMock.mockResolvedValue(new Response(PAGE, { status: 200 }));

    const response = await HEAD(request('kind=hub'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await response.text()).toBe('');
  });
});
