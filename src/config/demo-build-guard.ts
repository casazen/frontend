/**
 * Demo mode build rules (A9-38). Pure module without Vite or DOM types: `vite.config.ts` runs it at build time and
 * `demo.config.ts` reads the mode name at runtime.
 */

/** Vite mode of the demo build (`npm run build:demo` → `vite build --mode demo`). */
export const DEMO_BUILD_MODE = 'demo';

export interface DemoBuildInput {
  /** Vite command: `build` for a bundle, `serve` for the dev server (Playwright, `npm run dev:demo`). */
  command: 'build' | 'serve';
  /** Vite mode (`production` for `npm run build`, `demo` for `npm run build:demo`). */
  mode: string;
  /** Value of `VITE_DEMO_MODE` seen by Vite (process environment or `.env` files). */
  demoFlag: string | undefined;
  /** Value of `VERCEL_ENV` on Vercel (`production`, `preview`, `development`), undefined elsewhere. */
  vercelEnv: string | undefined;
}

/**
 * Checks that a bundle never ships demo mode where it must not, and returns whether demo mode is on.
 *
 * - Dev server: demo mode follows `VITE_DEMO_MODE` (Playwright and `npm run dev:demo`).
 * - `npm run build` (any mode other than `demo`): `VITE_DEMO_MODE=true` fails the build, so a variable leaked
 *   into the Vercel or CI environment can never produce an app that opens without login.
 * - `npm run build:demo`: allowed, except on the Vercel production environment.
 */
export function assertDemoBuildAllowed({ command, mode, demoFlag, vercelEnv }: DemoBuildInput): boolean {
  const demoRequested = demoFlag === 'true';
  if (command !== 'build') return demoRequested;

  if (demoRequested && mode !== DEMO_BUILD_MODE) {
    throw new Error(
      `VITE_DEMO_MODE=true in a normal build (mode "${mode}"): the app would open without login. ` +
        'Remove the variable from this environment, or build the demo with `npm run build:demo`.',
    );
  }

  if (mode === DEMO_BUILD_MODE && !demoRequested) {
    throw new Error('The demo build (mode "demo") needs VITE_DEMO_MODE=true: use `npm run build:demo`.');
  }

  if (mode === DEMO_BUILD_MODE && vercelEnv === 'production') {
    throw new Error('A demo build cannot be deployed to the Vercel production environment.');
  }

  return demoRequested;
}
