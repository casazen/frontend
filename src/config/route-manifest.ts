import { isFeatureEnabled, type FeatureFlagKey, type FeatureFlags } from './feature-flags';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';

export type AppContextKey = 'short-rent' | 'long-rent' | 'admin' | 'supplier';

/**
 * Group of the main menu (UI-04a): a labelled set of primary entries. The groups of an area follow the order of their
 * entries (`navOrder`); the labels are `nav.group.<group>`. The entries of "Altro" have no group.
 */
export type NavGroup = 'everyday' | 'offer' | 'management' | 'portfolio' | 'work' | 'activity' | 'platform';

/**
 * Where an entry shows: `primary` in the main menu (at most {@link MAX_PRIMARY_NAV_ENTRIES} per area), `secondary` in
 * "Altro". An entry with neither a placement nor a {@link RouteManifestEntry.navParent} is in no menu.
 */
export type NavPlacement = 'primary' | 'secondary';

/** The light queries that give a menu entry its counter ({@link RouteManifestEntry.navCount}); see `useNavCounts`. */
export type NavCountKey = 'bookingRequests' | 'supplierRequests';

/** The main menu of an area never has more primary entries than this: the rest goes to "Altro" (UI-04a). */
export const MAX_PRIMARY_NAV_ENTRIES = 7;

/** The bottom bar of the phone has at most this many destinations, "Altro" apart (UI-04a/UI-04b). */
export const MAX_BOTTOM_NAV_ENTRIES = 4;

export interface RouteManifestEntry {
  path: string;
  context: AppContextKey;
  requiredPermissions: string[];
  navKey?: string;
  /** Italian nav label when navKey i18n entry is not used */
  navLabel?: string;
  /** Group of a primary entry in the main menu. */
  navGroup?: NavGroup;
  navPlacement?: NavPlacement;
  /** Order in the menu of the area: primary entries first (the groups follow the entries), then "Altro". */
  navOrder?: number;
  icon?: string;
  /**
   * `path` of the menu entry this page belongs to (UI-04a). The page is in no menu: while it is open the entry it hangs
   * from is the highlighted one, and the page of that entry links to it (`NavChildLinks`). A page that hangs from an
   * entry the user cannot open takes a place in "Altro" itself, so no page the user may open is left without a way in.
   */
  navParent?: string;
  /** Place (1..{@link MAX_BOTTOM_NAV_ENTRIES}) of a primary entry in the bottom bar of the phone (UI-04b draws the bar). */
  navBottom?: number;
  /** Counter shown next to the entry in the menu; read from a query the app already makes (`useNavCounts`). */
  navCount?: NavCountKey;
  isDefault?: boolean;
  component: () => Promise<{ default: React.ComponentType }>;
  legacyPaths?: string[];
  /** Backend feature flag: while off the entry is in no menu and its route redirects to the context home. */
  featureFlag?: FeatureFlagKey;
  /**
   * Plan and billing of the org (backend policy `OrgBillingAdmin`, TN-3): the entry is in the menu only for the org
   * billing administrator ({@link ORG_BILLING_ADMIN_PERMISSION}). The route stays reachable: the page itself tells
   * anyone else to contact the administrator (spec-saas-billing AC13).
   */
  orgBillingAdmin?: boolean;
}

export const ROUTE_MANIFEST: RouteManifestEntry[] = [
  {
    path: '/app/short-rent',
    context: 'short-rent',
    requiredPermissions: [],
    navKey: 'nav.dashboard',
    navGroup: 'everyday',
    navPlacement: 'primary',
    navOrder: 1,
    navBottom: 1,
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
    navGroup: 'offer',
    navPlacement: 'primary',
    navOrder: 4,
    navBottom: 4,
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
    path: '/app/short-rent/properties/:id/activation',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    component: async () => ({
      default: (await import('@/features/compliance/activation-wizard')).PropertyActivationWizard,
    }),
    legacyPaths: ['/properties/:id/activation'],
  },
  {
    path: '/app/short-rent/properties/:id/pricing',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    component: async () => ({ default: (await import('@/features/pricing')).PricingDashboardPage }),
    legacyPaths: ['/properties/:id/pricing'],
  },
  {
    // What the host still has to do (CIN, check-ins, Alloggiati, cleanings); the Alloggiati dashboard and the CIN page hang from it.
    path: '/app/short-rent/compliance',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.compliance',
    navPlacement: 'secondary',
    navOrder: 21,
    icon: 'ClipboardCheck',
    component: async () => ({
      default: (await import('@/features/compliance/compliance-summary-page')).ComplianceSummaryPage,
    }),
  },
  {
    path: '/app/short-rent/fiscal',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.fiscal',
    navPlacement: 'secondary',
    navOrder: 23,
    icon: 'FileText',
    component: async () => ({
      default: (await import('@/features/fiscal/fiscal-dashboard-page')).FiscalDashboardPage,
    }),
  },
  {
    path: '/app/short-rent/fiscal/wizard',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    component: async () => ({
      default: (await import('@/features/fiscal/fiscal-wizard-page')).FiscalWizardPage,
    }),
  },
  {
    path: '/app/short-rent/fiscal/reports',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    component: async () => ({
      default: (await import('@/features/fiscal/fiscal-reports-page')).FiscalReportsPage,
    }),
  },
  {
    path: '/app/short-rent/settings/domain',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    navKey: 'nav.domain',
    navPlacement: 'secondary',
    navOrder: 32,
    icon: 'Globe',
    component: async () => ({
      default: (await import('@/features/settings/domain/custom-domain-settings-page')).CustomDomainSettingsPage,
    }),
  },
  {
    // Plans and Stripe checkout; also the return page of the checkout and of the billing portal (backend PL-11). In no
    // menu since UI-04a: the org badge of the header leads here (`usePlanPagePath`) and the page links to the billing one.
    path: '/app/short-rent/settings/plan',
    context: 'short-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.plan',
    component: async () => ({
      default: (await import('@/features/billing/plans-page')).PlansPage,
    }),
  },
  {
    // In no menu since UI-04a: the plan page links to it (and the org badge to the plan page).
    path: '/app/short-rent/settings/billing',
    context: 'short-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.billing',
    component: async () => ({
      default: (await import('@/features/billing/billing-settings-page')).BillingSettingsPage,
    }),
  },
  {
    // Org identity: name, public slug and contact email opt-in (A1-22, A1-23).
    path: '/app/short-rent/settings/organization',
    context: 'short-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.organization',
    navPlacement: 'secondary',
    navOrder: 33,
    icon: 'Settings',
    component: async () => ({
      default: (await import('@/features/settings/organization/organization-settings-page')).OrganizationSettingsPage,
    }),
  },
  {
    // Public-site branding: logo, hero, color, tagline, theme (BK-12, A3-17). Short-rent only: it is the booking site.
    path: '/app/short-rent/settings/site-appearance',
    context: 'short-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.siteAppearance',
    navParent: '/app/short-rent/vetrina',
    navOrder: 1,
    icon: 'Palette',
    component: async () => ({
      default: (await import('@/features/settings/site-appearance/site-appearance-page')).SiteAppearancePage,
    }),
  },
  {
    // The host's own privacy notice and booking terms, shown on the public site (BK-14, A3-21). Short-rent only.
    path: '/app/short-rent/settings/site-documents',
    context: 'short-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.siteDocuments',
    navParent: '/app/short-rent/vetrina',
    navOrder: 2,
    icon: 'FileText',
    component: async () => ({
      default: (await import('@/features/settings/site-documents/site-documents-page')).SiteDocumentsPage,
    }),
  },
  {
    path: '/app/short-rent/settings/payments',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    navKey: 'nav.stripeConnect',
    navPlacement: 'secondary',
    navOrder: 31,
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
    navGroup: 'everyday',
    navPlacement: 'primary',
    navOrder: 3,
    navBottom: 3,
    // "Pay at the property" requests waiting for the host's answer (the query of the requests panel of this page).
    navCount: 'bookingRequests',
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
    navGroup: 'everyday',
    navPlacement: 'primary',
    navOrder: 2,
    navBottom: 2,
    icon: 'CalendarDays',
    component: async () => ({ default: (await import('@/features/bookings/calendar-page')).CalendarPage }),
    legacyPaths: ['/bookings/calendar'],
  },
  {
    path: '/app/short-rent/bookings/:id/checkout',
    context: 'short-rent',
    requiredPermissions: ['booking.write'],
    component: async () => ({
      default: (await import('@/features/compliance/checkout-wizard')).CheckoutWizardPage,
    }),
    legacyPaths: ['/bookings/:id/checkout'],
  },
  {
    path: '/app/short-rent/marketplace',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navKey: 'nav.marketplace',
    navGroup: 'offer',
    navPlacement: 'primary',
    navOrder: 6,
    icon: 'Store',
    component: async () => ({ default: (await import('@/features/marketplace/marketplace-page')).MarketplacePage }),
  },
  {
    path: '/app/short-rent/alloggiati',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navKey: 'nav.alloggiati',
    navParent: '/app/short-rent/compliance',
    navOrder: 1,
    icon: 'ShieldCheck',
    component: async () => ({
      default: (await import('@/features/alloggiati/alloggiati-dashboard-page')).AlloggiatiDashboardPage,
    }),
  },
  {
    path: '/app/short-rent/compliance/cin',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.cin',
    navParent: '/app/short-rent/compliance',
    navOrder: 2,
    icon: 'ShieldCheck',
    component: async () => ({
      default: (await import('@/features/cin')).CinCompliancePage,
    }),
    legacyPaths: ['/app/short-rent/cin', '/cin'],
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
    navGroup: 'management',
    navPlacement: 'primary',
    navOrder: 7,
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
    navPlacement: 'secondary',
    navOrder: 22,
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
    navPlacement: 'secondary',
    navOrder: 24,
    icon: 'Repeat',
    component: async () => ({ default: (await import('@/features/ota/ota-page')).OtaPage }),
    legacyPaths: ['/ota'],
    featureFlag: 'otaPartnerApi',
  },
  {
    path: '/app/short-rent/ota/create',
    context: 'short-rent',
    requiredPermissions: ['ota.write'],
    component: async () => ({ default: (await import('@/features/ota/ota-setup-page')).OtaSetupPage }),
    legacyPaths: ['/ota/create'],
    featureFlag: 'otaPartnerApi',
  },
  {
    path: '/app/short-rent/vetrina',
    context: 'short-rent',
    requiredPermissions: [],
    navKey: 'nav.directBooking',
    navGroup: 'offer',
    navPlacement: 'primary',
    navOrder: 5,
    icon: 'Globe',
    component: async () => ({ default: (await import('@/features/settings/vetrina-page')).VetrinaPage }),
  },
  {
    path: '/app/short-rent/profile',
    context: 'short-rent',
    requiredPermissions: [],
    navKey: 'nav.profile',
    navPlacement: 'secondary',
    navOrder: 30,
    icon: 'User',
    component: async () => ({ default: (await import('@/features/profile/profile-page')).ProfilePage }),
    legacyPaths: ['/profile'],
  },
  {
    path: '/app/long-rent/leases',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    navKey: 'nav.leases',
    navGroup: 'everyday',
    navPlacement: 'primary',
    navOrder: 1,
    navBottom: 1,
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
  // Long-term landlord's properties and their APE (A7-06): the property core only, never the short-stay pages.
  {
    path: '/app/long-rent/properties',
    context: 'long-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.properties',
    navGroup: 'portfolio',
    navPlacement: 'primary',
    navOrder: 2,
    navBottom: 2,
    icon: 'Home',
    component: async () => ({
      default: (await import('@/features/properties/long-rent')).LongRentPropertiesPage,
    }),
  },
  {
    path: '/app/long-rent/properties/new',
    context: 'long-rent',
    requiredPermissions: ['property.write'],
    component: async () => ({
      default: (await import('@/features/properties/long-rent')).LongRentPropertyCreatePage,
    }),
  },
  {
    path: '/app/long-rent/properties/:id',
    context: 'long-rent',
    requiredPermissions: ['property.read'],
    component: async () => ({
      default: (await import('@/features/properties/long-rent')).LongRentPropertyDetailPage,
    }),
  },
  {
    path: '/app/long-rent/properties/:id/edit',
    context: 'long-rent',
    requiredPermissions: ['property.write'],
    component: async () => ({
      default: (await import('@/features/properties/long-rent')).LongRentPropertyEditPage,
    }),
  },
  {
    path: '/app/long-rent/profile',
    context: 'long-rent',
    requiredPermissions: [],
    navKey: 'nav.profile',
    navPlacement: 'secondary',
    navOrder: 30,
    icon: 'User',
    component: async () => ({ default: (await import('@/features/profile/profile-content-page')).ProfileContentPage }),
    legacyPaths: ['/profile'],
  },
  // Plan and billing of the org for a landlord with only long-term leases (PL-16, A1-36): same pages as in short-rent,
  // inside the long-rent shell; also the Stripe return pages of a checkout or portal started here. In no menu since
  // UI-04a (the org badge of the header leads to the plan page, which links to the billing one).
  {
    path: '/app/long-rent/settings/plan',
    context: 'long-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.plan',
    component: async () => ({
      default: (await import('@/features/billing/plans-page')).PlansPageContent,
    }),
  },
  {
    path: '/app/long-rent/settings/billing',
    context: 'long-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.billing',
    component: async () => ({
      default: (await import('@/features/billing/billing-settings-page')).BillingSettingsContent,
    }),
  },
  // Org identity: same page as in short-rent (A1-22, A1-23), inside the long-rent shell.
  {
    path: '/app/long-rent/settings/organization',
    context: 'long-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.organization',
    navPlacement: 'secondary',
    navOrder: 33,
    icon: 'Settings',
    component: async () => ({
      default: (await import('@/features/settings/organization/organization-settings-page')).OrganizationSettingsContent,
    }),
  },
  {
    path: '/app/admin',
    context: 'admin',
    requiredPermissions: ['admin.stats.read'],
    navKey: 'nav.dashboard',
    navGroup: 'platform',
    navPlacement: 'primary',
    navOrder: 1,
    navBottom: 1,
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
    navGroup: 'platform',
    navPlacement: 'primary',
    navOrder: 2,
    navBottom: 2,
    icon: 'Users',
    component: async () => ({ default: (await import('@/features/admin/admin-users-page')).AdminUsersPage }),
    legacyPaths: ['/admin/users'],
  },
  {
    path: '/app/admin/profile',
    context: 'admin',
    requiredPermissions: ['admin.users.read'],
    navKey: 'nav.profile',
    navPlacement: 'secondary',
    navOrder: 30,
    icon: 'User',
    component: async () => ({ default: (await import('@/features/admin/admin-profile-page')).AdminProfilePage }),
  },
  {
    path: '/app/admin/suppliers',
    context: 'admin',
    requiredPermissions: ['admin.users.manage'],
    navKey: 'nav.suppliers',
    navGroup: 'platform',
    navPlacement: 'primary',
    navOrder: 3,
    navBottom: 3,
    icon: 'Store',
    component: async () => ({ default: (await import('@/features/admin/admin-suppliers-page')).AdminSuppliersPage }),
  },
  {
    path: '/app/admin/suppliers/invite',
    context: 'admin',
    requiredPermissions: ['admin.users.manage'],
    navKey: 'nav.inviteSupplier',
    navPlacement: 'secondary',
    navOrder: 21,
    icon: 'UserPlus',
    component: async () => ({ default: (await import('@/features/admin/admin-supplier-invite-page')).AdminSupplierInvitePage }),
    legacyPaths: ['/admin/suppliers/invite'],
  },
  {
    path: '/app/admin/jobs',
    context: 'admin',
    requiredPermissions: ['admin.jobs.read'],
    navKey: 'nav.jobs',
    navGroup: 'platform',
    navPlacement: 'primary',
    navOrder: 4,
    navBottom: 4,
    icon: 'Settings',
    component: async () => ({ default: (await import('@/features/admin/admin-jobs-page')).AdminJobsPage }),
    legacyPaths: ['/admin/jobs'],
  },
  {
    path: '/app/admin/seo',
    context: 'admin',
    requiredPermissions: ['admin.seo.read'],
    navKey: 'nav.seo',
    navGroup: 'platform',
    navPlacement: 'primary',
    navOrder: 5,
    icon: 'Globe',
    component: async () => ({ default: (await import('@/features/admin/seo-dashboard-page')).SeoDashboardPage }),
    legacyPaths: ['/admin/seo'],
  },
  // Marketing section (SE-03): surfaces existing tracking data (signup attributions, top-converting comuni).
  {
    path: '/app/admin/marketing',
    context: 'admin',
    requiredPermissions: ['admin.seo.read'],
    navKey: 'nav.marketing',
    navGroup: 'platform',
    navPlacement: 'primary',
    navOrder: 6,
    icon: 'TrendingUp',
    component: async () => ({ default: (await import('@/features/admin/marketing-page')).MarketingPage }),
    legacyPaths: ['/admin/marketing'],
  },
  // Guests
  {
    path: '/app/short-rent/guests',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navKey: 'nav.guests',
    navPlacement: 'secondary',
    navOrder: 20,
    icon: 'Users',
    component: async () => ({ default: (await import('@/features/guests/guests-page')).GuestsPage }),
  },
  {
    path: '/app/short-rent/guests/:id',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    component: async () => ({ default: (await import('@/features/guests/guest-detail-page')).GuestDetailPage }),
  },
  // Admin CIN audit (A1-16): platform-wide CIN compliance report, unreachable until this route existed. The menu entry
  // is "Conformità" (UI-04a): the tax rates and the LTR reference data hang from it and its page links to them.
  {
    path: '/app/admin/cin',
    context: 'admin',
    requiredPermissions: ['admin.cin.read'],
    navKey: 'nav.complianceAudit',
    navGroup: 'platform',
    navPlacement: 'primary',
    navOrder: 6,
    icon: 'BadgeCheck',
    component: async () => ({ default: (await import('@/features/admin/admin-cin-page')).AdminCinPage }),
    // The old /admin/cin URL was the admin audit, not the host CIN page: it must land here (A1-16).
    legacyPaths: ['/admin/cin'],
  },
  // Admin Tax Rates
  {
    path: '/app/admin/compliance/tax-rates',
    context: 'admin',
    requiredPermissions: ['admin.cin.read'],
    navKey: 'nav.taxRates',
    navParent: '/app/admin/cin',
    navOrder: 1,
    icon: 'Coins',
    component: async () => ({ default: (await import('@/features/admin/admin-tax-rates-page')).AdminTaxRatesPage }),
    legacyPaths: ['/app/admin/tourist-tax', '/admin/tourist-tax'],
  },
  // Admin LTR reference data (LT-13, A7-22): territorial agreements and comune IMU channels.
  {
    path: '/app/admin/compliance/ltr-reference-data',
    context: 'admin',
    requiredPermissions: ['admin.ltr.manage'],
    navKey: 'nav.ltrReferenceData',
    navParent: '/app/admin/cin',
    navOrder: 2,
    icon: 'FileText',
    component: async () => ({
      default: (await import('@/features/admin/admin-ltr-reference-data-page')).AdminLtrReferenceDataPage,
    }),
  },
  // ============================================================
  // Supplier console
  // ============================================================
  {
    path: '/app/supplier/activation',
    context: 'supplier',
    requiredPermissions: [],
    component: async () => ({ default: (await import('@/features/supplier/supplier-activation-page')).SupplierActivationPage }),
  },
  {
    path: '/app/supplier/dashboard',
    context: 'supplier',
    requiredPermissions: [],
    navKey: 'nav.supplierDashboard',
    navGroup: 'work',
    navPlacement: 'primary',
    navOrder: 1,
    navBottom: 1,
    icon: 'LayoutDashboard',
    isDefault: true,
    component: async () => ({ default: (await import('@/features/supplier/supplier-dashboard-page')).SupplierDashboardPage }),
  },
  {
    // The iCal feed of the supplier: part of the availability (UI-04a), whose page links to it.
    path: '/app/supplier/calendar',
    context: 'supplier',
    requiredPermissions: [],
    navKey: 'nav.supplierCalendar',
    navParent: '/app/supplier/availability',
    navOrder: 1,
    icon: 'Calendar',
    component: async () => ({ default: (await import('@/features/supplier/supplier-calendar-sync-page')).SupplierCalendarSyncPage }),
  },
  {
    path: '/app/supplier/profile',
    context: 'supplier',
    requiredPermissions: [],
    navKey: 'nav.profile',
    navPlacement: 'secondary',
    navOrder: 30,
    icon: 'User',
    component: async () => ({ default: (await import('@/features/supplier/supplier-profile-page')).SupplierProfilePage }),
  },
  {
    path: '/app/supplier/inbox',
    context: 'supplier',
    requiredPermissions: [],
    navKey: 'nav.supplierInbox',
    navGroup: 'work',
    navPlacement: 'primary',
    navOrder: 2,
    navBottom: 2,
    // Requests waiting for the supplier's answer (`awaitingAcceptance` of the KPIs of the dashboard).
    navCount: 'supplierRequests',
    icon: 'Inbox',
    component: async () => ({ default: (await import('@/features/supplier/supplier-inbox-page')).SupplierInboxPage }),
  },
  {
    // Detail of one request: where, when, host contact after the take, actions and history (SU-08, A4-14).
    path: '/app/supplier/inbox/:id',
    context: 'supplier',
    requiredPermissions: [],
    component: async () => ({
      default: (await import('@/features/supplier/supplier-request-detail-page')).SupplierRequestDetailPage,
    }),
  },
  {
    path: '/app/supplier/availability',
    context: 'supplier',
    requiredPermissions: [],
    navKey: 'nav.supplierAvailability',
    navGroup: 'work',
    navPlacement: 'primary',
    navOrder: 3,
    navBottom: 3,
    icon: 'CalendarCheck',
    component: async () => ({ default: (await import('@/features/supplier/supplier-availability-page')).SupplierAvailabilityPage }),
  },
  {
    // Preview of the public showcase and where it is published (SU-13, A4-16).
    path: '/app/supplier/showcase',
    context: 'supplier',
    requiredPermissions: [],
    navKey: 'nav.supplierShowcase',
    navGroup: 'activity',
    navPlacement: 'primary',
    navOrder: 4,
    navBottom: 4,
    icon: 'Store',
    component: async () => ({ default: (await import('@/features/supplier/supplier-showcase-preview-page')).SupplierShowcasePreviewPage }),
  },
  {
    // Help page for connecting an external calendar via iCal (SU-15), moved inside the supplier shell with its own
    // sidebar entry (A4-32, #327-AC2/AC4). The public `/help/ical` route stays for the host property iCal settings
    // page, which links the same component from outside the supplier context.
    path: '/app/supplier/help/ical',
    context: 'supplier',
    requiredPermissions: [],
    navKey: 'nav.supplierHelpIcal',
    navPlacement: 'secondary',
    navOrder: 31,
    icon: 'HelpCircle',
    component: async () => ({ default: (await import('@/features/supplier/ical-help-page')).IcalHelpPage }),
  },
];

export type PermissionPredicate = (contextKey: AppContextKey, permission: string) => boolean;

/** Entries behind a feature flag need the flag on; without flags (not loaded) they are hidden. */
export function isEntryFeatureEnabled(entry: RouteManifestEntry, features?: Partial<FeatureFlags>): boolean {
  return !entry.featureFlag || isFeatureEnabled(features, entry.featureFlag);
}

/** True when the user passes every permission the entry asks (and the org billing administrator one when it needs it). */
export function hasEntryPermission(
  entry: RouteManifestEntry,
  hasPermission?: PermissionPredicate,
): boolean {
  if (!hasPermission) return true;
  if (entry.orgBillingAdmin && !hasPermission(entry.context, ORG_BILLING_ADMIN_PERMISSION)) return false;
  return entry.requiredPermissions.every((permission) =>
    hasPermission(entry.context, permission),
  );
}

export function getDefaultRoute(contextKey: AppContextKey): string {
  if (contextKey === 'supplier') {
    return '/app/supplier/dashboard';
  }
  return ROUTE_MANIFEST.find((entry) => entry.context === contextKey && entry.isDefault)?.path ?? '/app/choose-context';
}

/** True when the user may open the page: permissions, and the feature flag when the page has one. */
function isEntryAvailable(
  entry: RouteManifestEntry,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
): boolean {
  return hasEntryPermission(entry, hasPermission) && isEntryFeatureEnabled(entry, features);
}

const PLACEMENT_RANK: Record<NavPlacement, number> = { primary: 0, secondary: 1 };

function placementRank(entry: RouteManifestEntry): number {
  return PLACEMENT_RANK[entry.navPlacement ?? 'secondary'];
}

function byNavOrder(a: RouteManifestEntry, b: RouteManifestEntry): number {
  return (a.navOrder ?? 99) - (b.navOrder ?? 99);
}

/** Menu order: the main menu first, then "Altro"; inside each, by `navOrder`. */
function byMenuOrder(a: RouteManifestEntry, b: RouteManifestEntry): number {
  return placementRank(a) - placementRank(b) || byNavOrder(a, b);
}

interface ContextNavEntries {
  /** What the menus show, in menu order. */
  menu: RouteManifestEntry[];
  /** The pages the user may open that hang from an entry of the menu: in no menu, they highlight that entry. */
  hanging: RouteManifestEntry[];
}

/**
 * The navigation of an area for a user: the entries of the menus and the pages that hang from them. A page that hangs
 * from an entry the user cannot open (no permission, flag off) is not left without a way in: it takes a place in "Altro"
 * itself (a copy of the entry with the placement `secondary`).
 */
function resolveNavEntries(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
): ContextNavEntries {
  const available = ROUTE_MANIFEST.filter(
    (entry) =>
      entry.context === contextKey &&
      (entry.navPlacement !== undefined || entry.navParent !== undefined) &&
      isEntryAvailable(entry, hasPermission, features),
  );
  const menuPaths = new Set(available.filter((entry) => entry.navPlacement !== undefined).map((entry) => entry.path));

  const menu: RouteManifestEntry[] = [];
  const hanging: RouteManifestEntry[] = [];
  for (const entry of available) {
    if (entry.navPlacement !== undefined) menu.push(entry);
    else if (entry.navParent !== undefined && menuPaths.has(entry.navParent)) hanging.push(entry);
    else menu.push({ ...entry, navPlacement: 'secondary' });
  }
  return { menu: menu.sort(byMenuOrder), hanging: hanging.sort(byNavOrder) };
}

/** The entries of the menus of an area that the user may open, in menu order (main menu first, then "Altro"). */
export function getVisibleNavEntries(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
): RouteManifestEntry[] {
  return resolveNavEntries(contextKey, hasPermission, features).menu;
}

export function getPrimaryNavEntries(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
): RouteManifestEntry[] {
  return getVisibleNavEntries(contextKey, hasPermission, features).filter(
    (entry) => entry.navPlacement === 'primary',
  );
}

/** The entries of "Altro". */
export function getSecondaryNavEntries(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
): RouteManifestEntry[] {
  return getVisibleNavEntries(contextKey, hasPermission, features).filter(
    (entry) => entry.navPlacement === 'secondary',
  );
}

/** The destinations of the bottom bar of the phone, in bar order (at most {@link MAX_BOTTOM_NAV_ENTRIES}). */
export function getBottomNavEntries(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
): RouteManifestEntry[] {
  return getVisibleNavEntries(contextKey, hasPermission, features)
    .filter((entry) => entry.navBottom !== undefined)
    .sort((a, b) => (a.navBottom ?? 0) - (b.navBottom ?? 0));
}

/**
 * The pages that hang from the entry at `parentPath` and that the user may open, in order: what the page of the entry
 * links to, since they are in no menu.
 */
export function getNavChildren(
  parentPath: string,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
): RouteManifestEntry[] {
  return ROUTE_MANIFEST.filter(
    (entry) => entry.navParent === parentPath && isEntryAvailable(entry, hasPermission, features),
  ).sort(byNavOrder);
}

/**
 * The entries among which the one that is open is looked for (`resolveActiveNavEntry`): those of the menus and the pages
 * that hang from them, which stand for their parent.
 */
export function getNavMatchEntries(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
): RouteManifestEntry[] {
  const { menu, hanging } = resolveNavEntries(contextKey, hasPermission, features);
  return [...menu, ...hanging];
}

export interface NavSection {
  group: NavGroup;
  entries: RouteManifestEntry[];
}

export interface ContextNav {
  /** The main menu: labelled groups of primary entries, in the order of their entries. */
  sections: NavSection[];
  /** "Altro". */
  more: RouteManifestEntry[];
}

/**
 * The menu of an area for the sidebar and the phone menu. With `withoutBottom` the destinations of the bottom bar are
 * left out (the phone menu lists only what the bar does not).
 */
export function getContextNav(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
  options: { withoutBottom?: boolean } = {},
): ContextNav {
  const sections: NavSection[] = [];
  const more: RouteManifestEntry[] = [];
  for (const entry of getVisibleNavEntries(contextKey, hasPermission, features)) {
    if (options.withoutBottom && entry.navBottom !== undefined) continue;
    if (entry.navPlacement !== 'primary') {
      more.push(entry);
      continue;
    }
    const group = entry.navGroup ?? 'everyday';
    const section = sections.find((candidate) => candidate.group === group);
    if (section) section.entries.push(entry);
    else sections.push({ group, entries: [entry] });
  }
  return { sections, more };
}

export function getManifestEntry(path: string): RouteManifestEntry | undefined {
  return ROUTE_MANIFEST.find((entry) => entry.path === path);
}

/**
 * The same plan or billing page in the other contexts (PL-16), e.g. `/app/long-rent/settings/plan` for
 * `/app/short-rent/settings/plan`: where a user who opens the page of a context it does not work in (an old link, a
 * Stripe return page) is sent. Empty for any other entry.
 */
export function getOrgBillingPageAlternates(entry: RouteManifestEntry): Partial<Record<AppContextKey, string>> {
  if (!entry.orgBillingAdmin) return {};
  const suffix = entry.path.slice(`/app/${entry.context}`.length);
  const alternates: Partial<Record<AppContextKey, string>> = {};
  for (const other of ROUTE_MANIFEST) {
    if (other.orgBillingAdmin && other.context !== entry.context && other.path === `/app/${other.context}${suffix}`) {
      alternates[other.context] = other.path;
    }
  }
  return alternates;
}
