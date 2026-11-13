import { describe, expect, it } from 'vitest';
import { deriveContextsFromRoles, ROLE_PROPERTY_OWNER } from '@/lib/auth-roles';
import { ROUTE_MANIFEST, hasEntryPermission } from '../route-manifest';

const VERIFICATIONS_PATH = '/app/short-rent/verifications';
const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === VERIFICATIONS_PATH);

/** What a user holds: the permissions given, in the area of the short rent. */
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
    // A collaborator holds the reads and part of the writes but may not decide: the API refuses it, so the page does not open.
    expect(entry && hasEntryPermission(entry, holding('property.read', 'property.write', 'booking.read', 'booking.write', 'approval.decide'))).toBe(false);
    // The key the manifest asked before the backend named it is no key at all: it opens nothing.
    expect(entry && hasEntryPermission(entry, holding('verification.decide'))).toBe(false);
    expect(entry && hasEntryPermission(entry, holding())).toBe(false);
  });

  it('AuthRoles_PropertyOwnerFromTheTokenAlone_HoldsVerificationDecisionLikeTheBackendBootstrap', () => {
    // The permissions of a person whose context comes from the token alone (and of the demo) are the set of the backend bootstrap (`ContextAccessBootstrap`):
    // without `verification.decision` the owner would meet a reserved page where the console of the verifications is.
    const shortRent = deriveContextsFromRoles({ roles: [ROLE_PROPERTY_OWNER] }).find((context) => context.contextKey === 'short-rent');

    expect(shortRent?.permissions).toContain('verification.decision');
    expect(entry && hasEntryPermission(entry, holding(...(shortRent?.permissions ?? [])))).toBe(true);
  });
});
