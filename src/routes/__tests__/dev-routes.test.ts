import { afterEach, describe, expect, it, vi } from 'vitest';

/** The pages for the people who build the app, by their address: a new page adds its line here, and nothing else in this file. */
const DEV_PAGES = ['/dev/primitives', '/dev/list-view', '/dev/detail-drawer', '/dev/calm-blocks', '/dev/stay-pickers', '/dev/maps'];

describe('devRoutes (UI-07)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('devRoutes_OnTheDevServer_HoldsEveryPageForDevelopers', async () => {
    vi.stubEnv('DEV', true);
    vi.resetModules();

    const { devRoutes } = await import('../dev-routes');

    expect(devRoutes.map((route) => route.path).sort()).toEqual([...DEV_PAGES].sort());
  });

  it('devRoutes_InABuild_IsEmptySoThePageIsNotShippedNorReachable', async () => {
    vi.stubEnv('DEV', false);
    vi.resetModules();

    const { devRoutes } = await import('../dev-routes');

    expect(devRoutes).toEqual([]);
  });

  // Each page imports everything it shows: the first time, on a slow machine, that takes longer than the 5 seconds a test is
  // given by default.
  it.each(DEV_PAGES)('devRoutes_Page_%s_LoadsOnDemand', { timeout: 30_000 }, async (path) => {
    vi.stubEnv('DEV', true);
    vi.resetModules();
    const { devRoutes } = await import('../dev-routes');

    const loaded = await devRoutes.find((route) => route.path === path)?.lazy?.();

    expect(loaded).toEqual({ Component: expect.any(Function) });
  });
});
