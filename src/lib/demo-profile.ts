import { getDemoProfileKey, type ExtendedDemoProfile } from '@/config/demo.config';
import type { Org, RentalType, UserDetail, UserRole } from '@/types';

const DEMO_TIMESTAMP = '2026-01-01T00:00:00Z';

const DEMO_HOST_ORG: Org = {
  id: '00000000-0000-4000-8000-0000000000d1',
  name: 'CasaZen Demo',
  slug: 'casazen-demo',
  planTier: 'Starter',
};

const DEMO_SUPPLIER_ORG: Org = {
  id: '00000000-0000-4000-8000-0000000000d2',
  name: 'CasaZen Demo Servizi',
  slug: 'casazen-demo-servizi',
  planTier: 'Starter',
};

interface DemoPersonaProfile {
  role: UserRole;
  rentalType: RentalType | null;
  org: Org | null;
  onboarded: boolean;
}

const PERSONA_PROFILES: Record<ExtendedDemoProfile, DemoPersonaProfile> = {
  'short-stay': { role: 'PropertyOwner', rentalType: 'ShortTerm', org: DEMO_HOST_ORG, onboarded: true },
  'long-term': { role: 'LongTermLandlord', rentalType: 'LongTerm', org: DEMO_HOST_ORG, onboarded: true },
  dual: { role: 'PropertyOwner', rentalType: 'Both', org: DEMO_HOST_ORG, onboarded: true },
  triple: { role: 'Admin', rentalType: 'Both', org: DEMO_HOST_ORG, onboarded: true },
  // A platform admin has no host org: the guard lets it through to the admin routes (A1-01).
  admin: { role: 'Admin', rentalType: null, org: null, onboarded: false },
  supplier: { role: 'Supplier', rentalType: null, org: DEMO_SUPPLIER_ORG, onboarded: true },
  // New user: no org and no completed onboarding, so the guard opens the wizard.
  onboarding: { role: 'PropertyOwner', rentalType: null, org: null, onboarded: false },
};

/** The `/users/me` profile of a demo persona: org and onboarding state follow the persona. */
export function buildDemoProfile(persona: ExtendedDemoProfile): UserDetail {
  const { role, rentalType, org, onboarded } = PERSONA_PROFILES[persona];
  return {
    id: `demo|${persona}`,
    email: 'demo@casazen.com',
    firstName: 'Demo',
    lastName: 'User',
    role,
    rentalType,
    isActive: true,
    createdAt: DEMO_TIMESTAMP,
    updatedAt: DEMO_TIMESTAMP,
    onboardingCompletedAt: onboarded ? DEMO_TIMESTAMP : null,
    orgId: org?.id ?? null,
    org,
  };
}

/** Profile of the current demo persona (`?demoProfile=`, session, or `VITE_DEMO_PROFILE`). */
export function getDemoProfile(href?: string): UserDetail {
  return buildDemoProfile(getDemoProfileKey(href));
}
