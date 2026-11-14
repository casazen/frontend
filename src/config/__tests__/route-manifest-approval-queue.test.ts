import { describe, expect, it } from 'vitest';
import { deriveContextsFromRoles, ROLE_PROPERTY_OWNER } from '@/lib/auth-roles';
import { ROUTE_MANIFEST, getNavMatchEntries, hasEntryPermission } from '../route-manifest';

const APPROVAL_QUEUE_PATH = '/app/short-rent/approval-queue';
const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === APPROVAL_QUEUE_PATH);

/** What a user holds: the permissions given, in the area of the short rent. */
const holding =
  (...granted: string[]) =>
  (_context: string, permission: string) =>
    granted.includes(permission);

describe('route manifest: the approval queue (E05/F04/US02, NF-68, AC-NF68-5)', () => {
  it('RouteManifest_ApprovalQueue_NeedsTheDedicatedPermissionToDecideAndNoLongerPropertyWrite', () => {
    expect(entry).toBeDefined();
    expect(entry?.context).toBe('short-rent');
    expect(entry?.requiredPermissions).toEqual(['approval.decide']);
  });

  it('RouteManifest_ApprovalQueue_IsReachableOnlyWithApprovalDecide', () => {
    expect(entry && hasEntryPermission(entry, holding('approval.decide'))).toBe(true);
    // A collaborator holds `property.write` in part (and every read permission) but may not decide: the API refuses it, so the page does not open.
    expect(entry && hasEntryPermission(entry, holding('property.read', 'property.write', 'booking.read', 'booking.write', 'servicerequest.write'))).toBe(false);
    expect(entry && hasEntryPermission(entry, holding())).toBe(false);
  });

  it('RouteManifest_ApprovalQueue_IsATabOfTheCruscottoOnlyForWhoMayDecide', () => {
    // «Da approvare»: a tab of the Cruscotto, which every role opens.
    expect(entry?.navParent).toBe('/app/short-rent');
    const paths = (hasPermission: (context: string, permission: string) => boolean) =>
      getNavMatchEntries('short-rent', hasPermission, undefined).map((page) => page.path);

    expect(paths(holding('approval.decide'))).toContain(APPROVAL_QUEUE_PATH);
    expect(paths(holding('property.read', 'property.write', 'booking.read'))).not.toContain(APPROVAL_QUEUE_PATH);
  });

  it('AuthRoles_PropertyOwnerFromTheTokenAlone_HoldsApprovalDecideLikeTheBackendBootstrap', () => {
    // The permissions of a person whose context comes from the token alone (and of the demo) are the set of the backend bootstrap (`ContextAccessBootstrap`):
    // without `approval.decide` the owner would meet a reserved page where the queue is.
    const shortRent = deriveContextsFromRoles({ roles: [ROLE_PROPERTY_OWNER] }).find((context) => context.contextKey === 'short-rent');

    expect(shortRent?.permissions).toContain('approval.decide');
  });
});
