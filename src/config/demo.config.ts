import { DEMO_BUILD_MODE } from './demo-build-guard';

/**
 * Demo mode configuration
 * When VITE_DEMO_MODE is true, the app runs without authentication.
 *
 * Only on the dev server (`npm run dev:demo`, Playwright) or in a bundle built with `npm run build:demo`
 * (Vite mode `demo`): a normal production build never runs in demo mode, and `vite.config.ts` fails such a build
 * when VITE_DEMO_MODE=true leaks into its environment (A9-38).
 *
 * VITE_DEMO_PROFILE selects the persona for E2E and local testing:
 * - short-stay: PropertyOwner only
 * - long-term: LongTermLandlord only (default)
 * - dual: both roles (layer switcher)
 */
export const isDemoMode =
  import.meta.env.VITE_DEMO_MODE === 'true' &&
  (import.meta.env.DEV || import.meta.env.MODE === DEMO_BUILD_MODE);

export type DemoProfile = 'short-stay' | 'long-term' | 'dual' | 'onboarding';
export type ExtendedDemoProfile = DemoProfile | 'admin' | 'triple' | 'supplier';

const ROLES_CLAIM = 'https://casazen.app/roles';

const demoProfiles: Record<ExtendedDemoProfile, { roles: string[] }> = {
  'short-stay': {
    roles: ['PropertyOwner'],
  },
  'long-term': {
    roles: ['LongTermLandlord'],
  },
  admin: {
    roles: ['Admin'],
  },
  dual: {
    roles: ['PropertyOwner', 'LongTermLandlord'],
  },
  onboarding: {
    roles: [],
  },
  triple: {
    roles: ['PropertyOwner', 'LongTermLandlord', 'Admin'],
  },
  supplier: {
    roles: ['Supplier'],
  },
};

function resolveDemoProfile(): ExtendedDemoProfile {
  const raw = import.meta.env.VITE_DEMO_PROFILE as string | undefined;
  if (raw && raw in demoProfiles) {
    return raw as ExtendedDemoProfile;
  }
  return 'long-term';
}

function buildDemoUser(profile: ExtendedDemoProfile) {
  const roles = demoProfiles[profile].roles;
  return {
    name: 'Demo User',
    email: 'demo@casazen.com',
    picture: 'https://ui-avatars.com/api/?name=Demo+User&background=0D8ABC&color=fff',
    roles,
    [ROLES_CLAIM]: roles,
  };
}

const DEMO_PROFILE_STORAGE_KEY = 'casazen:demo-profile';

function resolveRuntimeDemoProfile(href?: string): ExtendedDemoProfile | null {
  if (typeof window === 'undefined') return null;

  const params = new URL(href ?? window.location.href).searchParams;
  const fromQuery = params.get('demoProfile');
  if (fromQuery && fromQuery in demoProfiles) {
    sessionStorage.setItem(DEMO_PROFILE_STORAGE_KEY, fromQuery);
    return fromQuery as ExtendedDemoProfile;
  }

  const stored = sessionStorage.getItem(DEMO_PROFILE_STORAGE_KEY);
  if (stored && stored in demoProfiles) {
    return stored as ExtendedDemoProfile;
  }

  const runtime = (window as Window & { __E2E_DEMO_PROFILE?: ExtendedDemoProfile }).__E2E_DEMO_PROFILE;
  if (runtime && runtime in demoProfiles) {
    return runtime;
  }

  return null;
}

/**
 * Demo persona key: `?demoProfile=` query (E2E), `window.__E2E_DEMO_PROFILE`, or `VITE_DEMO_PROFILE`.
 * `href` is the URL whose query is read (default: the current location).
 */
export function getDemoProfileKey(href?: string): ExtendedDemoProfile {
  return resolveRuntimeDemoProfile(href) ?? resolveDemoProfile();
}

/** Demo user (name, roles) of the current persona, see {@link getDemoProfileKey}. */
export function getDemoUser(href?: string) {
  return buildDemoUser(getDemoProfileKey(href));
}

export const demoUser = buildDemoUser(resolveDemoProfile());
