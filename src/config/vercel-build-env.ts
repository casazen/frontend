/**
 * Variables a Vercel build cannot ship without (DEPLOY-CFG, backend `docs/runbooks/deploy-checklist.md`). Pure module
 * without Vite or DOM types: `vite.config.ts` runs it at build time, like `robots-txt.ts` and `demo-build-guard.ts`.
 *
 * Before this check a Preview/Production deployment without `VITE_AUTH0_DOMAIN` or `VITE_AUTH0_CLIENT_ID` was built and
 * published, then threw in the browser (blank page), and one without `VITE_API_BASE_URL` silently called the PRODUCTION
 * API (`src/config/env.config.ts` falls back to it in any production bundle), so a staging deployment wrote to
 * production data. On Vercel (`VERCEL_ENV` preview or production) a missing or invalid value now fails the build: Vercel
 * keeps the previous deployment and the log names the variable. Local and CI builds (no `VERCEL_ENV`) are not affected.
 */

/** Value of `VERCEL_ENV` for which the variables below are required. */
const VERCEL_RELEASE_ENVIRONMENTS = ['preview', 'production'] as const;

export interface VercelBuildEnvInput {
  /** Value of `VERCEL_ENV` on Vercel (`production`, `preview`, `development`), undefined elsewhere. */
  vercelEnv: string | undefined;
  /** True for the demo build (`npm run build:demo`): it opens without Auth0 and calls no API. */
  demoBuild: boolean;
  /** `VITE_*` values seen by Vite (process environment or `.env` files). */
  env: Record<string, string | undefined>;
}

// Bare host name such as `tenant.eu.auth0.com`: no scheme, no path.
const DOMAIN_PATTERN = /^(?=.{4,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
const LOCAL_HOST_PATTERN = /^(localhost|.*\.localhost|127(\.\d{1,3}){3}|0\.0\.0\.0|\[::1?\])$/i;

function readValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function apiBaseUrlProblem(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'is not an absolute URL (https://<backend host>/api)';
  }
  if (url.protocol !== 'https:') return 'must use https';
  if (LOCAL_HOST_PATTERN.test(url.hostname)) return 'points to a local address';
  if (url.search || url.hash) return 'must not have a query string or fragment';
  return null;
}

/** Problems that must stop a Vercel build, one line each, naming the variable and never its value. */
export function findVercelBuildEnvProblems({ vercelEnv, demoBuild, env }: VercelBuildEnvInput): string[] {
  if (demoBuild || !VERCEL_RELEASE_ENVIRONMENTS.includes(vercelEnv as (typeof VERCEL_RELEASE_ENVIRONMENTS)[number])) {
    return [];
  }

  const problems: string[] = [];

  const apiBaseUrl = readValue(env.VITE_API_BASE_URL);
  if (!apiBaseUrl) {
    problems.push(
      'VITE_API_BASE_URL: missing (the bundle would call the production API; set the Railway URL of this Vercel environment, ending with /api)',
    );
  } else {
    const problem = apiBaseUrlProblem(apiBaseUrl);
    if (problem) problems.push(`VITE_API_BASE_URL: ${problem}`);
  }

  const auth0Domain = readValue(env.VITE_AUTH0_DOMAIN);
  if (!auth0Domain) {
    problems.push('VITE_AUTH0_DOMAIN: missing (login domain of the Auth0 tenant of this Vercel environment)');
  } else if (!DOMAIN_PATTERN.test(auth0Domain)) {
    problems.push('VITE_AUTH0_DOMAIN: must be a bare host name such as tenant.eu.auth0.com (no https://, no path)');
  }

  if (!readValue(env.VITE_AUTH0_CLIENT_ID)) {
    problems.push('VITE_AUTH0_CLIENT_ID: missing (SPA client id of the Auth0 tenant of this Vercel environment)');
  }

  return problems;
}

/** Throws, naming every problem, when a Vercel preview or production build lacks its variables. */
export function assertVercelBuildEnv(input: VercelBuildEnvInput): void {
  const problems = findVercelBuildEnvProblems(input);
  if (problems.length === 0) return;

  throw new Error(
    `Vercel ${input.vercelEnv} build with an incomplete configuration:\n${problems.map((line) => `- ${line}`).join('\n')}\n` +
      'Set the variables in Vercel → Settings → Environment Variables for this environment (Preview or Production) and ' +
      'redeploy; see backend docs/runbooks/deploy-checklist.md.',
  );
}
