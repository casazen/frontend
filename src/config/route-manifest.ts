export type AppContextKey = 'short-rent' | 'long-rent' | 'admin' | 'supplier';

export type NavGroup =
  | 'operazioni'
  | 'immobili'
  | 'finanza'
  | 'compliance'
  | 'integrazioni'
  | 'account'
  | 'amministrazione';

export type NavPlacement = 'primary' | 'secondary';

export interface RouteManifestEntry {
  path: string;
  context: AppContextKey;
  requiredPermissions: string[];
  navKey?: string;
  /** Italian nav label when navKey i18n entry is not used */
  navLabel?: string;
  navGroup?: NavGroup;
  navPlacement?: NavPlacement;
  navOrder?: number;
  icon?: string;
  isDefault?: boolean;
  component: () => Promise<{ default: React.ComponentType }>;
  legacyPaths?: string[];
}

export const NAV_GROUP_ORDER: NavGroup[] = [
  'operazioni',
  'immobili',
  'finanza',
  'compliance',
  'integrazioni',
  'account',
  'amministrazione',
];

export const ROUTE_MANIFEST: RouteManifestEntry[] = [
  {
    path: '/app/short-rent',
    context: 'short-rent',
    requiredPermissions: [],
    navKey: 'nav.dashboard',
    navGroup: 'operazioni',
    navPlacement: 'primary',
    navOrder: 1,
    icon: 'LayoutDashboard',
    isDefault: true,
    component: async () => ({ default: (await import('@/features/dashboard/dashboard-page')).DashboardPage }),
    legacyPaths: ['/', '/app/short-rent/'],
  },
  {
    path: '/app/short-rent/properties',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.properties',
    navGroup: 'immobili',
    navPlacement: 'primary',
    navOrder: 3,
    icon: 'Home',
    component: async () => ({ default: (await import('@/features/properties/properties-page')).PropertiesPage }),
    legacyPaths: ['/properties'],
  },
  {
    path: '/app/short-rent/properties/create',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    component: async () => ({ default: (await import('@/features/properties/property-create-page')).PropertyCreatePage }),
    legacyPaths: ['/properties/create'],
  },
  {
    path: '/app/short-rent/properties/:id',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    component: async () => ({ default: (await import('@/features/properties/property-detail-page')).PropertyDetailPage }),
    legacyPaths: ['/properties/:id'],
  },
  {
    path: '/app/short-rent/properties/:id/edit',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    component: async () => ({ default: (await import('@/features/properties/property-edit-page')).PropertyEditPage }),
    legacyPaths: ['/properties/:id/edit'],
  },
  {
    path: '/app/short-rent/properties/:id/pricing',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    component: async () => ({ default: (await import('@/features/pricing')).PricingDashboardPage }),
    legacyPaths: ['/properties/:id/pricing'],
  },
  {
    path: '/app/short-rent/properties/:id/pricing/history',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    component: async () => ({ default: (await import('@/features/pricing')).PricingHistoryPage }),
    legacyPaths: ['/properties/:id/pricing/history'],
  },
  {
    path: '/app/short-rent/settings/plan',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.plan',
    navGroup: 'account',
    navPlacement: 'secondary',
    navOrder: 2,
    icon: 'CreditCard',
    component: async () => ({
      default: (await import('@/features/settings/plan-settings-page')).PlanSettingsPage,
    }),
  },
  {
    path: '/app/short-rent/settings/payments',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    navKey: 'nav.stripeConnect',
    navGroup: 'account',
    navPlacement: 'secondary',
    navOrder: 3,
    icon: 'Wallet',
    component: async () => ({
      default: (await import('@/features/settings/payments-page')).ConnectPaymentsPage,
    }),
  },
  {
    path: '/app/short-rent/bookings',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navKey: 'nav.bookings',
    navGroup: 'operazioni',
    navPlacement: 'primary',
    navOrder: 2,
    icon: 'Calendar',
    component: async () => ({ default: (await import('@/features/bookings/bookings-page')).BookingsPage }),
    legacyPaths: ['/bookings'],
  },
  {
    path: '/app/short-rent/bookings/create',
    context: 'short-rent',
    requiredPermissions: ['booking.write'],
    component: async () => ({ default: (await import('@/features/bookings/booking-create-page')).BookingCreatePage }),
    legacyPaths: ['/bookings/create'],
  },
  {
    path: '/app/short-rent/bookings/calendar',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navKey: 'nav.calendar',
    navGroup: 'operazioni',
    navPlacement: 'secondary',
    navOrder: 2,
    icon: 'CalendarDays',
    component: async () => ({ default: (await import('@/features/bookings/calendar-page')).CalendarPage }),
    legacyPaths: ['/bookings/calendar'],
  },
  {
    path: '/app/short-rent/alloggiati',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navKey: 'nav.alloggiati',
    navGroup: 'compliance',
    navPlacement: 'secondary',
    icon: 'ShieldCheck',
    component: async () => ({
      default: (await import('@/features/alloggiati/alloggiati-dashboard-page')).AlloggiatiDashboardPage,
    }),
  },
  {
    path: '/app/short-rent/cin',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.cin',
    navGroup: 'compliance',
    navPlacement: 'secondary',
    icon: 'ShieldCheck',
    component: async () => ({
      default: (await import('@/features/cin')).CinCompliancePage,
    }),
  },
  {
    path: '/app/short-rent/bookings/:id',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    component: async () => ({ default: (await import('@/features/bookings/booking-detail-page')).BookingDetailPage }),
    legacyPaths: ['/bookings/:id'],
  },
  {
    path: '/app/short-rent/bookings/:id/edit',
    context: 'short-rent',
    requiredPermissions: ['booking.write'],
    component: async () => ({ default: (await import('@/features/bookings/booking-edit-page')).BookingEditPage }),
    legacyPaths: ['/bookings/:id/edit'],
  },
  {
    path: '/app/short-rent/payments',
    context: 'short-rent',
    requiredPermissions: ['payment.read'],
    navKey: 'nav.payments',
    navGroup: 'finanza',
    navPlacement: 'secondary',
    navOrder: 1,
    icon: 'CreditCard',
    component: async () => ({ default: (await import('@/features/payments/payments-page')).PaymentsPage }),
    legacyPaths: ['/payments'],
  },
  {
    path: '/app/short-rent/payments/create',
    context: 'short-rent',
    requiredPermissions: ['payment.write'],
    component: async () => ({ default: (await import('@/features/payments/payment-create-page')).PaymentCreatePage }),
    legacyPaths: ['/payments/create'],
  },
  {
    path: '/app/short-rent/payments/revenue',
    context: 'short-rent',
    requiredPermissions: ['payment.read'],
    navKey: 'nav.revenue',
    navGroup: 'finanza',
    navPlacement: 'secondary',
    navOrder: 2,
    icon: 'ChartColumn',
    component: async () => ({ default: (await import('@/features/payments/revenue-page')).RevenuePage }),
    legacyPaths: ['/payments/revenue'],
  },
  {
    path: '/app/short-rent/payments/:id',
    context: 'short-rent',
    requiredPermissions: ['payment.read'],
    component: async () => ({ default: (await import('@/features/payments/payment-detail-page')).PaymentDetailPage }),
    legacyPaths: ['/payments/:id'],
  },
  {
    path: '/app/short-rent/ota',
    context: 'short-rent',
    requiredPermissions: ['ota.read'],
    navKey: 'nav.ota',
    navGroup: 'integrazioni',
    navPlacement: 'secondary',
    icon: 'Repeat',
    component: async () => ({ default: (await import('@/features/ota/ota-page')).OtaPage }),
    legacyPaths: ['/ota'],
  },
  {
    path: '/app/short-rent/ota/create',
    context: 'short-rent',
    requiredPermissions: ['ota.write'],
    component: async () => ({ default: (await import('@/features/ota/ota-setup-page')).OtaSetupPage }),
    legacyPaths: ['/ota/create'],
  },
  {
    path: '/app/short-rent/profile',
    context: 'short-rent',
    requiredPermissions: [],
    navKey: 'nav.profile',
    navGroup: 'account',
    navPlacement: 'secondary',
    navOrder: 1,
    icon: 'User',
    component: async () => ({ default: (await import('@/features/profile/profile-page')).ProfilePage }),
    legacyPaths: ['/profile'],
  },
  {
    path: '/app/long-rent/leases',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    navKey: 'nav.leases',
    navGroup: 'operazioni',
    navPlacement: 'primary',
    navOrder: 1,
    icon: 'FileText',
    isDefault: true,
    component: async () => ({ default: (await import('@/features/leases')).LeasesPage }),
    legacyPaths: ['/leases'],
  },
  {
    path: '/app/long-rent/leases/new',
    context: 'long-rent',
    requiredPermissions: ['lease.create'],
    component: async () => ({ default: (await import('@/features/leases')).LeaseCreatePage }),
    legacyPaths: ['/leases/new'],
  },
  {
    path: '/app/long-rent/leases/:id',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    component: async () => ({ default: (await import('@/features/leases')).LeaseDetailPage }),
    legacyPaths: ['/leases/:id'],
  },
  {
    path: '/app/long-rent/profile',
    context: 'long-rent',
    requiredPermissions: [],
    navKey: 'nav.profile',
    navGroup: 'account',
    navPlacement: 'primary',
    navOrder: 2,
    icon: 'User',
    component: async () => ({ default: (await import('@/features/profile/profile-content-page')).ProfileContentPage }),
    legacyPaths: ['/profile'],
  },
  {
    path: '/app/admin',
    context: 'admin',
    requiredPermissions: ['admin.stats.read'],
    navKey: 'nav.dashboard',
    navGroup: 'operazioni',
    navPlacement: 'primary',
    navOrder: 1,
    icon: 'LayoutDashboard',
    isDefault: true,
    component: async () => ({ default: (await import('@/features/admin/admin-dashboard-page')).AdminDashboardPage }),
    legacyPaths: ['/admin'],
  },
  {
    path: '/app/admin/users',
    context: 'admin',
    requiredPermissions: ['admin.users.read'],
    navKey: 'nav.users',
    navGroup: 'amministrazione',
    navPlacement: 'primary',
    navOrder: 2,
    icon: 'Users',
    component: async () => ({ default: (await import('@/features/admin/admin-users-page')).AdminUsersPage }),
    legacyPaths: ['/admin/users'],
  },
  {
    path: '/app/admin/suppliers/invite',
    context: 'admin',
    requiredPermissions: ['admin.users.manage'],
    navLabel: 'Invita fornitore',
    navGroup: 'amministrazione',
    navPlacement: 'secondary',
    navOrder: 6,
    icon: 'UserPlus',
    component: async () => ({ default: (await import('@/features/admin/admin-supplier-invite-page')).AdminSupplierInvitePage }),
    legacyPaths: ['/admin/suppliers/invite'],
  },
  {
    path: '/app/admin/cin',
    context: 'admin',
    requiredPermissions: ['admin.cin.read'],
    navKey: 'nav.cin',
    navGroup: 'amministrazione',
    navPlacement: 'primary',
    navOrder: 3,
    icon: 'FileCheck',
    component: async () => ({ default: (await import('@/features/admin/admin-cin-page')).AdminCinPage }),
    legacyPaths: ['/admin/cin'],
  },
  {
    path: '/app/admin/jobs',
    context: 'admin',
    requiredPermissions: ['admin.jobs.read'],
    navKey: 'nav.jobs',
    navGroup: 'amministrazione',
    navPlacement: 'primary',
    navOrder: 4,
    icon: 'Settings',
    component: async () => ({ default: (await import('@/features/admin/admin-jobs-page')).AdminJobsPage }),
    legacyPaths: ['/admin/jobs'],
  },
  {
    path: '/app/admin/seo',
    context: 'admin',
    requiredPermissions: ['admin.seo.read'],
    navKey: 'nav.seo',
    navGroup: 'amministrazione',
    navPlacement: 'primary',
    navOrder: 5,
    icon: 'Globe',
    component: async () => ({ default: (await import('@/features/admin/seo-dashboard-page')).SeoDashboardPage }),
    legacyPaths: ['/admin/seo'],
  },
];

export type PermissionPredicate = (contextKey: AppContextKey, permission: string) => boolean;

function isNavEntry(entry: RouteManifestEntry): boolean {
  return !!(entry.navKey || entry.navLabel);
}

function hasEntryPermission(
  entry: RouteManifestEntry,
  hasPermission?: PermissionPredicate,
): boolean {
  if (!hasPermission) return true;
  return entry.requiredPermissions.every((permission) =>
    hasPermission(entry.context, permission),
  );
}

export function getDefaultRoute(contextKey: AppContextKey): string {
  if (contextKey === 'supplier') {
    return '/supplier/inbox';
  }
  return ROUTE_MANIFEST.find((entry) => entry.context === contextKey && entry.isDefault)?.path ?? '/app/choose-context';
}

/** @deprecated Use getVisibleNavEntries for permission-aware navigation */
export function getNavEntries(contextKey: AppContextKey): RouteManifestEntry[] {
  return ROUTE_MANIFEST.filter(
    (entry) => entry.context === contextKey && isNavEntry(entry),
  );
}

export function getVisibleNavEntries(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
): RouteManifestEntry[] {
  return ROUTE_MANIFEST.filter(
    (entry) =>
      entry.context === contextKey &&
      isNavEntry(entry) &&
      hasEntryPermission(entry, hasPermission),
  ).sort((a, b) => (a.navOrder ?? 99) - (b.navOrder ?? 99));
}

export function getPrimaryNavEntries(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
): RouteManifestEntry[] {
  return getVisibleNavEntries(contextKey, hasPermission).filter(
    (entry) => entry.navPlacement === 'primary',
  );
}

export function getSecondaryNavEntries(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
): RouteManifestEntry[] {
  return getVisibleNavEntries(contextKey, hasPermission).filter(
    (entry) => entry.navPlacement === 'secondary',
  );
}

export function getSecondaryNavByGroup(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
): Map<NavGroup, RouteManifestEntry[]> {
  const grouped = new Map<NavGroup, RouteManifestEntry[]>();
  for (const entry of getSecondaryNavEntries(contextKey, hasPermission)) {
    if (!entry.navGroup) continue;
    const list = grouped.get(entry.navGroup) ?? [];
    list.push(entry);
    grouped.set(entry.navGroup, list);
  }
  return grouped;
}

/** Desktop sidebar: all visible nav entries grouped (primary + secondary). */
export function getDesktopNavByGroup(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
): Map<NavGroup, RouteManifestEntry[]> {
  const grouped = new Map<NavGroup, RouteManifestEntry[]>();
  for (const entry of getVisibleNavEntries(contextKey, hasPermission)) {
    if (!entry.navGroup) continue;
    const list = grouped.get(entry.navGroup) ?? [];
    list.push(entry);
    grouped.set(entry.navGroup, list);
  }
  return grouped;
}

/** Drawer entries: secondary routes, or all visible routes when no secondary (long-rent, admin). */
export function getDrawerNavByGroup(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
): Map<NavGroup, RouteManifestEntry[]> {
  const secondary = getSecondaryNavEntries(contextKey, hasPermission);
  const entries = secondary.length > 0 ? secondary : getVisibleNavEntries(contextKey, hasPermission);
  const grouped = new Map<NavGroup, RouteManifestEntry[]>();
  for (const entry of entries) {
    if (!entry.navGroup) continue;
    const list = grouped.get(entry.navGroup) ?? [];
    list.push(entry);
    grouped.set(entry.navGroup, list);
  }
  return grouped;
}

export function getManifestEntry(path: string): RouteManifestEntry | undefined {
  return ROUTE_MANIFEST.find((entry) => entry.path === path);
}
