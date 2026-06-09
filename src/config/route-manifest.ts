export type AppContextKey = 'short-rent' | 'long-rent' | 'admin';

export interface RouteManifestEntry {
  path: string;
  context: AppContextKey;
  requiredPermissions: string[];
  navLabel?: string;
  icon?: string;
  isDefault?: boolean;
  component: () => Promise<{ default: React.ComponentType }>;
  legacyPaths?: string[];
}

export const ROUTE_MANIFEST: RouteManifestEntry[] = [
  {
    path: '/app/short-rent',
    context: 'short-rent',
    requiredPermissions: [],
    navLabel: 'Dashboard',
    icon: 'LayoutDashboard',
    isDefault: true,
    component: async () => ({ default: (await import('@/features/dashboard/dashboard-page')).DashboardPage }),
    legacyPaths: ['/', '/app/short-rent/'],
  },
  {
    path: '/app/short-rent/properties',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navLabel: 'Proprietà',
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
    navLabel: 'Piano',
    icon: 'CreditCard',
    component: async () => ({
      default: (await import('@/features/settings/plan-settings-page')).PlanSettingsPage,
    }),
  },
  {
    path: '/app/short-rent/bookings',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navLabel: 'Prenotazioni',
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
    navLabel: 'Calendario',
    icon: 'CalendarDays',
    component: async () => ({ default: (await import('@/features/bookings/calendar-page')).CalendarPage }),
    legacyPaths: ['/bookings/calendar'],
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
    navLabel: 'Pagamenti',
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
    navLabel: 'Ricavi',
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
    navLabel: 'OTA',
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
    navLabel: 'Profilo',
    icon: 'User',
    component: async () => ({ default: (await import('@/features/profile/profile-page')).ProfilePage }),
    legacyPaths: ['/profile'],
  },
  {
    path: '/app/long-rent/leases',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    navLabel: 'Contratti',
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
    navLabel: 'Profilo',
    icon: 'User',
    component: async () => ({ default: (await import('@/features/profile/profile-content-page')).ProfileContentPage }),
    legacyPaths: ['/profile'],
  },
  {
    path: '/app/admin',
    context: 'admin',
    requiredPermissions: ['admin.stats.read'],
    navLabel: 'Dashboard',
    icon: 'LayoutDashboard',
    isDefault: true,
    component: async () => ({ default: (await import('@/features/admin/admin-dashboard-page')).AdminDashboardPage }),
    legacyPaths: ['/admin'],
  },
  {
    path: '/app/admin/users',
    context: 'admin',
    requiredPermissions: ['admin.users.read'],
    navLabel: 'Utenti',
    icon: 'Users',
    component: async () => ({ default: (await import('@/features/admin/admin-users-page')).AdminUsersPage }),
    legacyPaths: ['/admin/users'],
  },
  {
    path: '/app/admin/cin',
    context: 'admin',
    requiredPermissions: ['admin.cin.read'],
    navLabel: 'CIN',
    icon: 'FileCheck',
    component: async () => ({ default: (await import('@/features/admin/admin-cin-page')).AdminCinPage }),
    legacyPaths: ['/admin/cin'],
  },
  {
    path: '/app/admin/jobs',
    context: 'admin',
    requiredPermissions: ['admin.jobs.read'],
    navLabel: 'Job',
    icon: 'Settings',
    component: async () => ({ default: (await import('@/features/admin/admin-jobs-page')).AdminJobsPage }),
    legacyPaths: ['/admin/jobs'],
  },
];

export function getDefaultRoute(contextKey: AppContextKey): string {
  return ROUTE_MANIFEST.find((entry) => entry.context === contextKey && entry.isDefault)?.path ?? '/app/choose-context';
}

export function getNavEntries(contextKey: AppContextKey): RouteManifestEntry[] {
  return ROUTE_MANIFEST.filter((entry) => entry.context === contextKey && !!entry.navLabel);
}

export function getManifestEntry(path: string): RouteManifestEntry | undefined {
  return ROUTE_MANIFEST.find((entry) => entry.path === path);
}
