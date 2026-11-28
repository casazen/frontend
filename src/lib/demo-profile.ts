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
  admin: { role: 'Admin', rentalType: null, org: null, onboarded: false },
  supplier: { role: 'Supplier', rentalType: null, org: DEMO_SUPPLIER_ORG, onboarded: true },
  onboarding: { role: 'PropertyOwner', rentalType: null, org: null, onboarded: false },
};

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

export function getDemoProfile(href?: string): UserDetail {
  return buildDemoProfile(getDemoProfileKey(href));
}
