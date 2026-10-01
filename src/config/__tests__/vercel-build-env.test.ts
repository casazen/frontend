import { describe, expect, it } from 'vitest';
import { assertVercelBuildEnv, findVercelBuildEnvProblems } from '../vercel-build-env';

const COMPLETE = {
  VITE_API_BASE_URL: 'https://backend.example.test/api',
  VITE_AUTH0_DOMAIN: 'tenant.eu.auth0.com',
  VITE_AUTH0_CLIENT_ID: 'spa-client-id',
};

describe('findVercelBuildEnvProblems (DEPLOY-CFG)', () => {
  it.each(['preview', 'production'])('findVercelBuildEnvProblems_%sWithEveryVariable_ReturnsNoProblem', (vercelEnv) => {
    expect(findVercelBuildEnvProblems({ vercelEnv, demoBuild: false, env: COMPLETE })).toEqual([]);
  });

  it.each([['development'], [undefined]])(
    'findVercelBuildEnvProblems_NotAVercelReleaseEnvironment_%s_DoesNotRequireAnything',
    (vercelEnv) => {
      // Local and CI builds keep working with the fallbacks of env.config.ts.
      expect(findVercelBuildEnvProblems({ vercelEnv, demoBuild: false, env: {} })).toEqual([]);
    },
  );

  it('findVercelBuildEnvProblems_DemoBuild_DoesNotRequireAnything', () => {
    expect(findVercelBuildEnvProblems({ vercelEnv: 'preview', demoBuild: true, env: {} })).toEqual([]);
  });

  it('findVercelBuildEnvProblems_PreviewWithoutAnyVariable_NamesEveryOne', () => {
    const problems = findVercelBuildEnvProblems({ vercelEnv: 'preview', demoBuild: false, env: {} });

    expect(problems).toHaveLength(3);
    expect(problems[0]).toMatch(/^VITE_API_BASE_URL: missing.*production API/);
    expect(problems[1]).toMatch(/^VITE_AUTH0_DOMAIN: missing/);
    expect(problems[2]).toMatch(/^VITE_AUTH0_CLIENT_ID: missing/);
  });

  it.each([
    ['   ', /missing/],
    ['backend.example.test/api', /not an absolute URL/],
    ['http://backend.example.test/api', /must use https/],
    ['https://localhost:5001/api', /local address/],
    ['https://127.0.0.1/api', /local address/],
    ['https://backend.example.test/api?x=1', /query string/],
  ])('findVercelBuildEnvProblems_ApiBaseUrl_%s_IsRejected', (value, message) => {
    const problems = findVercelBuildEnvProblems({
      vercelEnv: 'production',
      demoBuild: false,
      env: { ...COMPLETE, VITE_API_BASE_URL: value },
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(message);
    // Names the variable, never repeats the value.
    expect(problems[0]).not.toContain(value.trim() || 'never-empty');
  });

  it.each(['https://tenant.eu.auth0.com', 'tenant.eu.auth0.com/', 'tenant'])(
    'findVercelBuildEnvProblems_Auth0DomainNotABareHost_%s_IsRejected',
    (value) => {
      const problems = findVercelBuildEnvProblems({
        vercelEnv: 'production',
        demoBuild: false,
        env: { ...COMPLETE, VITE_AUTH0_DOMAIN: value },
      });

      expect(problems).toEqual([expect.stringMatching(/^VITE_AUTH0_DOMAIN: must be a bare host name/)]);
    },
  );

  it('findVercelBuildEnvProblems_AudienceNotSet_IsNotRequired', () => {
    // VITE_AUTH0_AUDIENCE has a default (https://casazen-api), the checklist asks to set it to match the backend.
    expect(findVercelBuildEnvProblems({ vercelEnv: 'production', demoBuild: false, env: COMPLETE })).toEqual([]);
  });
});

describe('assertVercelBuildEnv (DEPLOY-CFG)', () => {
  it('assertVercelBuildEnv_MissingVariables_ThrowsNamingThemAndTheRunbook', () => {
    expect(() => assertVercelBuildEnv({ vercelEnv: 'preview', demoBuild: false, env: {} })).toThrow(
      /Vercel preview build[\s\S]*- VITE_API_BASE_URL: missing[\s\S]*- VITE_AUTH0_DOMAIN: missing[\s\S]*deploy-checklist\.md/,
    );
  });

  it('assertVercelBuildEnv_CompleteConfiguration_DoesNotThrow', () => {
    expect(() => assertVercelBuildEnv({ vercelEnv: 'production', demoBuild: false, env: COMPLETE })).not.toThrow();
  });
});
