import { describe, expect, it } from 'vitest';
import { assertDemoBuildAllowed, DEMO_BUILD_MODE } from '../demo-build-guard';

describe('assertDemoBuildAllowed (A9-38)', () => {
  it('assertDemoBuildAllowed_DevServerWithDemoFlag_EnablesDemo', () => {
    expect(assertDemoBuildAllowed({ command: 'serve', mode: 'development', demoFlag: 'true', vercelEnv: undefined })).toBe(true);
    expect(assertDemoBuildAllowed({ command: 'serve', mode: 'development', demoFlag: 'false', vercelEnv: undefined })).toBe(false);
  });

  it('assertDemoBuildAllowed_NormalBuildWithoutFlag_IsNotDemo', () => {
    expect(assertDemoBuildAllowed({ command: 'build', mode: 'production', demoFlag: undefined, vercelEnv: 'production' })).toBe(false);
    expect(assertDemoBuildAllowed({ command: 'build', mode: 'production', demoFlag: 'false', vercelEnv: 'preview' })).toBe(false);
  });

  it('assertDemoBuildAllowed_NormalBuildWithDemoFlag_Throws', () => {
    // A VITE_DEMO_MODE=true leaked into Vercel or CI must never ship an app that opens without login.
    expect(() =>
      assertDemoBuildAllowed({ command: 'build', mode: 'production', demoFlag: 'true', vercelEnv: 'production' }),
    ).toThrow(/build:demo/);
    expect(() =>
      assertDemoBuildAllowed({ command: 'build', mode: 'production', demoFlag: 'true', vercelEnv: undefined }),
    ).toThrow(/normal build/);
  });

  it('assertDemoBuildAllowed_DemoBuild_EnablesDemoOutsideVercelProduction', () => {
    expect(assertDemoBuildAllowed({ command: 'build', mode: DEMO_BUILD_MODE, demoFlag: 'true', vercelEnv: undefined })).toBe(true);
    expect(assertDemoBuildAllowed({ command: 'build', mode: DEMO_BUILD_MODE, demoFlag: 'true', vercelEnv: 'preview' })).toBe(true);
  });

  it('assertDemoBuildAllowed_DemoBuildOnVercelProduction_Throws', () => {
    expect(() =>
      assertDemoBuildAllowed({ command: 'build', mode: DEMO_BUILD_MODE, demoFlag: 'true', vercelEnv: 'production' }),
    ).toThrow(/production/);
  });

  it('assertDemoBuildAllowed_DemoModeWithoutFlag_Throws', () => {
    // `vite build --mode demo` without the variable would silently produce a normal build (the old build:demo bug).
    expect(() =>
      assertDemoBuildAllowed({ command: 'build', mode: DEMO_BUILD_MODE, demoFlag: undefined, vercelEnv: undefined }),
    ).toThrow(/VITE_DEMO_MODE=true/);
  });
});
