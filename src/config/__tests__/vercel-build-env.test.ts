import { describe, expect, it } from 'vitest';
import { assertVercelBuildEnv, findVercelBuildEnvProblems } from '../vercel-build-env';

const COMPLETE = {
  VITE_API_BASE_URL: 'https://backend.example.test/api',
  VITE_AUTH0_DOMAIN: 'tenant.eu.auth0.com',
  VITE_AUTH0_CLIENT_ID: 'spa-client-id',
  VITE_AUTH0_AUDIENCE: 'https://api.example.test',
  VITE_LEGAL_NAME: 'Esempio S.r.l.',
  VITE_LEGAL_VAT_ID: '01234567890',
};

function withoutCompanyData(): Record<string, string> {
  const env: Record<string, string> = { ...COMPLETE };
  delete env.VITE_LEGAL_NAME;
  delete env.VITE_LEGAL_VAT_ID;
  return env;
}

describe('findVercelBuildEnvProblems (DEPLOY-CFG)', () => {
  it.each(['preview', 'production'])('findVercelBuildEnvProblems_%sWithEveryVariable_ReturnsNoProblem', (vercelEnv) => {
    expect(findVercelBuildEnvProblems({ vercelEnv, demoBuild: false, env: COMPLETE })).toEqual([]);
  });

  it.each([['development'], [undefined]])(
    'findVercelBuildEnvProblems_NotAVercelReleaseEnvironment_%s_DoesNotRequireAnything',
    (vercelEnv) => {
      expect(findVercelBuildEnvProblems({ vercelEnv, demoBuild: false, env: {} })).toEqual([]);
    },
  );

  it('findVercelBuildEnvProblems_DemoBuild_DoesNotRequireAnything', () => {
    expect(findVercelBuildEnvProblems({ vercelEnv: 'preview', demoBuild: true, env: {} })).toEqual([]);
  });

  it('findVercelBuildEnvProblems_PreviewWithoutAnyVariable_NamesEveryOne', () => {
    const problems = findVercelBuildEnvProblems({ vercelEnv: 'preview', demoBuild: false, env: {} });

    expect(problems).toHaveLength(4);
    expect(problems[0]).toMatch(/^VITE_API_BASE_URL: missing.*production API/);
    expect(problems[1]).toMatch(/^VITE_AUTH0_DOMAIN: missing/);
    expect(problems[2]).toMatch(/^VITE_AUTH0_CLIENT_ID: missing/);
    expect(problems[3]).toMatch(/^VITE_AUTH0_AUDIENCE: missing/);
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

  it.each(['production', 'preview'])('findVercelBuildEnvProblems_%sWithoutCompanyData_IsNotAProblem', (vercelEnv) => {
    expect(findVercelBuildEnvProblems({ vercelEnv, demoBuild: false, env: withoutCompanyData() })).toEqual([]);
  });

  describe('publishing the public site without a partita IVA', () => {
    const chosen = { ...withoutCompanyData(), VITE_PUBLIC_SITE_WITHOUT_VAT_ID: 'true' };

    it('findVercelBuildEnvProblems_productionWithTheChoiceButNoHolder_NamesNameAndContact', () => {
      expect(findVercelBuildEnvProblems({ vercelEnv: 'production', demoBuild: false, env: chosen })).toEqual([
        expect.stringMatching(/^VITE_LEGAL_NAME: missing/),
        expect.stringMatching(/^VITE_SUPPORT_EMAIL: missing/),
      ]);
    });

    it('findVercelBuildEnvProblems_productionWithTheChoiceAndTheHolder_IsAccepted', () => {
      const env = { ...chosen, VITE_LEGAL_NAME: 'Mario Rossi', VITE_SUPPORT_EMAIL: 'info@example.com' };
      expect(findVercelBuildEnvProblems({ vercelEnv: 'production', demoBuild: false, env })).toEqual([]);
    });

    it('findVercelBuildEnvProblems_previewWithTheChoiceButNoHolder_IsNotAProblem', () => {
      expect(findVercelBuildEnvProblems({ vercelEnv: 'preview', demoBuild: false, env: chosen })).toEqual([]);
    });

    it.each(['yes', '1', 'ttrue'])('findVercelBuildEnvProblems_choice_%s_IsAProblem', (value) => {
      const env = { ...withoutCompanyData(), VITE_PUBLIC_SITE_WITHOUT_VAT_ID: value };
      expect(findVercelBuildEnvProblems({ vercelEnv: 'preview', demoBuild: false, env })).toEqual([
        expect.stringMatching(/^VITE_PUBLIC_SITE_WITHOUT_VAT_ID: must be true or false/),
      ]);
    });
  });

  it.each(['IT 0123456789', '0123456789X', 'DE123456789'])(
    'findVercelBuildEnvProblems_ProductionWithInvalidPartitaIva_%s_IsAProblem',
    (value) => {
      const problems = findVercelBuildEnvProblems({
        vercelEnv: 'production',
        demoBuild: false,
        env: { ...COMPLETE, VITE_LEGAL_VAT_ID: value },
      });
      expect(problems).toEqual([expect.stringMatching(/^VITE_LEGAL_VAT_ID: must be an Italian partita IVA/)]);
    },
  );

  it.each(['01234567890', 'IT01234567890', 'it 012 345 678 90'])(
    'findVercelBuildEnvProblems_ProductionWithPartitaIva_%s_IsAccepted',
    (value) => {
      expect(
        findVercelBuildEnvProblems({ vercelEnv: 'production', demoBuild: false, env: { ...COMPLETE, VITE_LEGAL_VAT_ID: value } }),
      ).toEqual([]);
    },
  );

  it.each(['preview', 'production'])('findVercelBuildEnvProblems_%sWithoutAudience_NamesIt', (vercelEnv) => {
    // Preview and Production can share one Auth0 tenant: the audience is what separates the two backends, and the code
    // default is the production one, so a missing value must stop the build.
    const env: Record<string, string> = { ...COMPLETE };
    delete env.VITE_AUTH0_AUDIENCE;

    expect(findVercelBuildEnvProblems({ vercelEnv, demoBuild: false, env })).toEqual([
      expect.stringMatching(/^VITE_AUTH0_AUDIENCE: missing/),
    ]);
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
