import { describe, it, expect } from 'vitest';
import {
  MAX_BOTTOM_NAV_ENTRIES,
  MAX_PRIMARY_NAV_ENTRIES,
  ROUTE_MANIFEST,
  getBottomNavEntries,
  getContextNav,
  getNavChildren,
  getNavMatchEntries,
  getNavSection,
  getOrgBillingPageAlternates,
  getPrimaryNavEntries,
  getSecondaryNavEntries,
  getVisibleNavEntries,
  hasEntryPermission,
  isEntryFeatureEnabled,
  type AppContextKey,
  type PermissionPredicate,
  type RouteManifestEntry,
} from '../route-manifest';
import { DEFAULT_FEATURE_FLAGS, parseFeatureFlags, type FeatureFlags } from '../feature-flags';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';
import { NAV_ICONS } from '@/lib/nav-icons';
import { resolveActiveNavEntry } from '@/lib/nav-active';
import { planPagePath, billingPagePath } from '@/lib/billing-routes';
import { profilePathForContext } from '@/lib/profile-path';

const CONTEXTS: AppContextKey[] = ['short-rent', 'long-rent', 'supplier', 'admin'];

const allowAll = () => true;
const notBillingAdmin: PermissionPredicate = (_ctx, permission) => permission !== ORG_BILLING_ADMIN_PERMISSION;
const without = (...denied: string[]): PermissionPredicate => (_ctx, permission) => !denied.includes(permission);
const paths = (entries: RouteManifestEntry[]) => entries.map((entry) => entry.path);
const entryOf = (path: string) => {
  const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === path);
  if (!entry) throw new Error(`no manifest entry for ${path}`);
  return entry;
};

/** Every way of being a user of an area for the invariants: all the permissions, none, each one taken away; flags on and off. */
function userVariants(contextKey: AppContextKey) {
  const permissions = new Set<string>();
  for (const entry of ROUTE_MANIFEST.filter((candidate) => candidate.context === contextKey)) {
    entry.requiredPermissions.forEach((permission) => permissions.add(permission));
    if (entry.orgBillingAdmin) permissions.add(ORG_BILLING_ADMIN_PERMISSION);
  }
  const predicates: [string, PermissionPredicate][] = [
    ['everything', allowAll],
    ['nothing', (_ctx, permission) => !permission],
    ...[...permissions].map((permission): [string, PermissionPredicate] => [`everything but ${permission}`, without(permission)]),
  ];
  const flagSets: [string, Partial<FeatureFlags>][] = [
    ['flags off', {}],
    ['otaPartnerApi on', { otaPartnerApi: true }],
    ['agencyTier on', { agencyTier: true }],
    ['crmMarketing on', { crmMarketing: true }],
  ];
  return predicates.flatMap(([userLabel, hasPermission]) =>
    flagSets.map(([flagLabel, features]) => ({ label: `${userLabel}, ${flagLabel}`, hasPermission, features })),
  );
}

describe('route-manifest main menu (UI-04a)', () => {
  it('returns the primary short-rent entries in order, eight at most, the adempimenti among them', () => {
    const primary = getPrimaryNavEntries('short-rent', allowAll);
    expect(paths(primary)).toEqual([
      '/app/short-rent',
      '/app/short-rent/bookings/calendar',
      '/app/short-rent/bookings',
      '/app/short-rent/compliance',
      '/app/short-rent/properties',
      '/app/short-rent/vetrina',
      '/app/short-rent/marketplace',
      '/app/short-rent/payments',
    ]);
    expect(primary).toHaveLength(8);
    expect(primary.length).toBeLessThanOrEqual(MAX_PRIMARY_NAV_ENTRIES);
  });

  it('shows the risk of a sanction on the adempimenti entry and asks the permission of the summary it reads', () => {
    const compliance = entryOf('/app/short-rent/compliance');
    expect(compliance.navCount).toBe('compliance');
    // `GET api/compliance/summary` is `booking.read`: an entry the user opens must not end on a 403.
    expect(compliance.requiredPermissions).toEqual(expect.arrayContaining(['property.read', 'booking.read']));
    expect(paths(getPrimaryNavEntries('short-rent', without('booking.read')))).not.toContain('/app/short-rent/compliance');
  });

  it('keeps "Altro" of short-rent to four entries: the other pages are the tabs of the entry they belong to', () => {
    // It held sixteen. Profilo is in the menu of the user, the rest hangs from an entry of the main menu (see the sections below). The
    // To do list (NF-07) is the last of them: the main menu has its eight entries.
    const expected = [
      '/app/short-rent/approval-queue',
      '/app/short-rent/settings/organization',
      '/app/short-rent/settings/invitations',
      '/app/short-rent/activities',
    ];
    expect(paths(getSecondaryNavEntries('short-rent', allowAll))).toEqual(expected);
    // The OTA channels, behind their flag, are a tab of Immobili: the flag does not add an entry to "Altro".
    expect(paths(getSecondaryNavEntries('short-rent', allowAll, { otaPartnerApi: true }))).toEqual(expected);
  });

  it('keeps the long-rent, supplier and staff menus to the pages they have', () => {
    expect(paths(getPrimaryNavEntries('long-rent', allowAll))).toEqual([
      '/app/long-rent',
      '/app/long-rent/properties',
      '/app/long-rent/service-requests',
    ]);
    // Area-wide tenant, deadline and fiscal pages remain in Altro. Canoni open from a contract.
    // Conto SEPA is with the settings. Profilo is in the menu of the user.
    expect(paths(getSecondaryNavEntries('long-rent', allowAll))).toEqual([
      '/app/long-rent/tenants',
      '/app/long-rent/deadlines',
      '/app/long-rent/fiscal',
      '/app/long-rent/settings/organization',
      '/app/long-rent/settings/invitations',
      '/app/long-rent/payments',
    ]);

    // The menu of the supplier is built page by page up to seven entries (Home, Richieste, Agenda e disponibilità, Servizi e
    // prezzi, Il mio sito vetrina, Clienti, Impostazioni, SP-D1): each task adds its own, the ceiling above keeps the count.
    expect(paths(getPrimaryNavEntries('supplier', allowAll))).toEqual([
      '/app/supplier/dashboard',
      '/app/supplier/inbox',
      '/app/supplier/availability',
      '/app/supplier/services',
      '/app/supplier/showcase',
      '/app/supplier/clients',
      '/app/supplier/settings',
    ]);
    expect(paths(getSecondaryNavEntries('supplier', allowAll))).toEqual([
      '/app/supplier/profile',
      '/app/supplier/help/ical',
    ]);

    // Staff: the compliance audit stands for the three compliance pages; Marketing (SE-03) sits with SEO.
    expect(paths(getPrimaryNavEntries('admin', allowAll))).toEqual([
      '/app/admin',
      '/app/admin/users',
      '/app/admin/suppliers',
      '/app/admin/jobs',
      '/app/admin/seo',
      '/app/admin/marketing',
      '/app/admin/cin',
    ]);
    expect(paths(getSecondaryNavEntries('admin', allowAll))).toEqual([
      '/app/admin/suppliers/invite',
      '/app/admin/invite-qr',
      '/app/admin/ai',
      '/app/admin/demo',
      '/app/admin/profile',
    ]);
  });

  // The pages of the agency plan read endpoints that answer only an org on that plan (ADR-010): shown to everyone, their first read
  // answered 403 and the whole app went to the no-access page («Nessun accesso disponibile… Accedi di nuovo»).
  const AGENCY_PAGES: [AppContextKey, string][] = [
    ['short-rent', '/app/short-rent/trusted-suppliers'],
    ['account', '/app/account/withholding'],
    ['account', '/app/account/wire-transfers'],
    ['admin', '/app/admin/statements'],
    ['admin', '/app/admin/activities'],
  ];

  it.each(AGENCY_PAGES)('%s: keeps %s out of the menus while the agencyTier flag is off', (contextKey, path) => {
    expect(entryOf(path).featureFlag).toBe('agencyTier');
    expect(isEntryFeatureEnabled(entryOf(path), {})).toBe(false);
    // In the menus, or hanging from an entry of them (the trusted suppliers are a tab of Immobili since the sections are tabs).
    const reachable = (features: Partial<FeatureFlags>) => paths(getNavMatchEntries(contextKey, allowAll, features));
    for (const features of [{}, { agencyTier: false }, { otaPartnerApi: true }]) {
      expect(paths(getVisibleNavEntries(contextKey, allowAll, features))).not.toContain(path);
      expect(reachable(features)).not.toContain(path);
    }
    expect(reachable({ agencyTier: true })).toContain(path);
  });

  it.each(CONTEXTS)('%s: at most seven primary entries for every role and flag', (contextKey) => {
    for (const { label, hasPermission, features } of userVariants(contextKey)) {
      const primary = getPrimaryNavEntries(contextKey, hasPermission, features);
      expect(primary.length, `${contextKey} for ${label}`).toBeLessThanOrEqual(MAX_PRIMARY_NAV_ENTRIES);
    }
  });

  it.each(CONTEXTS)('%s: the primary entries have a group and the groups are not interleaved', (contextKey) => {
    for (const { label, hasPermission, features } of userVariants(contextKey)) {
      const groups = getPrimaryNavEntries(contextKey, hasPermission, features).map((entry) => entry.navGroup);
      expect(groups.every((group) => group !== undefined), `${contextKey} for ${label}`).toBe(true);
      const firstSeen = [...new Set(groups)];
      // `a a b b` is fine, `a b a` is not: a group is one run of entries.
      expect(groups.join('|'), `${contextKey} for ${label}`).toBe(
        firstSeen.flatMap((group) => groups.filter((candidate) => candidate === group)).join('|'),
      );
    }
  });

  it('lists the sections of the sidebar and "Altro" from the same entries', () => {
    const nav = getContextNav('short-rent', allowAll, { otaPartnerApi: true });
    expect(nav.sections.map((section) => section.group)).toEqual(['everyday', 'offer', 'management']);
    expect(nav.sections.map((section) => section.entries.length)).toEqual([4, 3, 1]);
    expect(paths(nav.more)).toEqual(paths(getSecondaryNavEntries('short-rent', allowAll, { otaPartnerApi: true })));
  });

  it('keeps every menu entry labelled and with an icon of the table', () => {
    for (const entry of ROUTE_MANIFEST.filter((candidate) => candidate.navPlacement || candidate.navParent)) {
      expect(entry.navKey ?? entry.navLabel, entry.path).toBeTruthy();
      // An unknown icon name quietly falls back to the dashboard one.
      expect(NAV_ICONS[entry.icon ?? ''], `${entry.path} icon ${entry.icon}`).toBeDefined();
    }
  });

  it('gives a counter only to the entries whose number is already read by the app', () => {
    const counted = ROUTE_MANIFEST.filter((entry) => entry.navCount).map((entry) => [entry.path, entry.navCount]);
    expect(counted).toEqual([
      // The risk of a sanction (the Alloggiati Web communications and the guest data they need), from the summary of the cockpit.
      ['/app/short-rent/compliance', 'compliance'],
      // The urgent items of the To do list (NF-07, ADR-026-R12), from `GET api/me/activities/count`.
      ['/app/short-rent/activities', 'activities'],
      ['/app/short-rent/bookings', 'bookingRequests'],
      // The messages of the guests not read yet (NF-61), from `GET api/messages/unread?includeOta=true`: on its tab of Prenotazioni.
      ['/app/short-rent/messages', 'messages'],
      ['/app/supplier/inbox', 'supplierRequests'],
    ]);
  });
});

describe('route-manifest bottom bar (UI-04a, drawn by UI-04b)', () => {
  it('names the four destinations of the phone bar for short-rent', () => {
    expect(paths(getBottomNavEntries('short-rent', allowAll))).toEqual([
      '/app/short-rent',
      '/app/short-rent/bookings/calendar',
      '/app/short-rent/bookings',
      '/app/short-rent/properties',
    ]);
  });

  it.each(CONTEXTS)('%s: at most four destinations, in order, all of them in the main menu', (contextKey) => {
    for (const { label, hasPermission, features } of userVariants(contextKey)) {
      const bottom = getBottomNavEntries(contextKey, hasPermission, features);
      expect(bottom.length, `${contextKey} for ${label}`).toBeLessThanOrEqual(MAX_BOTTOM_NAV_ENTRIES);
      expect(bottom.every((entry) => entry.navPlacement === 'primary'), `${contextKey} for ${label}`).toBe(true);
    }
    const places = ROUTE_MANIFEST.filter((entry) => entry.context === contextKey && entry.navBottom !== undefined).map(
      (entry) => entry.navBottom,
    );
    expect(places.sort()).toEqual(places.map((_, index) => index + 1));
  });

  it('leaves a destination out when the user cannot open it', () => {
    const bottom = getBottomNavEntries('short-rent', without('property.read'));
    expect(paths(bottom)).not.toContain('/app/short-rent/properties');
    expect(paths(bottom)).toContain('/app/short-rent');
  });

  it('keeps what the bar does not list in the phone menu', () => {
    const nav = getContextNav('short-rent', allowAll, {}, { withoutBottom: true });
    expect(nav.sections.flatMap((section) => paths(section.entries))).toEqual([
      '/app/short-rent/compliance',
      '/app/short-rent/vetrina',
      '/app/short-rent/marketplace',
      '/app/short-rent/payments',
    ]);
    // Profilo is not here: the menu of the user (header, sheet of the phone) leads to it.
    expect(paths(nav.more)).toEqual([
      '/app/short-rent/approval-queue',
      '/app/short-rent/settings/organization',
      '/app/short-rent/settings/invitations',
      '/app/short-rent/activities',
    ]);
  });
});

describe('route-manifest pages that hang from a menu entry (UI-04a)', () => {
  const hanging = ROUTE_MANIFEST.filter((entry) => entry.navParent);

  // The sections of the menus: an entry and, in tab order, the pages that hang from it. This is what keeps "Altro" short.
  const SECTIONS: Record<string, string[]> = {
    // The CRM is no tab of Prenotazioni any more: it is an entry of "Altro" behind its flag (below), and no page hangs from it yet.
    // Messaggi (NF-61) is the first tab after the bookings, then the guests and the reviews.
    '/app/short-rent/bookings': ['/app/short-rent/messages', '/app/short-rent/guests', '/app/short-rent/reviews'],
    '/app/short-rent/compliance': [
      '/app/short-rent/alloggiati',
      '/app/short-rent/alloggiati/reports',
      '/app/short-rent/compliance/cin',
      '/app/short-rent/compliance/identification',
    ],
    '/app/short-rent/properties': [
      '/app/short-rent/interventions',
      '/app/short-rent/trusted-suppliers',
      '/app/short-rent/channels',
      '/app/short-rent/ota',
    ],
    '/app/short-rent/vetrina': [
      '/app/short-rent/settings/site-appearance',
      '/app/short-rent/settings/site-documents',
      '/app/short-rent/settings/domain',
    ],
    '/app/short-rent/payments': [
      '/app/short-rent/payments/revenue',
      '/app/short-rent/reports',
      '/app/short-rent/fiscal',
      '/app/short-rent/settings/payments',
    ],
    '/app/short-rent/approval-queue': ['/app/short-rent/verifications'],
    // Profilo is in no menu (the menu of the user leads to it): Notifiche is its second tab.
    '/app/short-rent/profile': ['/app/short-rent/profile/notifications'],
    '/app/long-rent/leases': ['/app/long-rent/tenants', '/app/long-rent/deadlines', '/app/long-rent/fiscal'],
    '/app/admin/cin': ['/app/admin/compliance/tax-rates', '/app/admin/compliance/ltr-reference-data'],
    '/app/supplier/availability': ['/app/supplier/calendar'],
    '/app/supplier/settings': ['/app/supplier/earnings'],
  };
  const EVERY_FLAG: Partial<FeatureFlags> = { otaPartnerApi: true, supplierOnlinePayments: true, agencyTier: true, crmMarketing: true };

  it('lists the pages of each section in tab order, and no other page hangs', () => {
    for (const [parent, pages] of Object.entries(SECTIONS)) {
      expect(paths(getNavChildren(parent, allowAll, EVERY_FLAG)), parent).toEqual(pages);
    }
    expect(hanging.map((entry) => entry.path).sort()).toEqual(Object.values(SECTIONS).flat().sort());
  });

  it('hangs only from an entry of the menus of the same area, and never from another page that hangs', () => {
    for (const entry of hanging) {
      const parent = entryOf(entry.navParent!);
      expect(parent.context, entry.path).toBe(entry.context);
      if (parent.path === profilePathForContext(parent.context)) {
        // The one parent that is in no menu: the profile of the area, which the menu of the user leads to (below). Its pages are tabs of it.
        expect(parent.navPlacement, `${entry.path} hangs from ${parent.path}`).toBeUndefined();
        expect(parent.requiredPermissions, `${entry.path} hangs from ${parent.path}`).toEqual([]);
      } else if (parent.path === '/app/long-rent/leases') {
        // The legacy contract section stays routable; its area-wide pages move to Altro.
        expect(parent.navPlacement).toBeUndefined();
        expect(paths(getSecondaryNavEntries('long-rent', allowAll))).toContain(entry.path);
      } else {
        expect(parent.navPlacement, `${entry.path} hangs from ${parent.path}`).toBeDefined();
      }
      expect(parent.navParent, `${entry.path} hangs from ${parent.path}`).toBeUndefined();
      // A page that hangs is in no menu and has no place in the bar of its own. A counter it may have, and it is on its tab (`NavSectionTabs`):
      // the messages not read yet on «Messaggi».
      expect(entry.navPlacement, entry.path).toBeUndefined();
      expect(entry.navGroup, entry.path).toBeUndefined();
      expect(entry.navBottom, entry.path).toBeUndefined();
      if (entry.navCount) expect(entry.path).toBe('/app/short-rent/messages');
    }
  });

  it('is in no menu while the entry it hangs from is open to the user, and is listed by that page', () => {
    const visible = paths(getVisibleNavEntries('short-rent', allowAll));
    expect(visible).not.toContain('/app/short-rent/alloggiati');
    expect(visible).not.toContain('/app/short-rent/compliance/cin');
    expect(visible).not.toContain('/app/short-rent/compliance/identification');
    expect(paths(getNavChildren('/app/short-rent/compliance', allowAll))).toEqual([
      '/app/short-rent/alloggiati',
      '/app/short-rent/alloggiati/reports',
      '/app/short-rent/compliance/cin',
      '/app/short-rent/compliance/identification',
    ]);
    expect(paths(getNavMatchEntries('short-rent', allowAll))).toEqual(
      expect.arrayContaining(['/app/short-rent/alloggiati', '/app/short-rent/compliance']),
    );
  });

  it('takes a place in "Altro" when the entry it hangs from is not open to the user', () => {
    // Alloggiati asks for booking.read, its parent (Adempimenti) for property.read: no page is left without a way in.
    const noProperties = without('property.read');
    expect(paths(getVisibleNavEntries('short-rent', noProperties))).not.toContain('/app/short-rent/compliance');
    const more = getSecondaryNavEntries('short-rent', noProperties);
    expect(paths(more)).toContain('/app/short-rent/alloggiati');
    expect(more.find((entry) => entry.path === '/app/short-rent/alloggiati')?.navPlacement).toBe('secondary');
    expect(paths(getVisibleNavEntries('short-rent', allowAll))).not.toContain('/app/short-rent/alloggiati');

    // The same for the LTR reference data of the staff console, which asks for another permission than the audit.
    const noAudit = without('admin.cin.read');
    expect(paths(getSecondaryNavEntries('admin', noAudit))).toContain('/app/admin/compliance/ltr-reference-data');

    // And for Incassi: who cannot read the payments still finds the fiscal regime and the Stripe account in "Altro".
    const noPayments = without('payment.read');
    expect(paths(getVisibleNavEntries('short-rent', noPayments))).not.toContain('/app/short-rent/payments');
    expect(paths(getSecondaryNavEntries('short-rent', noPayments))).toEqual(
      expect.arrayContaining(['/app/short-rent/fiscal', '/app/short-rent/settings/payments']),
    );
    expect(paths(getSecondaryNavEntries('short-rent', noPayments))).not.toContain('/app/short-rent/reports');
  });

  it('lists only the pages the user may open', () => {
    expect(paths(getNavChildren('/app/short-rent/compliance', without('booking.read')))).toEqual([
      '/app/short-rent/compliance/cin',
      '/app/short-rent/compliance/identification',
    ]);
    // Setting a lock code asks for writing the properties: who may only read them has no tab for it.
    expect(paths(getNavChildren('/app/short-rent/compliance', without('property.write')))).not.toContain(
      '/app/short-rent/compliance/identification',
    );
    // The branding and documents pages are for the org billing administrator; the domain is not.
    expect(paths(getNavChildren('/app/short-rent/vetrina', notBillingAdmin))).toEqual(['/app/short-rent/settings/domain']);
    expect(paths(getNavChildren('/app/short-rent/vetrina', allowAll))).toEqual([
      '/app/short-rent/settings/site-appearance',
      '/app/short-rent/settings/site-documents',
      '/app/short-rent/settings/domain',
    ]);
  });
});

describe('route-manifest sections as tabs (UI-04a)', () => {
  it('gives every page of a section the same tabs, the entry first', () => {
    const bookings = ['/app/short-rent/bookings', '/app/short-rent/messages', '/app/short-rent/guests', '/app/short-rent/reviews'];
    for (const page of bookings) expect(paths(getNavSection(page, allowAll)), page).toEqual(bookings);

    const payments = [
      '/app/short-rent/payments',
      '/app/short-rent/payments/revenue',
      '/app/short-rent/reports',
      '/app/short-rent/fiscal',
      '/app/short-rent/settings/payments',
    ];
    for (const page of payments) expect(paths(getNavSection(page, allowAll)), page).toEqual(payments);

    // The same strip in the other rental area.
    const leases = ['/app/long-rent/leases', '/app/long-rent/tenants', '/app/long-rent/deadlines', '/app/long-rent/fiscal'];
    for (const page of leases) expect(paths(getNavSection(page, allowAll)), page).toEqual(leases);
  });

  it('draws no tabs for a page that is in no section, a record of a section, or an entry with no other page', () => {
    for (const pathname of [
      '/app/short-rent',
      '/app/short-rent/bookings/calendar',
      '/app/short-rent/marketplace',
      '/app/short-rent/settings/organization',
      '/app/short-rent/approval-queue/', // only the verifications hang from it, and they ask another permission
      '/app/short-rent/bookings/create',
      '/app/short-rent/payments/6f1c9a52-1111-4222-8333-944455556666',
      '/app/long-rent/properties',
      '/not/a/page',
    ]) {
      const section = getNavSection(pathname, (_ctx, permission) => permission !== 'verification.decide');
      expect(paths(section), pathname).toEqual([]);
    }
  });

  it('takes the address as it is typed: a trailing slash is the same page', () => {
    expect(paths(getNavSection('/app/short-rent/guests/', allowAll))).toEqual(paths(getNavSection('/app/short-rent/guests', allowAll)));
    expect(getNavSection('/app/short-rent/guests/', allowAll).length).toBeGreaterThan(1);
  });

  it('leaves out the tabs the user may not open, the OTA tab while its flag is off and the trusted suppliers while the agency plan is', () => {
    expect(paths(getNavSection('/app/short-rent/properties', allowAll))).toEqual([
      '/app/short-rent/properties',
      '/app/short-rent/interventions',
      '/app/short-rent/channels',
    ]);
    expect(paths(getNavSection('/app/short-rent/properties', allowAll, { agencyTier: true }))).toEqual([
      '/app/short-rent/properties',
      '/app/short-rent/interventions',
      '/app/short-rent/trusted-suppliers',
      '/app/short-rent/channels',
    ]);
    expect(paths(getNavSection('/app/short-rent/properties', allowAll, { otaPartnerApi: true }))).toContain('/app/short-rent/ota');
    expect(paths(getNavSection('/app/short-rent/properties', without('ota.read'), { otaPartnerApi: true }))).not.toContain(
      '/app/short-rent/ota',
    );
    // Who may not write the properties has no Stripe tab in Incassi.
    expect(paths(getNavSection('/app/short-rent/payments', without('property.write')))).not.toContain('/app/short-rent/settings/payments');
    // The branding and the documents are for the org billing administrator only.
    expect(paths(getNavSection('/app/short-rent/vetrina', notBillingAdmin))).toEqual([
      '/app/short-rent/vetrina',
      '/app/short-rent/settings/domain',
    ]);
  });

  it('draws no tabs when the user cannot open the entry: its pages are entries of "Altro" of their own', () => {
    const noPayments = without('payment.read');
    for (const page of ['/app/short-rent/payments', '/app/short-rent/fiscal', '/app/short-rent/settings/payments']) {
      expect(paths(getNavSection(page, noPayments)), page).toEqual([]);
    }
    // And no tabs for a page the user cannot open, even when its entry is open to them.
    expect(paths(getNavSection('/app/short-rent/reports', without('payment.read')))).toEqual([]);
  });

  it('puts the entry a page hangs from first in its tabs, for a user who may open every page', () => {
    const flags: Partial<FeatureFlags> = { otaPartnerApi: true, supplierOnlinePayments: true, agencyTier: true, crmMarketing: true };
    for (const entry of ROUTE_MANIFEST.filter((candidate) => candidate.navParent)) {
      const tabs = paths(getNavSection(entry.path, allowAll, flags));
      expect(tabs[0], entry.path).toBe(entry.navParent);
      expect(tabs, entry.path).toContain(entry.path);
    }
  });
});

describe('route-manifest: no page is left without a way in (UI-04a)', () => {
  it.each(CONTEXTS)('%s: every page of the menus is in a menu or hangs from an entry in a menu', (contextKey) => {
    for (const { label, hasPermission, features } of userVariants(contextKey)) {
      const visible = paths(getVisibleNavEntries(contextKey, hasPermission, features));
      const reachable = ROUTE_MANIFEST.filter(
        (entry) =>
          entry.context === contextKey &&
          (entry.navPlacement !== undefined || entry.navParent !== undefined) &&
          hasEntryPermission(entry, hasPermission) &&
          isEntryFeatureEnabled(entry, features),
      );
      for (const entry of reachable) {
        const inMenu = visible.includes(entry.path);
        const hangsFromVisible = entry.navParent !== undefined && visible.includes(entry.navParent);
        // Or it is a tab of the profile of the area: the menu of the user leads there, and the profile asks no permission (checked above).
        const hangsFromProfile = entry.navParent !== undefined && entry.navParent === profilePathForContext(contextKey);
        expect(inMenu || hangsFromVisible || hangsFromProfile, `${entry.path} for ${contextKey} user with ${label}`).toBe(true);
      }
    }
  });

  // The 43 pages that remain navigable after removing the redundant contracts section. Plan and billing left the menus because the org badge of the header
  // leads to the plan page (`usePlanPagePath`), which links to the billing page and back.
  const MENU_PAGES_BEFORE = [
    '/app/short-rent', '/app/short-rent/properties', '/app/short-rent/fiscal', '/app/short-rent/settings/domain',
    '/app/short-rent/settings/plan', '/app/short-rent/settings/billing', '/app/short-rent/settings/organization',
    '/app/short-rent/settings/site-appearance', '/app/short-rent/settings/site-documents',
    '/app/short-rent/settings/payments', '/app/short-rent/bookings', '/app/short-rent/bookings/calendar',
    '/app/short-rent/marketplace', '/app/short-rent/alloggiati', '/app/short-rent/compliance/cin',
    '/app/short-rent/payments', '/app/short-rent/payments/revenue', '/app/short-rent/ota', '/app/short-rent/vetrina',
    '/app/short-rent/profile', '/app/short-rent/guests',
    '/app/long-rent/properties', '/app/long-rent/profile', '/app/long-rent/settings/plan',
    '/app/long-rent/settings/billing', '/app/long-rent/settings/organization',
    '/app/admin', '/app/admin/users', '/app/admin/profile', '/app/admin/suppliers', '/app/admin/suppliers/invite',
    '/app/admin/jobs', '/app/admin/seo', '/app/admin/cin', '/app/admin/compliance/tax-rates',
    '/app/admin/compliance/ltr-reference-data',
    '/app/supplier/dashboard', '/app/supplier/calendar', '/app/supplier/profile', '/app/supplier/inbox',
    '/app/supplier/availability', '/app/supplier/showcase', '/app/supplier/help/ical',
  ];
  const REACHED_BY_THE_ORG_BADGE = [
    '/app/short-rent/settings/plan',
    '/app/short-rent/settings/billing',
    '/app/long-rent/settings/plan',
    '/app/long-rent/settings/billing',
  ];
  // Profilo left the menus of the rental areas: the menu of the user (header, sheet of the phone) leads to it from every area.
  const REACHED_BY_THE_USER_MENU = ['/app/short-rent/profile', '/app/long-rent/profile'];

  it('keeps every page that was in a menu reachable by a full-access user, with every flag on', () => {
    expect(MENU_PAGES_BEFORE).toHaveLength(43);
    const flags: Partial<FeatureFlags> = { otaPartnerApi: true, aiSupplierDiscovery: true, rliProvider: true, eSignProvider: true };
    for (const page of MENU_PAGES_BEFORE) {
      const entry = entryOf(page);
      const visible = paths(getVisibleNavEntries(entry.context, allowAll, flags));
      const inMenu = visible.includes(page);
      const hangsFromVisible = entry.navParent !== undefined && visible.includes(entry.navParent);
      const byOrgBadge = REACHED_BY_THE_ORG_BADGE.includes(page);
      const byUserMenu = REACHED_BY_THE_USER_MENU.includes(page);
      expect(inMenu || hangsFromVisible || byOrgBadge || byUserMenu, page).toBe(true);
    }
  });

  it('keeps the plan and billing pages one click from the org badge of a rental area', () => {
    for (const context of ['short-rent', 'long-rent'] as const) {
      expect(entryOf(planPagePath(context)).context).toBe(context);
      expect(entryOf(billingPagePath(context)).context).toBe(context);
    }
    // They are in no menu any more, and the organization page stays in "Altro" of both rental areas.
    for (const page of REACHED_BY_THE_ORG_BADGE) {
      const entry = entryOf(page);
      expect(entry.navPlacement, page).toBeUndefined();
      expect(entry.navParent, page).toBeUndefined();
    }
    expect(paths(getSecondaryNavEntries('long-rent', allowAll))).toContain('/app/long-rent/settings/organization');
  });

  it('keeps Profilo one click from the menu of the user and in no menu of the rental areas', () => {
    for (const context of ['short-rent', 'long-rent'] as const) {
      const page = profilePathForContext(context);
      expect(REACHED_BY_THE_USER_MENU).toContain(page);
      expect(entryOf(page).context).toBe(context);
      expect(entryOf(page).navPlacement, page).toBeUndefined();
      expect(entryOf(page).navParent, page).toBeUndefined();
      expect(paths(getVisibleNavEntries(context, allowAll))).not.toContain(page);
    }
  });

  // Baseline of the manifest before UI-04a: every route is still there with its legacy addresses (emails and Stripe returns).
  const PATHS_BEFORE: [string, string[] | undefined][] = [
    ['/app/short-rent', ['/', '/app/short-rent/']],
    ['/app/short-rent/properties', ['/properties']],
    ['/app/short-rent/properties/create', ['/properties/create']],
    ['/app/short-rent/properties/:id', ['/properties/:id']],
    ['/app/short-rent/properties/:id/edit', ['/properties/:id/edit']],
    ['/app/short-rent/properties/:id/activation', ['/properties/:id/activation']],
    ['/app/short-rent/properties/:id/pricing', ['/properties/:id/pricing']],
    ['/app/short-rent/compliance', undefined],
    ['/app/short-rent/fiscal', undefined],
    ['/app/short-rent/fiscal/wizard', undefined],
    ['/app/short-rent/fiscal/reports', undefined],
    ['/app/short-rent/settings/domain', undefined],
    ['/app/short-rent/settings/plan', undefined],
    ['/app/short-rent/settings/billing', undefined],
    ['/app/short-rent/settings/organization', undefined],
    ['/app/short-rent/settings/site-appearance', undefined],
    ['/app/short-rent/settings/site-documents', undefined],
    ['/app/short-rent/settings/payments', undefined],
    ['/app/short-rent/bookings', ['/bookings']],
    ['/app/short-rent/bookings/create', ['/bookings/create']],
    ['/app/short-rent/bookings/calendar', ['/bookings/calendar']],
    ['/app/short-rent/bookings/:id/checkout', ['/bookings/:id/checkout']],
    ['/app/short-rent/marketplace', undefined],
    ['/app/short-rent/alloggiati', undefined],
    ['/app/short-rent/compliance/cin', ['/app/short-rent/cin', '/cin']],
    ['/app/short-rent/bookings/:id', ['/bookings/:id']],
    ['/app/short-rent/bookings/:id/edit', ['/bookings/:id/edit']],
    ['/app/short-rent/payments', ['/payments']],
    ['/app/short-rent/payments/create', ['/payments/create']],
    ['/app/short-rent/payments/revenue', ['/payments/revenue']],
    ['/app/short-rent/payments/:id', ['/payments/:id']],
    ['/app/short-rent/ota', ['/ota']],
    ['/app/short-rent/ota/create', ['/ota/create']],
    ['/app/short-rent/vetrina', undefined],
    ['/app/short-rent/profile', ['/profile']],
    ['/app/long-rent/leases', ['/leases']],
    ['/app/long-rent/leases/new', ['/leases/new']],
    ['/app/long-rent/leases/:id', ['/leases/:id']],
    ['/app/long-rent/properties', undefined],
    ['/app/long-rent/properties/new', undefined],
    ['/app/long-rent/properties/:id', undefined],
    ['/app/long-rent/properties/:id/edit', undefined],
    ['/app/long-rent/profile', ['/profile']],
    ['/app/long-rent/settings/plan', undefined],
    ['/app/long-rent/settings/billing', undefined],
    ['/app/long-rent/settings/organization', undefined],
    ['/app/admin', ['/admin']],
    ['/app/admin/users', ['/admin/users']],
    ['/app/admin/profile', undefined],
    ['/app/admin/suppliers', undefined],
    ['/app/admin/suppliers/invite', ['/admin/suppliers/invite']],
    ['/app/admin/jobs', ['/admin/jobs']],
    ['/app/admin/seo', ['/admin/seo']],
    ['/app/short-rent/guests', undefined],
    ['/app/short-rent/guests/:id', undefined],
    ['/app/admin/cin', ['/admin/cin']],
    ['/app/admin/compliance/tax-rates', ['/app/admin/tourist-tax', '/admin/tourist-tax']],
    ['/app/admin/compliance/ltr-reference-data', undefined],
    ['/app/supplier/activation', undefined],
    ['/app/supplier/dashboard', undefined],
    ['/app/supplier/calendar', undefined],
    ['/app/supplier/profile', undefined],
    ['/app/supplier/inbox', undefined],
    ['/app/supplier/inbox/:id', undefined],
    ['/app/supplier/availability', undefined],
    ['/app/supplier/showcase', undefined],
    ['/app/supplier/help/ical', undefined],
  ];

  it('changes no path and no legacy path of the manifest', () => {
    for (const [path, legacyPaths] of PATHS_BEFORE) {
      expect(entryOf(path).legacyPaths, path).toEqual(legacyPaths);
    }
  });
});

describe('route-manifest nav helpers', () => {
  const denyOta = (_ctx: string, permission: string) => permission !== 'ota.read';

  // TN-3 / PL-12: the organization page is in the menu only for the org billing administrator.
  it('shows the organization page only to the org billing administrator', () => {
    const orgPaths = ['/app/short-rent/settings/organization', '/app/long-rent/settings/organization'];
    for (const path of orgPaths) {
      const entry = entryOf(path);
      expect(entry.orgBillingAdmin).toBe(true);
      expect(entry.requiredPermissions).toEqual([]);
    }
    expect(paths(getVisibleNavEntries('short-rent', notBillingAdmin))).not.toContain(orgPaths[0]);
    expect(paths(getVisibleNavEntries('long-rent', notBillingAdmin))).not.toContain(orgPaths[1]);
    expect(paths(getVisibleNavEntries('short-rent', without('booking.read'))).includes(orgPaths[0])).toBe(true);
    // Stripe Connect (a tab of Incassi) does not need to be the org administrator.
    expect(paths(getNavChildren('/app/short-rent/payments', notBillingAdmin))).toContain('/app/short-rent/settings/payments');
  });

  // TN-3 / PL-12: plan and billing are for the org billing administrator, wherever the user finds them.
  it('keeps plan and billing for the org billing administrator and in no menu', () => {
    for (const path of ['/app/short-rent/settings/plan', '/app/short-rent/settings/billing']) {
      expect(entryOf(path).orgBillingAdmin).toBe(true);
      expect(paths(getVisibleNavEntries('short-rent', allowAll))).not.toContain(path);
    }
  });

  // BK-12 / BK-14: the public-site pages belong to the short-rent shell, for the org billing administrator only.
  it('shows the site appearance and documents pages only in the short-rent shell, to the org billing administrator', () => {
    for (const path of ['/app/short-rent/settings/site-appearance', '/app/short-rent/settings/site-documents']) {
      const entry = entryOf(path);
      expect(entry.orgBillingAdmin).toBe(true);
      expect(entry.navParent).toBe('/app/short-rent/vetrina');
      expect(ROUTE_MANIFEST.some((candidate) => candidate.path === path.replace('short-rent', 'long-rent'))).toBe(false);
      expect(paths(getNavChildren('/app/short-rent/vetrina', notBillingAdmin))).not.toContain(path);
      expect(paths(getNavChildren('/app/short-rent/vetrina', allowAll))).toContain(path);
    }
  });

  it('maps each plan or billing page to the same page of the other rental shell', () => {
    const shortRentPlan = ROUTE_MANIFEST.find((e) => e.path === '/app/short-rent/settings/plan')!;
    const longRentBilling = ROUTE_MANIFEST.find((e) => e.path === '/app/long-rent/settings/billing')!;
    const leases = ROUTE_MANIFEST.find((e) => e.path === '/app/long-rent/leases')!;

    expect(getOrgBillingPageAlternates(shortRentPlan)).toEqual({ 'long-rent': '/app/long-rent/settings/plan' });
    expect(getOrgBillingPageAlternates(longRentBilling)).toEqual({ 'short-rent': '/app/short-rent/settings/billing' });
    expect(getOrgBillingPageAlternates(leases)).toEqual({});
  });

  it('hides OTA when ota.read permission is missing', () => {
    const visible = getVisibleNavEntries('short-rent', denyOta, { otaPartnerApi: true });
    expect(visible.some((e) => e.path === '/app/short-rent/ota')).toBe(false);
    expect(paths(getNavChildren('/app/short-rent/properties', denyOta, { otaPartnerApi: true }))).not.toContain('/app/short-rent/ota');
  });

  // FD-20 / D10: the OTA partner API is in freeze behind the otaPartnerApi flag.
  it('hides OTA channels while the otaPartnerApi flag is off, even with ota.read', () => {
    const flagOff = getVisibleNavEntries('short-rent', allowAll, { otaPartnerApi: false });
    const flagsNotLoaded = getVisibleNavEntries('short-rent', allowAll);
    const phoneMenu = getContextNav('short-rent', allowAll, { otaPartnerApi: false }, { withoutBottom: true });
    const sidebar = getContextNav('short-rent', allowAll, { otaPartnerApi: false });

    for (const entries of [flagOff, flagsNotLoaded, phoneMenu.more, sidebar.more]) {
      expect(entries.some((e) => e.path.startsWith('/app/short-rent/ota'))).toBe(false);
    }
    // It is a tab of Immobili, and the tab is not there either.
    for (const features of [{ otaPartnerApi: false }, undefined]) {
      expect(paths(getNavChildren('/app/short-rent/properties', allowAll, features))).not.toContain('/app/short-rent/ota');
    }
  });

  it('shows OTA channels when the otaPartnerApi flag is on, as a tab of Immobili', () => {
    expect(paths(getNavChildren('/app/short-rent/properties', allowAll, { otaPartnerApi: true }))).toContain('/app/short-rent/ota');
    // It is not an entry of the menus of its own: Immobili stands for it.
    expect(paths(getVisibleNavEntries('short-rent', allowAll, { otaPartnerApi: true }))).not.toContain('/app/short-rent/ota');
  });

  it('puts every /ota route behind the otaPartnerApi flag', () => {
    const otaRoutes = ROUTE_MANIFEST.filter((e) => e.path.startsWith('/app/short-rent/ota'));
    expect(otaRoutes.length).toBeGreaterThan(0);
    for (const entry of otaRoutes) {
      expect(entry.featureFlag).toBe('otaPartnerApi');
      expect(isEntryFeatureEnabled(entry, { otaPartnerApi: false })).toBe(false);
    }
  });

  // A7-06: a long-term landlord manages its properties (and their APE) inside the long-rent context.
  it('gates the long-rent property routes on property permissions, never on short-stay ones', () => {
    const propertyRoutes = ROUTE_MANIFEST.filter((e) => e.path.startsWith('/app/long-rent/properties'));
    expect(propertyRoutes.map((e) => e.path)).toEqual([
      '/app/long-rent/properties',
      '/app/long-rent/properties/new',
      '/app/long-rent/properties/:id',
      '/app/long-rent/properties/:id/edit',
      '/app/long-rent/properties/:id/mode',
    ]);
    for (const entry of propertyRoutes) {
      expect(entry.context).toBe('long-rent');
      expect(entry.requiredPermissions.every((p) => p.startsWith('property.'))).toBe(true);
    }
    const withoutProperty = (_ctx: string, permission: string) => !permission.startsWith('property.');
    expect(getVisibleNavEntries('long-rent', withoutProperty).some((e) => e.path.includes('/properties'))).toBe(false);
  });

  it('keeps the iCal-based calendar available with the otaPartnerApi flag off', () => {
    const primary = getPrimaryNavEntries('short-rent', allowAll, { otaPartnerApi: false });
    expect(primary.some((e) => e.path === '/app/short-rent/bookings/calendar')).toBe(true);
  });

  // NF-07 (ADR-026): the To do list is one entry of "Altro" with the counter of its urgent items. The main menu has its eight entries, and
  // the page of the staff work (/app/admin/activities, the agency plan) is another page in another area.
  it('puts the To do list in "Altro" of short-rent with the counter of its urgent items, apart from the staff page', () => {
    const entry = entryOf('/app/short-rent/activities');
    expect(entry.context).toBe('short-rent');
    expect(entry.navKey).toBe('nav.activities');
    expect(entry.navPlacement).toBe('secondary');
    expect(entry.navCount).toBe('activities');
    expect(entry.featureFlag).toBeUndefined();
    // Every role of the area holds the permission it asks: the server shows each one only the items its scope reaches.
    expect(entry.requiredPermissions).toEqual(['property.read']);
    expect(paths(getSecondaryNavEntries('short-rent', without('property.read')))).not.toContain('/app/short-rent/activities');
    // It is the last of "Altro", after the entries that were already there.
    expect(paths(getSecondaryNavEntries('short-rent', allowAll)).at(-1)).toBe('/app/short-rent/activities');

    const staff = entryOf('/app/admin/activities');
    expect(staff.context).toBe('admin');
    expect(staff.navKey).toBe('nav.staffActivities');
    expect(staff.navCount).toBeUndefined();
  });

  // A1-16: the CIN audit page existed but had no route, so the admin had no menu entry or URL for it.
  it('makes the admin CIN audit route reachable and visible in the admin menu', () => {
    const entry = ROUTE_MANIFEST.find((e) => e.path === '/app/admin/cin');
    expect(entry?.context).toBe('admin');
    expect(entry?.requiredPermissions).toEqual(['admin.cin.read']);
    expect(entry?.navPlacement).toBe('primary');
    expect(entry?.legacyPaths).toContain('/admin/cin');

    const visible = getVisibleNavEntries('admin', allowAll).map((e) => e.path);
    expect(visible).toContain('/app/admin/cin');

    const withoutCinRead = (_ctx: string, permission: string) => permission !== 'admin.cin.read';
    const hiddenPaths = getVisibleNavEntries('admin', withoutCinRead).map((e) => e.path);
    expect(hiddenPaths).not.toContain('/app/admin/cin');

    // The old /admin/cin URL is the admin audit: no other entry may claim it (the host CIN page used to).
    const claimants = ROUTE_MANIFEST.filter((e) => e.legacyPaths?.includes('/admin/cin')).map((e) => e.path);
    expect(claimants).toEqual(['/app/admin/cin']);
  });

  it('groups the three compliance pages of the staff console in one entry', () => {
    expect(paths(getNavChildren('/app/admin/cin', allowAll))).toEqual([
      '/app/admin/compliance/tax-rates',
      '/app/admin/compliance/ltr-reference-data',
    ]);
    expect(paths(getVisibleNavEntries('admin', allowAll))).not.toContain('/app/admin/compliance/tax-rates');
  });

  // SU-16 (A4-32, #327-AC2/AC4): the iCal help page lives inside the supplier console, with its own sidebar entry.
  it('puts the iCal help page in "Altro" of the supplier console', () => {
    const entry = ROUTE_MANIFEST.find((e) => e.path === '/app/supplier/help/ical');
    expect(entry?.context).toBe('supplier');
    expect(entry?.navKey).toBe('nav.supplierHelpIcal');

    expect(paths(getSecondaryNavEntries('supplier', allowAll))).toEqual([
      '/app/supplier/profile',
      '/app/supplier/help/ical',
    ]);
    expect(paths(getContextNav('supplier', allowAll, {}, { withoutBottom: true }).more)).toContain('/app/supplier/help/ical');
  });

  // SU-13 (A4-16): the preview of the public showcase is a main entry of the supplier menu. Since SP-06 (SP-D11) it is no longer
  // one of the four places of the phone bar: that is where the catalog of services is, and the showcase is in "Altro".
  it('puts the showcase preview among the main entries of the supplier console, after the services', () => {
    const entry = ROUTE_MANIFEST.find((e) => e.path === '/app/supplier/showcase');
    expect(entry?.context).toBe('supplier');
    expect(entry?.navKey).toBe('nav.supplierShowcase');
    expect(entry?.navPlacement).toBe('primary');
    expect(entry?.navOrder).toBe(5);
    expect(entry?.navBottom).toBeUndefined();
  });

  // SP-06 (SP-D1, SP-D11): "Servizi e prezzi" is the fourth entry of the menu and the fourth place of the bar of the phone.
  it('puts the catalog of services in the fourth place of the supplier menu and of the phone bar', () => {
    const entry = entryOf('/app/supplier/services');
    expect(entry.context).toBe('supplier');
    expect(entry.navKey).toBe('nav.supplierServices');
    expect(entry.navGroup).toBe('activity');
    expect(entry.navPlacement).toBe('primary');
    expect(entry.navOrder).toBe(4);
    expect(entry.navBottom).toBe(4);
    expect(entry.requiredPermissions).toEqual([]);
    expect(entry.featureFlag).toBeUndefined();

    expect(paths(getBottomNavEntries('supplier', allowAll))).toEqual([
      '/app/supplier/dashboard',
      '/app/supplier/inbox',
      '/app/supplier/availability',
      '/app/supplier/services',
    ]);
    // On the phone the showcase, the customers and the settings are reached through "Altro", with the rest of the menu.
    const phoneMenu = getContextNav('supplier', allowAll, {}, { withoutBottom: true });
    expect(paths(phoneMenu.sections.flatMap((section) => section.entries))).toEqual([
      '/app/supplier/showcase',
      '/app/supplier/clients',
      '/app/supplier/settings',
    ]);
  });

  // A shorter name on the bar is for an entry of the bar, and never for one with a counter (name and counter are read together).
  it('gives a short name for the bar only to entries that are on the bar and have no counter', () => {
    const withShortName = ROUTE_MANIFEST.filter((entry) => entry.navBarKey);

    expect(withShortName.map((entry) => entry.path)).toEqual(['/app/supplier/services']);
    for (const entry of withShortName) {
      expect(entry.navBottom, entry.path).toBeDefined();
      expect(entry.navCount, entry.path).toBeUndefined();
    }
  });

  it('keeps the creation and the page of a service out of the menus: the entry of the catalog stands for them', () => {
    for (const path of ['/app/supplier/services/new', '/app/supplier/services/:id']) {
      const entry = entryOf(path);
      expect(entry.context, path).toBe('supplier');
      expect(entry.navPlacement, path).toBeUndefined();
      expect(entry.navParent, path).toBeUndefined();
      expect(entry.legacyPaths, path).toBeUndefined();
    }
    expect(paths(getVisibleNavEntries('supplier', allowAll))).not.toContain('/app/supplier/services/new');
    const entries = getNavMatchEntries('supplier', allowAll);
    for (const pathname of ['/app/supplier/services', '/app/supplier/services/new', '/app/supplier/services/6f1c9a52-1111-4222-8333-944455556666']) {
      expect(resolveActiveNavEntry(pathname, entries)?.path, pathname).toBe('/app/supplier/services');
    }
  });

  it('lets the iCal calendar of the supplier hang from the availability', () => {
    expect(paths(getNavChildren('/app/supplier/availability', allowAll))).toEqual(['/app/supplier/calendar']);
    expect(paths(getVisibleNavEntries('supplier', allowAll))).not.toContain('/app/supplier/calendar');
  });

  // UI-00 (merged separately) opens the first page of the menu the user can open when the default one is closed to it.
  it('lists the main menu before "Altro", whatever the order numbers of the entries say', () => {
    const visible = getVisibleNavEntries('long-rent', without('lease.read'));
    expect(paths(visible)).toEqual([
      '/app/long-rent/properties',
      '/app/long-rent/service-requests',
      '/app/long-rent/settings/organization',
      '/app/long-rent/settings/invitations',
      '/app/long-rent/payments',
    ]);
    // Profilo is no entry of the menu: for a user the area gives nothing, `getFirstOpenablePage` leads to it.
    const nothing = getVisibleNavEntries('long-rent', (_ctx, permission) => !permission);
    expect(paths(nothing)).toEqual([]);
  });

  // A host invites other independent hosts from "Altro" of both rental areas; the admin has one section for all the invites.
  it('puts the invitation of hosts in "Altro" of both rental areas, open to every member of a host org', () => {
    for (const context of ['short-rent', 'long-rent'] as const) {
      const entry = entryOf(`/app/${context}/settings/invitations`);
      expect(entry.context).toBe(context);
      expect(entry.navKey).toBe('nav.hostInvites');
      expect(entry.navPlacement).toBe('secondary');
      // Backend policy SharedPropertyRead: the permission every host role holds, owner or collaborator.
      expect(entry.requiredPermissions).toEqual(['property.read']);
      expect(entry.orgBillingAdmin).toBeUndefined();
    }
  });

  it('keeps the section of the invites of the admin at the address of the supplier invite, admin only', () => {
    const entry = entryOf('/app/admin/suppliers/invite');
    expect(entry.navKey).toBe('nav.invites');
    expect(entry.requiredPermissions).toEqual(['admin.users.manage']);
    expect(entry.legacyPaths).toEqual(['/admin/suppliers/invite']);
  });
});

// E07/F06/US03/T01 (NF-95, AC-NF95-8): the CRM module is unfinished, so its entry and its pages exist only while the backend flag
// `CrmMarketing` is on. The pages the e-mails link to are not in this table: they are public routes, never behind the flag.
describe('route-manifest CRM entries behind the crmMarketing flag (E07/F06/US03/T01)', () => {
  const CRM_PATHS = ['/app/short-rent/crm/guests', '/app/short-rent/crm/guests/:id'];
  const OTHER_FLAGS_ON: Partial<FeatureFlags> = { otaPartnerApi: true, supplierOnlinePayments: true, agencyTier: true };

  it('crm entries are hidden while crmMarketing is off', () => {
    // Off by default and while the flags load or cannot be read; anything but `true` from the API is off too.
    expect(DEFAULT_FEATURE_FLAGS.crmMarketing).toBe(false);
    expect(parseFeatureFlags(undefined).crmMarketing).toBe(false);
    expect(parseFeatureFlags({ crmMarketing: 'true' }).crmMarketing).toBe(false);
    expect(parseFeatureFlags({ crmMarketing: true }).crmMarketing).toBe(true);

    for (const path of CRM_PATHS) {
      // Behind the flag: the route guard sends the address to the home of the area while it is off.
      expect(entryOf(path).featureFlag, path).toBe('crmMarketing');
      expect(isEntryFeatureEnabled(entryOf(path), undefined), path).toBe(false);
      expect(isEntryFeatureEnabled(entryOf(path), { crmMarketing: false }), path).toBe(false);
    }

    // In no menu, no tab and not in "Altro", whoever the user is and whatever the other flags say.
    const users = userVariants('short-rent').filter(({ label }) => label.endsWith('flags off'));
    expect(users.length).toBeGreaterThan(5);
    for (const { label, hasPermission } of users) {
      for (const features of [undefined, {}, { crmMarketing: false }, OTHER_FLAGS_ON]) {
        const where = `${label} with ${JSON.stringify(features)}`;
        expect(paths(getNavMatchEntries('short-rent', hasPermission, features)), where).not.toContain('/app/short-rent/crm/guests');
        expect(paths(getVisibleNavEntries('short-rent', hasPermission, features)), where).not.toContain('/app/short-rent/crm/guests');
        expect(paths(getNavChildren('/app/short-rent/bookings', hasPermission, features)), where).not.toContain('/app/short-rent/crm/guests');
      }
    }
    expect(getContextNav('short-rent', allowAll).more.map((entry) => entry.navKey)).not.toContain('nav.crm');
  });

  it('puts the CRM entry in "Altro" of short-rent once crmMarketing is on, as an entry of its own', () => {
    const crm = entryOf('/app/short-rent/crm/guests');
    expect(crm.navKey).toBe('nav.crm');
    expect(crm.navPlacement).toBe('secondary');
    expect(crm.navParent).toBeUndefined();
    expect(crm.navGroup).toBeUndefined();
    // What the API behind the pages asks (`CrmController`: `guest.read`), for the list and for the detail: an entry the user opens must not end on a 403.
    expect(crm.requiredPermissions).toEqual(['guest.read']);
    expect(entryOf('/app/short-rent/crm/guests/:id').requiredPermissions).toEqual(['guest.read']);

    const on: Partial<FeatureFlags> = { crmMarketing: true };
    // After the queue of the guest verifications, before the settings of the org; the To do list stays the last.
    expect(paths(getSecondaryNavEntries('short-rent', allowAll, on))).toEqual([
      '/app/short-rent/approval-queue',
      '/app/short-rent/crm/guests',
      '/app/short-rent/settings/organization',
      '/app/short-rent/settings/invitations',
      '/app/short-rent/activities',
    ]);
    expect(paths(getContextNav('short-rent', allowAll, on, { withoutBottom: true }).more)).toContain('/app/short-rent/crm/guests');
    // It asks `guest.read`: the accountant (reads properties, bookings and payments, no guests) does not get an entry that would end on a 403.
    expect(paths(getSecondaryNavEntries('short-rent', without('guest.read'), on))).not.toContain('/app/short-rent/crm/guests');
    const accountant: PermissionPredicate = (_ctx, permission) => ['property.read', 'booking.read', 'payment.read'].includes(permission);
    expect(paths(getSecondaryNavEntries('short-rent', accountant, on))).not.toContain('/app/short-rent/crm/guests');
    // It is no tab of Prenotazioni any more.
    expect(paths(getNavChildren('/app/short-rent/bookings', allowAll, on))).toEqual(['/app/short-rent/messages', '/app/short-rent/guests', '/app/short-rent/reviews']);
    // The open CRM page highlights the CRM entry, not Prenotazioni.
    const entries = getNavMatchEntries('short-rent', allowAll, on);
    expect(resolveActiveNavEntry('/app/short-rent/crm/guests', entries)?.path).toBe('/app/short-rent/crm/guests');
    expect(resolveActiveNavEntry('/app/short-rent/crm/guests/c1', entries)?.path).toBe('/app/short-rent/crm/guests');
  });

});
