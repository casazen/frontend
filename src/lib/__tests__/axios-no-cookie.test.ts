import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The API client reads no cookie (NF-144, AC-NF144-3: a page of `/embed/*` uses no storage and no cookie, so a browser that refuses them must not break the widget).
 *
 * axios looks for an XSRF token in `document.cookie` on EVERY request of the origin of the page, and an API served under the host of the page is the shape of the dev
 * server, of the L2 suite and of the cross-origin proof of the widgets (`VITE_API_BASE_URL=/api`). The API of this app takes a bearer token, never a cookie, so there is
 * nothing to look for. Here the API is on the origin of the page and the browser refuses the cookie (the read throws): the request must go out all the same, and the
 * cookie must never have been asked for.
 */
vi.mock('@/config/api.config', () => ({
  apiConfig: { baseURL: `${window.location.origin}/api`, timeout: 5000 },
}));

const refused = () => {
  throw new DOMException('Access is denied for this document.', 'SecurityError');
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the API client and the cookie', () => {
  it('axios_requestToTheOriginOfThePage_readsNoCookieAndGoesOutWhenTheBrowserRefusesIt', async () => {
    const cookie = vi.spyOn(Document.prototype, 'cookie', 'get').mockImplementation(refused);
    const wrote = vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation(refused);
    const answer = vi.fn(async () => new Response(JSON.stringify({ siteEmbed: true }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const { default: axios } = await import('@/lib/axios');

    const response = await axios.get<{ siteEmbed: boolean }>('/public/features', { public: true, adapter: 'fetch', env: { fetch: answer } });

    expect(response.data).toEqual({ siteEmbed: true });
    expect(answer).toHaveBeenCalledTimes(1);
    expect(cookie).not.toHaveBeenCalled();
    expect(wrote).not.toHaveBeenCalled();
  });
});
