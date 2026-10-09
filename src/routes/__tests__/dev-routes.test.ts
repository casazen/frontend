import { afterEach, describe, expect, it, vi } from 'vitest';

describe('devRoutes (UI-07)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('devRoutes_OnTheDevServer_HoldsThePageOfThePrimitives', async () => {
    vi.stubEnv('DEV', true);
    vi.resetModules();

    const { devRoutes } = await import('../dev-routes');

    expect(devRoutes.map((route) => route.path)).toEqual(['/dev/primitives']);
  });

  it('devRoutes_InABuild_IsEmptySoThePageIsNotShippedNorReachable', async () => {
    vi.stubEnv('DEV', false);
    vi.resetModules();

    const { devRoutes } = await import('../dev-routes');

    expect(devRoutes).toEqual([]);
  });

  // Imports the page of the primitives and everything it shows: the first time, on a slow machine, that takes longer than the
  // 5 seconds a test is given by default.
  it('devRoutes_Page_LoadsOnDemand', { timeout: 30_000 }, async () => {
    vi.stubEnv('DEV', true);
    vi.resetModules();
    const { devRoutes } = await import('../dev-routes');

    const loaded = await devRoutes[0].lazy?.();

    expect(loaded).toEqual({ Component: expect.any(Function) });
  });
});
