/**
 * Demo mode configuration
 * When VITE_DEMO_MODE is true, the app runs without authentication.
 *
 * VITE_DEMO_PROFILE selects the persona for E2E and local testing:
 * - short-stay: PropertyOwner only
 * - long-term: LongTermLandlord only (default)
 * - dual: both roles (layer switcher)
 */
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export type DemoProfile = 'short-stay' | 'long-term' | 'dual';

const ROLES_CLAIM = 'https://casazen.app/roles';

const demoProfiles: Record<DemoProfile, { roles: string[] }> = {
  'short-stay': {
    roles: ['PropertyOwner'],
  },
  'long-term': {
    roles: ['LongTermLandlord'],
  },
  dual: {
    roles: ['PropertyOwner', 'LongTermLandlord'],
  },
};

function resolveDemoProfile(): DemoProfile {
  const raw = import.meta.env.VITE_DEMO_PROFILE as string | undefined;
  if (raw === 'short-stay' || raw === 'long-term' || raw === 'dual') {
    return raw;
  }
  return 'long-term';
}

function buildDemoUser(profile: DemoProfile) {
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

function resolveRuntimeDemoProfile(): DemoProfile | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('demoProfile');
  if (fromQuery === 'short-stay' || fromQuery === 'long-term' || fromQuery === 'dual') {
    sessionStorage.setItem(DEMO_PROFILE_STORAGE_KEY, fromQuery);
    return fromQuery;
  }

  const stored = sessionStorage.getItem(DEMO_PROFILE_STORAGE_KEY);
  if (stored === 'short-stay' || stored === 'long-term' || stored === 'dual') {
    return stored;
  }

  const runtime = (window as Window & { __E2E_DEMO_PROFILE?: DemoProfile }).__E2E_DEMO_PROFILE;
  if (runtime && runtime in demoProfiles) {
    return runtime;
  }

  return null;
}

/** Demo persona: `?demoProfile=` query (E2E), `window.__E2E_DEMO_PROFILE`, or `VITE_DEMO_PROFILE`. */
export function getDemoUser() {
  const runtime = resolveRuntimeDemoProfile();
  return buildDemoUser(runtime ?? resolveDemoProfile());
}

export const demoUser = buildDemoUser(resolveDemoProfile());

console.log('🎭 Demo mode:', isDemoMode ? 'ENABLED' : 'DISABLED');
if (isDemoMode) {
  const profile = resolveDemoProfile();
  console.log('🎭 Demo profile:', profile, demoProfiles[profile].roles);
}
