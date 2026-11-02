import type { FeatureFlags } from '@/config/feature-flags';
import { getContextNav, type PermissionPredicate, type RouteManifestEntry } from '@/config/route-manifest';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';
import type { OrgRoleInfo } from '@/types/org-team.types';
import { buildAccessPreview, PREVIEW_AREAS, type PreviewArea } from './access-preview-model';

/**
 * The check the menus make for a person, made for a role instead of a login: the permissions the matrix gives the role in each
 * context, which are the same rows `GET /api/me/contexts` sends to the person. The pseudo-permission of the billing page
 * (`org.billing.admin`) is the owner's and the administrator's in the Amministrazione, which has the page; the old plan and billing
 * pages of the rental areas hand these people over to it, so they are not counted there.
 */
export function permissionCheckOfRole(role: OrgRoleInfo): PermissionPredicate {
  return (context, permission) => {
    if (permission === ORG_BILLING_ADMIN_PERMISSION) return context === 'account' && (role.role === 'Owner' || role.role === 'Admin');
    return Object.hasOwn(role.permissionsByContext, context) && role.permissionsByContext[context].permissions.includes(permission);
  };
}

/** What a person finds in one area: whether it can enter, and the pages of its main menu and of «Altro», in menu order. */
export interface AreaMenu {
  area: PreviewArea;
  enters: boolean;
  main: RouteManifestEntry[];
  more: RouteManifestEntry[];
}

/**
 * The menus of the three areas for a person with `role` who works in `areas`: the pages of the route manifest that the role may open,
 * the way the menus themselves decide (`getContextNav`), so that when a page is added to the app the preview shows it by itself. An
 * area the person cannot enter has no pages: a rental area it was not given, or the Amministrazione when the role has none.
 */
export function buildAreaMenus(role: OrgRoleInfo, areas: readonly string[], features?: Partial<FeatureFlags>): AreaMenu[] {
  const { enters } = buildAccessPreview(role, areas);
  const check = permissionCheckOfRole(role);

  return PREVIEW_AREAS.map((area) => {
    if (!enters.includes(area)) return { area, enters: false, main: [], more: [] };
    const nav = getContextNav(area, check, features);
    return { area, enters: true, main: nav.sections.flatMap((section) => section.entries), more: nav.more };
  });
}
