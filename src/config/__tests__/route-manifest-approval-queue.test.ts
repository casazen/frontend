import { describe, expect, it } from 'vitest';
import { deriveContextsFromRoles, ROLE_PROPERTY_OWNER } from '@/lib/auth-roles';
import { ROUTE_MANIFEST, getNavMatchEntries, hasEntryPermission } from '../route-manifest';

const APPROVAL_QUEUE_PATH = '/app/short-rent/approval-queue';
const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === APPROVAL_QUEUE_PATH);

const holding =
  (...granted: string[]) =>
  (_context: string, permission: string) =>
    granted.includes(permission);

describe('route manifest: the approval queue (E05/F04/US02, NF-68, AC-NF68-5)', () => {
  it('RouteManifest_ApprovalQueue_NeedsTheDedicatedPermissionToDecideAndNoLongerPropertyWrite', () => {
    expect(entry).toBeDefined();
    expect(entry?.context).toBe('short-rent');
    expect(entry?.requiredPermissions).toEqual(['approval.decide', 'marketing.manage']);
  });

  it('RouteManifest_ApprovalQueue_IsReachableOnlyWithApprovalDecide', () => {
    expect(entry && hasEntryPermission(entry, holding('approval.decide'))).toBe(true);
    expect(entry && hasEntryPermission(entry, holding('marketing.manage'))).toBe(true);
    expect(entry && hasEntryPermission(entry, holding('property.read', 'property.write', 'booking.read', 'booking.write', 'servicerequest.write'))).toBe(false);
    expect(entry && hasEntryPermission(entry, holding())).toBe(false);
  });

  it('RouteManifest_ApprovalQueue_IsATabOfTheCruscottoOnlyForWhoMayDecide', () => {
    expect(entry?.navParent).toBe('/app/short-rent');
    const paths = (hasPermission: (context: string, permission: string) => boolean) =>
      getNavMatchEntries('short-rent', hasPermission, undefined).map((page) => page.path);

    expect(paths(holding('approval.decide'))).toContain(APPROVAL_QUEUE_PATH);
    expect(paths(holding('property.read', 'property.write', 'booking.read'))).not.toContain(APPROVAL_QUEUE_PATH);
  });

  it('AuthRoles_PropertyOwnerFromTheTokenAlone_HoldsApprovalDecideLikeTheBackendBootstrap', () => {
    const shortRent = deriveContextsFromRoles({ roles: [ROLE_PROPERTY_OWNER] }).find((context) => context.contextKey === 'short-rent');

    expect(shortRent?.permissions).toContain('approval.decide');
  });
});
