// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import viteConfig from '../../../vite.config';

/**
 * PLG-FE-CONSOLE, NF-200: the console links the plugin of its own channel (`pluginDownloadUrl`) from the deployment the bundle was built for, which `vite.config.ts` writes into the code at
 * build time (`define`) from `VERCEL_ENV`: nobody sets a variable for it. The pure part (which channel for which build) is proven in `embed-snippet.test.ts`; this is the wiring.
 */
type ConfigOf = (env: { command: 'build' | 'serve'; mode: string; isSsrBuild: boolean; isPreview: boolean }) => { define?: Record<string, string> };

/** The configuration Vite builds for the dev server: no check of the variables of a Vercel build (that is `vercel-build-env.test.ts`), the `define` is the same. */
const defineOf = () => (viteConfig as unknown as ConfigOf)({ command: 'serve', mode: 'development', isSsrBuild: false, isPreview: false }).define;

describe('vite.config.ts define of the deployment (PLG-FE-CONSOLE, NF-200)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(['production', 'preview', 'development'])('define_VercelEnv_%s_IsWrittenIntoTheBundleAsText', (vercelEnv) => {
    vi.stubEnv('VERCEL_ENV', vercelEnv);

    expect(defineOf()).toEqual({ __CASAZEN_DEPLOY_ENV__: JSON.stringify(vercelEnv) });
  });

  it('define_OutsideVercel_IsAnEmptyText_SoTheChannelIsDevelop', () => {
    vi.stubEnv('VERCEL_ENV', undefined);

    expect(defineOf()).toEqual({ __CASAZEN_DEPLOY_ENV__: '""' });
  });
});
