import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

vi.mock('@/config/api.config', () => ({
  apiConfig: { baseURL: 'https://api.test/api', timeout: 5000 },
}));

type Reply = { status: number; data?: unknown };
type Responder = (config: InternalAxiosRequestConfig, callIndex: number) => Reply;

/** Real axios instance + interceptors; only the transport is replaced. */
async function load(respond: Responder = () => ({ status: 200, data: { ok: true } })) {
  const axiosModule = await import('@/lib/axios');
  const errors = await import('@/lib/api-errors');
  const calls: InternalAxiosRequestConfig[] = [];

  const adapter: AxiosAdapter = async (config) => {
    calls.push(config);
    const { status, data } = respond(config, calls.length - 1);
    const response: AxiosResponse = { status, data, statusText: '', headers: {}, config, request: {} };
    if (status >= 200 && status < 300) return response;
    throw new AxiosError(
      `Request failed with status code ${status}`,
      status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      {},
      response,
    );
  };
  axiosModule.default.defaults.adapter = adapter;

  const getAccessToken = vi.fn(async (): Promise<string | undefined> => 'cached-token');
  const refreshAccessToken = vi.fn(async (): Promise<string | undefined> => 'fresh-token');
  const onSessionExpired = vi.fn();
  const onForbidden = vi.fn();
  axiosModule.setApiAuthHandlers({ getAccessToken, refreshAccessToken, onSessionExpired });
  axiosModule.setApiForbiddenHandler(onForbidden);

  const authorization = (index: number) => calls[index]?.headers.get('Authorization');

  return {
    api: axiosModule.default,
    axiosModule,
    errors,
    calls,
    authorization,
    getAccessToken,
    refreshAccessToken,
    onSessionExpired,
    onForbidden,
  };
}

beforeEach(() => {
  vi.resetModules();
  window.sessionStorage.clear();
});

describe('request interceptor: explicit public flag (A9-20)', () => {
  it('request_resendCheckInLink_attachesBearerToken', async () => {
    const ctx = await load();
    await ctx.api.post('/bookings/11111111-1111-1111-1111-111111111111/checkin/resend-link');

    expect(ctx.getAccessToken).toHaveBeenCalledTimes(1);
    expect(ctx.authorization(0)).toBe('Bearer cached-token');
  });

  it('request_authProfileAndLogout_attachBearerToken', async () => {
    const ctx = await load();
    await ctx.api.get('/auth/profile');
    await ctx.api.post('/auth/logout');

    expect(ctx.authorization(0)).toBe('Bearer cached-token');
    expect(ctx.authorization(1)).toBe('Bearer cached-token');
  });

  it('request_publicPathWithoutFlag_stillAttachesToken', async () => {
    const ctx = await load();
    await ctx.api.get('/public/orgs/demo');

    expect(ctx.authorization(0)).toBe('Bearer cached-token');
  });

  it('request_publicFlag_sendsNoTokenAndNeverAsksForOne', async () => {
    const ctx = await load();
    await ctx.api.get('/public/orgs/demo', { public: true });

    expect(ctx.getAccessToken).not.toHaveBeenCalled();
    expect(ctx.calls).toHaveLength(1);
    expect(ctx.authorization(0)).toBeFalsy();
  });

  it('apiClient_publicOption_isForwardedToInterceptor', async () => {
    const ctx = await load();
    const { ApiClient } = await import('@/api/client');

    await ApiClient.get('/legal/tos', undefined, { public: true });
    await ApiClient.post('/public/bookings', { a: 1 }, { public: true });
    await ApiClient.get('/properties');

    expect(ctx.authorization(0)).toBeFalsy();
    expect(ctx.authorization(1)).toBeFalsy();
    expect(ctx.authorization(2)).toBe('Bearer cached-token');
  });

  it('publicApiModules_everyAnonymousCall_isSentWithoutToken', async () => {
    const ctx = await load(() => ({ status: 200, data: {} }));
    const { publicOrgApi } = await import('@/api/public-org.api');
    const { publicBookingApi } = await import('@/api/public-booking.api');
    const { publicCheckinApi } = await import('@/api/checkin.api');
    const { PublicSeoApi } = await import('@/api/public-seo.api');
    const { LegalApi } = await import('@/api/legal.api');
    const { propertiesApi } = await import('@/api/properties.api');
    const { DomainApi } = await import('@/api/domain.api');
    const { publicSupplierApi } = await import('@/api/public-supplier.api');
    const { registerSupplier, lookupSupplierInvite, fetchSupplierRegistrationOptions } = await import(
      '@/services/supplier-api'
    );

    await Promise.all([
      publicOrgApi.getPublicOrg('demo'),
      publicOrgApi.getOrgProperties('demo'),
      publicOrgApi.getOrgProperty('demo', 'p1'),
      publicBookingApi.createDirectBooking({} as never),
      publicBookingApi.getPropertyAvailability('p1', '2026-10-01', '2026-10-05'),
      publicBookingApi.lookupGuestBookings('guest@example.test'),
      publicBookingApi.getBookingStatus('b1'),
      publicCheckinApi.getContext('tok'),
      publicCheckinApi.submit('tok', {} as never),
      PublicSeoApi.getComplianceGuide('lazio', 'roma'),
      PublicSeoApi.getTouristTaxPage('roma'),
      PublicSeoApi.calculateTouristTax({} as never),
      LegalApi.getTos(),
      LegalApi.getPrivacy(),
      LegalApi.getDpa(),
      LegalApi.getSubprocessors(),
      propertiesApi.search({}),
      propertiesApi.getPublicProperty('p1'),
      DomainApi.resolveHost('example.test'),
      publicSupplierApi.getShowcase('mario-rossi'),
      registerSupplier(
        { email: 'a@example.test', legalName: 'A', phone: '1', comuneCode: 'H501' },
        { authenticated: false },
      ),
      lookupSupplierInvite('tok'),
      fetchSupplierRegistrationOptions(),
    ]);

    expect(ctx.calls).toHaveLength(23);
    expect(ctx.getAccessToken).not.toHaveBeenCalled();
    ctx.calls.forEach((_, index) => expect(ctx.authorization(index)).toBeFalsy());
  });

  it('registerSupplier_signedIn_sendsBearerTokenSoTheAccountIsLinked', async () => {
    const ctx = await load(() => ({ status: 201, data: { orgId: 'o1' } }));
    const { registerSupplier } = await import('@/services/supplier-api');

    await registerSupplier(
      { email: 'a@example.test', legalName: 'A', phone: '1', comuneCode: 'H501', inviteToken: 'tok' },
      { authenticated: true },
    );

    expect(ctx.authorization(0)).toBe('Bearer cached-token');
    expect(ctx.calls[0]?.data).toContain('"inviteToken":"tok"');
  });

  it('supplierShowcase_getShowcase_usesApiBaseUrlNotRelativeFetch', async () => {
    const ctx = await load(() => ({ status: 200, data: { slug: 'mario-rossi' } }));
    const { publicSupplierApi } = await import('@/api/public-supplier.api');

    await publicSupplierApi.getShowcase('mario rossi');

    expect(ctx.calls[0].baseURL).toBe('https://api.test/api');
    expect(ctx.calls[0].url).toBe('/public/suppliers/mario%20rossi');
  });
});

describe('request interceptor: never sends a protected request without a token (A9-22)', () => {
  it('request_getterThrowsLoginRequired_rejectsUnsentAndStartsRelogin', async () => {
    const ctx = await load();
    ctx.getAccessToken.mockRejectedValue(Object.assign(new Error('Login required'), { error: 'login_required' }));

    const failure = await ctx.api.get('/bookings').catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(ctx.errors.AuthTokenUnavailableError);
    expect((failure as InstanceType<typeof ctx.errors.AuthTokenUnavailableError>).reason).toBe('login_required');
    expect(ctx.calls).toHaveLength(0);
    expect(ctx.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('request_getterFailsTransiently_rejectsUnsentWithoutRelogin', async () => {
    const ctx = await load();
    ctx.getAccessToken.mockRejectedValue(new Error('Timeout'));

    await expect(ctx.api.get('/bookings')).rejects.toBeInstanceOf(ctx.errors.AuthTokenUnavailableError);
    expect(ctx.calls).toHaveLength(0);
    expect(ctx.onSessionExpired).not.toHaveBeenCalled();
  });

  it('request_getterReturnsNoToken_rejectsUnsent', async () => {
    const ctx = await load();
    ctx.getAccessToken.mockResolvedValue(undefined);

    await expect(ctx.api.get('/bookings')).rejects.toBeInstanceOf(ctx.errors.AuthTokenUnavailableError);
    expect(ctx.calls).toHaveLength(0);
  });

  it('request_noAuthProviderMounted_rejectsUnsent', async () => {
    const ctx = await load();
    ctx.axiosModule.setApiAuthHandlers(null);

    const failure = await ctx.api.get('/bookings').catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(ctx.errors.AuthTokenUnavailableError);
    expect(ctx.calls).toHaveLength(0);
  });
});

describe('response interceptor: 401 → refresh once, then re-login (A9-22)', () => {
  it('response401_refreshSucceeds_replaysOnceAndResolves', async () => {
    const ctx = await load((_, index) => (index === 0 ? { status: 401 } : { status: 200, data: { id: 'b1' } }));
    ctx.getAccessToken.mockResolvedValueOnce('stale-token').mockResolvedValueOnce('fresh-token');

    const response = await ctx.api.get('/bookings/b1');

    expect(response.data).toEqual({ id: 'b1' });
    expect(ctx.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(ctx.calls).toHaveLength(2);
    expect(ctx.authorization(0)).toBe('Bearer stale-token');
    expect(ctx.authorization(1)).toBe('Bearer fresh-token');
    expect(ctx.onSessionExpired).not.toHaveBeenCalled();
  });

  it('response401_afterReplay_startsReloginOnceAndRejects', async () => {
    const ctx = await load(() => ({ status: 401 }));

    const failure = await ctx.api.get('/bookings').catch((e: unknown) => e);

    expect((failure as AxiosError).response?.status).toBe(401);
    expect(ctx.calls).toHaveLength(2);
    expect(ctx.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(ctx.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('response401_refreshFails_startsReloginWithoutReplay', async () => {
    const ctx = await load(() => ({ status: 401 }));
    ctx.refreshAccessToken.mockRejectedValue(Object.assign(new Error('x'), { error: 'missing_refresh_token' }));

    await expect(ctx.api.get('/bookings')).rejects.toBeInstanceOf(AxiosError);
    expect(ctx.calls).toHaveLength(1);
    expect(ctx.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('response401_concurrentRequests_startReloginOnlyOnce', async () => {
    const ctx = await load(() => ({ status: 401 }));

    await Promise.allSettled([ctx.api.get('/bookings'), ctx.api.get('/properties'), ctx.api.get('/users/me')]);

    expect(ctx.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('response401_reloginStartedLessThanAMinuteAgo_doesNotRedirectAgain', async () => {
    const ctx = await load(() => ({ status: 401 }));
    window.sessionStorage.setItem(ctx.axiosModule.RELOGIN_GUARD_STORAGE_KEY, String(Date.now() - 5_000));

    await expect(ctx.api.get('/bookings')).rejects.toBeInstanceOf(AxiosError);
    expect(ctx.onSessionExpired).not.toHaveBeenCalled();
  });

  it('response401_previousReloginOutsideGuardWindow_redirectsAgain', async () => {
    const ctx = await load(() => ({ status: 401 }));
    window.sessionStorage.setItem(
      ctx.axiosModule.RELOGIN_GUARD_STORAGE_KEY,
      String(Date.now() - ctx.axiosModule.RELOGIN_GUARD_MS - 1_000),
    );

    await expect(ctx.api.get('/bookings')).rejects.toBeInstanceOf(AxiosError);
    expect(ctx.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('response401_publicRequest_neitherRefreshesNorRelogs', async () => {
    const ctx = await load(() => ({ status: 401 }));

    await expect(ctx.api.get('/public/checkin/tok', { public: true })).rejects.toBeInstanceOf(AxiosError);
    expect(ctx.refreshAccessToken).not.toHaveBeenCalled();
    expect(ctx.onSessionExpired).not.toHaveBeenCalled();
  });
});

describe('response interceptor: 403 → no-access page (A9-22)', () => {
  it('response403_protectedReadWithoutCode_opensNoAccess', async () => {
    const ctx = await load(() => ({ status: 403, data: { title: 'Forbidden', status: 403 } }));

    await expect(ctx.api.get('/bookings/b1')).rejects.toBeInstanceOf(AxiosError);
    expect(ctx.onForbidden).toHaveBeenCalledTimes(1);
    expect(ctx.onSessionExpired).not.toHaveBeenCalled();
  });

  it('response403_businessCode_isLeftToTheCaller', async () => {
    const ctx = await load(() => ({ status: 403, data: { code: 'plan_required' } }));

    await expect(ctx.api.get('/orgs/o1/domain')).rejects.toBeInstanceOf(AxiosError);
    expect(ctx.onForbidden).not.toHaveBeenCalled();
  });

  it('response403_write_isLeftToTheMutation', async () => {
    const ctx = await load(() => ({ status: 403 }));

    await expect(ctx.api.post('/properties', {})).rejects.toBeInstanceOf(AxiosError);
    expect(ctx.onForbidden).not.toHaveBeenCalled();
  });

  it('response403_publicRequest_doesNotOpenNoAccess', async () => {
    const ctx = await load(() => ({ status: 403 }));

    await expect(ctx.api.get('/public/orgs/demo', { public: true })).rejects.toBeInstanceOf(AxiosError);
    expect(ctx.onForbidden).not.toHaveBeenCalled();
  });
});

describe('logging (A1-34, A9-36)', () => {
  it('request_authenticatedCallsAndRefresh_neverWriteToTheConsole', async () => {
    const spies = (['log', 'info', 'debug', 'warn', 'error'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    );
    try {
      const ctx = await load((config, callIndex) => (callIndex === 0 ? { status: 401 } : { status: 200, data: config.url }));

      await ctx.api.get('/properties');
      await ctx.api.get('/bookings');

      // 401, refresh, replay, then a second call: every path that handles the token ran.
      expect(ctx.refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(ctx.calls).toHaveLength(3);
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
