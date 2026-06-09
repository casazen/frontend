import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';

const mockGetAccessToken = vi.fn<() => Promise<string | undefined>>();

vi.mock('@/config/api.config', () => ({
  apiConfig: { baseURL: '/api', timeout: 5000 },
}));

vi.mock('axios', () => {
  const instance = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
  };

  return {
    default: {
      create: vi.fn(() => instance),
    },
  };
});

describe('axios public endpoint allowlist (#212)', () => {
  let requestInterceptor: (config: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig>;

  beforeEach(async () => {
    vi.resetModules();
    mockGetAccessToken.mockResolvedValue('test-token');

    const axiosModule = await import('../axios');
    axiosModule.setAccessTokenGetter(mockGetAccessToken);

    const axios = (await import('axios')).default;
    const instance = axios.create();
    const useMock = vi.mocked(instance.interceptors.request.use);
    requestInterceptor = useMock.mock.calls[0][0] as typeof requestInterceptor;
  });

  it('AC12: skips auth for /properties/search', async () => {
    const config = { url: '/properties/search', headers: {} } as InternalAxiosRequestConfig;
    const result = await requestInterceptor(config);

    expect(mockGetAccessToken).not.toHaveBeenCalled();
    expect(result.headers?.Authorization).toBeUndefined();
  });

  it('AC12: skips auth for /properties/:id/public', async () => {
    const config = {
      url: '/properties/11111111-1111-1111-1111-111111111111/public',
      headers: {},
    } as InternalAxiosRequestConfig;

    await requestInterceptor(config);

    expect(mockGetAccessToken).not.toHaveBeenCalled();
  });

  it('AC12: attaches auth for protected property endpoints', async () => {
    const config = { url: '/properties', headers: {} } as InternalAxiosRequestConfig;
    await requestInterceptor(config);

    expect(mockGetAccessToken).toHaveBeenCalled();
  });
});
