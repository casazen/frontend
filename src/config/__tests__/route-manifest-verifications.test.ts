import { describe, expect, it } from 'vitest';
import { deriveContextsFromRoles, ROLE_PROPERTY_OWNER } from '@/lib/auth-roles';
import { ROUTE_MANIFEST, hasEntryPermission } from '../route-manifest';

const VERIFICATIONS_PATH = '/app/short-rent/verifications';
const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === VERIFICATIONS_PATH);

const holding =
  (...granted: string[]) =>
  (_context: string, permission: string) =>
    granted.includes(permission);

describe('route manifest: the console of the identity verifications (E03/F04/US03/T02, AC-NF24-3)', () => {
  it('RouteManifest_Verifications_NeedsThePermissionTheApiNeedsForEveryCallOfTheQueue', () => {
    expect(entry).toBeDefined();
    expect(entry?.context).toBe('short-rent');
    expect(entry?.requiredPermissions).toEqual(['verification.decision']);
  });

  it('RouteManifest_Verifications_IsReachableOnlyWithVerificationDecision', () => {
    expect(entry && hasEntryPermission(entry, holding('verification.decision'))).toBe(true);
    expect(entry && hasEntryPermission(entry, holding('property.read', 'property.write', 'booking.read', 'booking.write', 'approval.decide'))).toBe(false);
    expect(entry && hasEntryPermission(entry, holding('verification.decide'))).toBe(false);
    expect(entry && hasEntryPermission(entry, holding())).toBe(false);
  });

  it('AuthRoles_PropertyOwnerFromTheTokenAlone_HoldsVerificationDecisionLikeTheBackendBootstrap', () => {
    const shortRent = deriveContextsFromRoles({ roles: [ROLE_PROPERTY_OWNER] }).find((context) => context.contextKey === 'short-rent');

    expect(shortRent?.permissions).toContain('verification.decision');
    expect(entry && hasEntryPermission(entry, holding(...(shortRent?.permissions ?? [])))).toBe(true);
  });
});
