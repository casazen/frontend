// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import viteConfig from '../../../vite.config';

type ConfigOf = (env: { command: 'build' | 'serve'; mode: string; isSsrBuild: boolean; isPreview: boolean }) => { define?: Record<string, string> };

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
