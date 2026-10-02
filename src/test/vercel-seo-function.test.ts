// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, HEAD, isAppHost, requestHost, seoRoute, seoUpstreamUrl } from '../../api/seo';

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
    ['kind=host&path=/', 'hosts/page', true],
    ['kind=host&path=/property/casa-mare', 'hosts/page', true],
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
    'kind=host',
    'kind=host&path=',
    'kind=host&path=/book/villa-rossi',
    'kind=host&path=/property/',
    'kind=host&path=/property/a/b',
    'kind=host&path=//evil.example.test',
    'kind=host&path=/property/..%2F..',
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

describe('isAppHost', () => {
  const PUBLIC_SITE = 'https://public-site.example.test';

  it.each(['public-site.example.test', 'PUBLIC-SITE.example.test:443', 'localhost', 'localhost:3000', '127.0.0.1', 'casazen-abc.vercel.app'])(
    'isAppHost_%s_IsTheAppItself',
    (host) => {
      expect(isAppHost(host, PUBLIC_SITE)).toBe(true);
    },
  );

  it.each(['www.villa-rossi.example.test', 'villa.sites.example.test', 'public-site.example.test.evil.test', 'evil-vercel.app.test'])(
    'isAppHost_%s_MayBeAnOrgSite',
    (host) => {
      expect(isAppHost(host, PUBLIC_SITE)).toBe(false);
    },
  );

  it('isAppHost_PublicSiteNotConfigured_OnlyLocalAndVercelHostsAreTheApp', () => {
    expect(isAppHost('public-site.example.test', undefined)).toBe(false);
    expect(isAppHost('localhost', undefined)).toBe(true);
  });
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

  describe('kind=host (the org own hosts, BK-16)', () => {
    const HOST_QUERY = 'kind=host&path=/property/casa-mare';

    beforeEach(() => {
      vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://public-site.example.test');
    });

    it('GET_OrgOwnHost_AsksTheBackendWithTheHostAndThePath', async () => {
      fetchMock.mockResolvedValue(new Response(PAGE, { status: 200 }));

      const response = await GET(request(HOST_QUERY, { 'x-forwarded-host': 'www.villa-rossi.example.test' }));

      expect(String(fetchMock.mock.calls[0][0])).toBe(
        `${API_BASE}/public/seo/hosts/page?host=www.villa-rossi.example.test&path=%2Fproperty%2Fcasa-mare`,
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(PAGE);
    });

    it('GET_OrgOwnHostUnknownToTheBackend_IsA404NotTheSinglePageApp', async () => {
      // A custom domain still waiting for its verification: nothing to index, and no app to show.
      fetchMock.mockResolvedValue(new Response(PAGE, { status: 404, headers: { 'X-Seo-Host': 'unknown' } }));

      const response = await GET(request('kind=host&path=/', { 'x-forwarded-host': 'www.pending.example.test' }));

      expect(response.status).toBe(404);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('GET_OrgOwnHostRedirect_IsAPermanentRedirectToThePathOfThatHost', async () => {
      fetchMock.mockResolvedValue(new Response('', { status: 301, headers: { Location: '/property/casa-mare' } }));

      const response = await GET(request('kind=host&path=/property/0f6c', { 'x-forwarded-host': 'www.villa-rossi.example.test' }));

      expect(response.status).toBe(301);
      expect(response.headers.get('location')).toBe('/property/casa-mare');
    });

    it.each(['public-site.example.test', 'casazen-abc.vercel.app', 'localhost:3000'])(
      'GET_AppOwnHost_%s_ServesTheSinglePageAppAndNeverCallsTheBackend',
      async (host) => {
        const shell = '<!doctype html><html lang="it"><body><div id="root"></div></body></html>';
        fetchMock.mockResolvedValue(new Response(shell, { status: 200 }));

        const response = await GET(request('kind=host&path=/', { 'x-forwarded-host': host }));

        expect(response.status).toBe(200);
        expect(await response.text()).toBe(shell);
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(String(fetchMock.mock.calls[0][0])).toBe(`https://${host}/index.html`);
      },
    );

    it('GET_AppOwnHostWhoseIndexCannotBeRead_Is503', async () => {
      fetchMock.mockResolvedValue(new Response('<html>sign in to Vercel</html>', { status: 401 }));

      const response = await GET(request('kind=host&path=/', { 'x-forwarded-host': 'casazen-abc.vercel.app' }));

      expect(response.status).toBe(503);
    });

    it('GET_AppOwnHostThatIsNotAPlainHostName_IsNotFetched', async () => {
      const response = await GET(request('kind=host&path=/', { 'x-forwarded-host': 'localhost/evil?x=' }));

      expect(response.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('GET_NoHost_Is404', async () => {
      expect((await GET(request('kind=host&path=/'))).status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });
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
