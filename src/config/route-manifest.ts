import { isFeatureEnabled, type FeatureFlagKey, type FeatureFlags } from './feature-flags';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';

/**
 * The areas of the app. `account` is the customer's "Amministrazione" (decision D1): its context exists only for the people of
 * an org (owner, administrators, property managers, accountants: the backend sends it in `GET /api/me/contexts`), never from a
 * JWT role. `admin` is the staff console of the platform.
 */
export type AppContextKey = 'short-rent' | 'long-rent' | 'admin' | 'supplier' | 'account';

/**
 * Group of the main menu (UI-04a): a labelled set of primary entries. The groups of an area follow the order of their
 * entries (`navOrder`); the labels are `nav.group.<group>`. The entries of "Altro" have no group.
 */
export type NavGroup = 'everyday' | 'offer' | 'management' | 'portfolio' | 'work' | 'activity' | 'platform' | 'account';

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
  /**
   * A shorter name for the bottom bar, when the name of the menu does not fit a column of it (about 67 px at 360 px, in 11 px type):
   * the bar shows this one and the link keeps the full name for a screen reader. Not for an entry that has a counter (its name and
   * its counter are read together).
   */
  navBarKey?: string;
  /** Counter shown next to the entry in the menu; read from a query the app already makes (`useNavCounts`). */
  navCount?: NavCountKey;
  isDefault?: boolean;
  /**
   * The page at the bare address of its area (the Panoramica of Affitti lunghi, LR-05), for a role that cannot open it because it asks
   * for a permission the role lacks: the address opens the first page of the area the role can open, as the bare address did when
   * it only redirected (UI-00), instead of the reserved page.
   */
  homeWhenDenied?: boolean;
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
    // "Cambia modalità" (PM-03, D16): the wizard that programs the passage to long-term leases, from the page of the property
    // (menu "⋯"). The same wizard has its route in long-rent; the one of the section the property is in opens it.
    path: '/app/short-rent/properties/:id/mode',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    component: async () => ({
      default: (await import('@/features/properties/mode/property-mode-wizard-page')).ShortRentPropertyModePage,
    }),
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
    // The reports of short rent (SR-10): revenue, occupancy and bookings by channel to download, the fiscal ones as the fiscal page
    // has them, and the pages that already hold the rest (Alloggiati, payments). For who may read payments (aggregated money):
    // the others find the reserved page. In "Altro" with Ricavi and Regime fiscale: the main menu holds seven entries at most.
    path: '/app/short-rent/reports',
    context: 'short-rent',
    requiredPermissions: ['payment.read'],
    navKey: 'nav.reports',
    navPlacement: 'secondary',
    navOrder: 25,
    icon: 'TrendingUp',
    component: async () => ({ default: (await import('@/features/reports/reports-page')).ReportsPage }),
  },
  {
    // The reviews of the host's properties (DB-12b): the guests' reviews of the stays booked on the site, newest first, with the one
    // answer of the host and the report to CasaZen. In "Altro" next to the reports: the main menu holds seven entries at most.
    path: '/app/short-rent/reviews',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navKey: 'nav.reviews',
    navPlacement: 'secondary',
    navOrder: 26,
    icon: 'Star',
    component: async () => ({ default: (await import('@/features/reviews/host-reviews-page')).HostReviewsPage }),
  },
  {
    // The calendars of all the properties in one list (SR-10b): the channel, when each was last read, what needs a look and "Sincronizza ora";
    // "Collega" leads to the tab Calendari of the property, where calendars are linked. In "Altro" next to the reviews: the main menu holds
    // seven entries at most. Who may read the properties sees the state; only who may write them gets the buttons.
    path: '/app/short-rent/channels',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.channels',
    navPlacement: 'secondary',
    navOrder: 27,
    icon: 'CalendarSync',
    component: async () => ({ default: (await import('@/features/channels/channels-page')).ChannelsPage }),
  },
  {
    // Biometric verification queue (NF-12): operator verifications pending decision.
    path: '/app/short-rent/verifications',
    context: 'short-rent',
    requiredPermissions: ['verification.decide'],
    navKey: 'nav.verifications',
    navPlacement: 'secondary',
    navOrder: 28,
    icon: 'ShieldCheck',
    component: async () => ({ default: (await import('@/pages/VerificationQueuePage')).VerificationQueuePage }),
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
    // A host recommends CasaZen to a friend: any member of a host org, whatever the role (backend policy `SharedPropertyRead`, held by every
    // host role). Daily quota per org. No role is assigned: the invited person signs up as usual.
    path: '/app/short-rent/settings/invitations',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.hostInvites',
    navPlacement: 'secondary',
    navOrder: 34,
    icon: 'UserPlus',
    component: async () => ({
      default: (await import('@/features/invites/host-invites-page')).HostInvitesPage,
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
    path: '/app/short-rent/alloggiati/reports',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navKey: 'alloggiati.reports',
    navParent: '/app/short-rent/compliance',
    navOrder: 1.5,
    icon: 'ShieldCheck',
    component: async () => ({ default: (await import('@/pages/AlloggiatiPage')).AlloggiatiPage }),
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
    // Panoramica (LR-05): the home of the area, at its bare address. "Adesso" (the step of the landlord that cannot wait), the leases by
    // group, the rent of the month and the next dates. Reading it asks what the leases ask; a role that cannot read them opens the
    // first page of the area it can open instead of the reserved page (`homeWhenDenied`), as the bare address did before.
    path: '/app/long-rent',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    navKey: 'nav.longRentOverview',
    navGroup: 'everyday',
    navPlacement: 'primary',
    navOrder: 1,
    navBottom: 1,
    icon: 'LayoutDashboard',
    isDefault: true,
    homeWhenDenied: true,
    component: async () => ({
      default: (await import('@/features/leases/overview/long-rent-overview-page')).LongRentOverviewPage,
    }),
  },
  {
    path: '/app/long-rent/leases',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    navKey: 'nav.leases',
    navGroup: 'everyday',
    navPlacement: 'primary',
    navOrder: 2,
    navBottom: 2,
    icon: 'FileText',
    component: async () => ({ default: (await import('@/features/leases')).LeasesPage }),
    legacyPaths: ['/leases'],
  },
  {
    // Canoni (LR-04b): the rent register of the month, next to the leases it comes from. Reading it asks what the leases ask.
    path: '/app/long-rent/rents',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    navKey: 'nav.rents',
    navGroup: 'everyday',
    navPlacement: 'primary',
    navOrder: 3,
    navBottom: 3,
    icon: 'Wallet',
    component: async () => ({ default: (await import('@/features/leases')).RentsPage }),
  },
  {
    // Scadenze (LR-05): the agenda of the dates not to miss, month by month. In "Altro", first: the main menu holds the four places of
    // the bar of the phone, and the overview links here. Reading it asks what the leases ask.
    path: '/app/long-rent/deadlines',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    navKey: 'nav.longRentDeadlines',
    navPlacement: 'secondary',
    navOrder: 19,
    icon: 'CalendarDays',
    component: async () => ({
      default: (await import('@/features/leases/deadlines/long-rent-deadlines-page')).LongRentDeadlinesPage,
    }),
  },
  {
    path: '/app/long-rent/leases/new',
    context: 'long-rent',
    requiredPermissions: ['lease.create'],
    component: async () => ({ default: (await import('@/features/leases')).LeaseCreatePage }),
    legacyPaths: ['/leases/new'],
  },
  {
    path: '/app/long-rent/documents/upload',
    context: 'long-rent',
    requiredPermissions: ['lease.read', 'lease.create'],
    component: async () => ({ default: (await import('@/features/leases/lease-documents-upload-page')).LeaseDocumentsUploadPage }),
  },
  {
    path: '/app/long-rent/leases/:id',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    component: async () => ({ default: (await import('@/features/leases')).LeaseDetailPage }),
    legacyPaths: ['/leases/:id'],
  },
  {
    // «Continua il contratto» (LR-06a): the wizard on a draft that exists on the server, the same from any device. It reads the rules
    // of the area (`lease.read`) and writes the draft (`lease.create`).
    path: '/app/long-rent/leases/:id/edit',
    context: 'long-rent',
    requiredPermissions: ['lease.read', 'lease.create'],
    component: async () => ({ default: (await import('@/features/leases')).LeaseWizardPage }),
  },
  {
    // The page of payment of the guided contract of a canone concordato (NF-02, ADR-005-R12; CF-FLOW): the price, the steps and the way
    // in (pay, or the gift practice), reached from the sheet of the contract when the access is missing. Whoever has the access is sent
    // back to the sheet, which opens the form; the form opens from here only straight after the payment or the gift practice.
    path: '/app/long-rent/leases/:id/guided-contract',
    context: 'long-rent',
    requiredPermissions: ['lease.read', 'lease.create'],
    component: async () => ({
      default: (await import('@/pages/long-rent/leases/concordatofacile-offer-page')).ConcordatoFacileOfferPage,
    }),
  },
  {
    // The old address of the page above: the server still returns here from the Stripe checkout (`?checkout=success|cancelled`) and there
    // are bookmarks. It goes on to the new one, keeping the query.
    path: '/app/long-rent/leases/:id/concordatofacile',
    context: 'long-rent',
    requiredPermissions: ['lease.read', 'lease.create'],
    component: async () => ({
      default: (await import('@/pages/long-rent/leases/guided-contract-redirect')).GuidedContractRedirect,
    }),
  },
  // Long-term landlord's properties and their APE (A7-06): the property core only, never the short-stay pages.
  {
    path: '/app/long-rent/properties',
    context: 'long-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.properties',
    navGroup: 'portfolio',
    navPlacement: 'primary',
    navOrder: 4,
    navBottom: 4,
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
    // "Cambia modalità" (PM-03, D16): the passage back to short stays; the same wizard as `/app/short-rent/properties/:id/mode`.
    path: '/app/long-rent/properties/:id/mode',
    context: 'long-rent',
    requiredPermissions: ['property.write'],
    component: async () => ({
      default: (await import('@/features/properties/mode/property-mode-wizard-page')).LongRentPropertyModePage,
    }),
  },
  {
    // Interventi (LR-08b): the requests to the suppliers of the Portale for the properties let long term, from the request to the
    // payment. Reading them asks what reading the properties asks; asking for one and acting on it ask `property.write` (the page
    // hides the buttons from who may not). Fifth of the main menu: the bar of the phone holds four places, and since the Panoramica
    // (LR-05) is the first of them, Interventi is behind "Altro" on the phone.
    path: '/app/long-rent/service-requests',
    context: 'long-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.serviceRequests',
    navGroup: 'portfolio',
    navPlacement: 'primary',
    navOrder: 5,
    icon: 'Wrench',
    component: async () => ({
      default: (await import('@/features/service-requests/long-rent')).LongRentRequestsPage,
    }),
  },
  {
    path: '/app/long-rent/service-requests/:id',
    context: 'long-rent',
    requiredPermissions: ['property.read'],
    component: async () => ({
      default: (await import('@/features/service-requests/long-rent')).LongRentRequestDetailPage,
    }),
  },
  {
    // The fiscal report of the area (LR-11b): per lease, an estimate for the accountant, with the file to download. For who may read
    // the leases; the others find the reserved page. In "Altro": the main menu holds the four places of the bar of the phone.
    path: '/app/long-rent/fiscal',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    navKey: 'nav.longRentFiscal',
    navPlacement: 'secondary',
    navOrder: 20,
    icon: 'Receipt',
    component: async () => ({ default: (await import('@/features/leases/fiscal/long-rent-fiscal-page')).LongRentFiscalPage }),
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
    path: '/app/long-rent/settings/invitations',
    context: 'long-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.hostInvites',
    navPlacement: 'secondary',
    navOrder: 34,
    icon: 'UserPlus',
    component: async () => ({
      default: (await import('@/features/invites/host-invites-page')).HostInvitesContent,
    }),
  },
  // Amministrazione of the customer (AM-04, decision D1). The pages come with their tasks; the menu shows only the pages that exist,
  // each with the permission the backend asks for it (`org.members.manage` for the owner and the administrators; the accountant and
  // the property manager hold other permissions of the context, so their first page is the first one they may open).
  {
    path: '/app/account',
    context: 'account',
    requiredPermissions: ['org.members.manage'],
    navKey: 'nav.accountHome',
    navGroup: 'account',
    navPlacement: 'primary',
    navOrder: 1,
    navBottom: 1,
    icon: 'LayoutDashboard',
    isDefault: true,
    component: async () => ({ default: (await import('@/features/account/account-home-page')).AccountHomePage }),
  },
  {
    // The people who work with the owner (AM-04b): the pages of the team ask for `org.members.manage`, like the home.
    path: '/app/account/people',
    context: 'account',
    requiredPermissions: ['org.members.manage'],
    navKey: 'nav.people',
    navGroup: 'account',
    navPlacement: 'primary',
    navOrder: 2,
    navBottom: 2,
    icon: 'Users',
    component: async () => ({ default: (await import('@/features/team/people-page')).PeoplePage }),
  },
  {
    // "Invita un utente" (AM-04c): the four steps that bring a person in, opened from «Invita» on the page of the people. It is in no menu:
    // «Persone» stays the highlighted entry and the trail goes through it, both by the start of the address.
    path: '/app/account/people/invite',
    context: 'account',
    requiredPermissions: ['org.members.manage'],
    component: async () => ({ default: (await import('@/features/team/invite/invite-page')).InvitePage }),
  },
  {
    // "Immobili" (AM-13): every property of the account, short-term and long-term, with who looks after it and who can open it. For the
    // owner and the administrators (`org.members.manage`, like the people): the pages of a property stay in the section of its mode.
    path: '/app/account/properties',
    context: 'account',
    requiredPermissions: ['org.members.manage'],
    navKey: 'nav.properties',
    navGroup: 'account',
    navPlacement: 'primary',
    navOrder: 3,
    navBottom: 3,
    icon: 'Home',
    component: async () => ({ default: (await import('@/features/account/properties/account-properties-page')).AccountPropertiesPage }),
  },
  {
    // Withholding tax management (ADR-018): withholding summary by month/owner/apartment, F24 preview and download,
    // and payment reconciliation. For org billing administrators who handle tax compliance.
    path: '/app/account/withholding',
    context: 'account',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.withholding',
    navGroup: 'account',
    navPlacement: 'primary',
    navOrder: 4,
    icon: 'FileText',
    component: async () => ({ default: (await import('@/pages/WithholdingPage')).WithholdingPage }),
  },
  {
    // "Fatturazione e piano" (AM-08a): the plan, how it is used, how it is paid and the billing data, in one page. For the owner and the
    // administrators, who alone have the endpoints (`OrgBillingAdmin`): the page itself asks anyone else to contact them. The plan and
    // billing pages of the rental areas stay as the pages Stripe returns to, and hand these people over to this one.
    path: '/app/account/billing',
    context: 'account',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.billing',
    navGroup: 'account',
    navPlacement: 'primary',
    navOrder: 5,
    icon: 'CreditCard',
    component: async () => ({ default: (await import('@/features/account/billing/account-billing-page')).AccountBillingPage }),
  },
  {
    path: '/app/account/profile',
    context: 'account',
    requiredPermissions: [],
    navKey: 'nav.profile',
    navPlacement: 'secondary',
    navOrder: 30,
    icon: 'User',
    component: async () => ({ default: (await import('@/features/account/account-profile-page')).AccountProfilePage }),
  },
  {
    // "Impostazioni" (AM-08b): the org's name, the address of its booking site, its contact email and its Stripe account in one page, for
    // the owner and the administrators (`org.settings.manage`; the endpoints are the ones of `OrgBillingAdmin`, which they pass too). The
    // organization and payments pages of the rental areas stay where they are.
    path: '/app/account/settings',
    context: 'account',
    requiredPermissions: ['org.settings.manage'],
    navKey: 'nav.accountSettings',
    navGroup: 'account',
    navPlacement: 'primary',
    navOrder: 7,
    icon: 'Settings',
    component: async () => ({ default: (await import('@/features/account/account-settings-page')).AccountSettingsPage }),
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
    // The one section of the invites (supplier and host); the address stays the one of the supplier invite.
    navKey: 'nav.invites',
    navPlacement: 'secondary',
    navOrder: 21,
    icon: 'UserPlus',
    component: async () => ({ default: (await import('@/features/admin/admin-invites-page')).AdminInvitesPage }),
    legacyPaths: ['/admin/suppliers/invite'],
  },
  {
    path: '/app/admin/invite-qr',
    context: 'admin',
    requiredPermissions: ['admin.users.manage'],
    navKey: 'nav.inviteQr',
    navPlacement: 'secondary',
    navOrder: 22,
    icon: 'QrCode',
    component: async () => ({ default: (await import('@/features/admin/admin-invite-qr-page')).AdminInviteQrPage }),
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
    path: '/app/admin/ai',
    context: 'admin',
    requiredPermissions: ['admin.seo.read'],
    navKey: 'nav.ai',
    navPlacement: 'secondary',
    navOrder: 23,
    icon: 'Sparkles',
    component: async () => ({ default: (await import('@/features/admin/admin-ai-page')).AdminAiPage }),
    legacyPaths: ['/admin/ai'],
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
  {
    path: '/app/admin/demo',
    context: 'admin',
    requiredPermissions: ['admin.cin.read'],
    navKey: 'nav.demoEnvironment',
    navPlacement: 'secondary',
    navOrder: 25,
    icon: 'Shield',
    component: async () => ({ default: (await import('@/features/admin/admin-demo-page')).AdminDemoPage }),
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
    // The settings of the supplier (SP-16c-c): "Risposte" (the automatic acceptance of the regular customers) and "Pagamenti" (the account
    // on Stripe, SP-16c-b), the last of the seven entries of the menu (SP-D1). Its address is the one the server sends the supplier back to
    // from Stripe (`?stripe_return=1`, `?stripe_refresh=1`: `PublicSiteLinks`, SP-14), so it is never renamed. No `featureFlag`: while online
    // payments are off on the server the "Pagamenti" tab says so (the account endpoints answer 404) and offers nothing.
    path: '/app/supplier/settings',
    context: 'supplier',
    requiredPermissions: [],
    navKey: 'nav.supplierSettings',
    navGroup: 'management',
    navPlacement: 'primary',
    navOrder: 7,
    icon: 'Settings',
    component: async () => ({ default: (await import('@/features/supplier/settings/supplier-settings-page')).SupplierSettingsPage }),
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
    // The catalog of services with prices (SP-06): the fourth place of the bar of the phone (SP-D11), the showcase goes to the menu.
    path: '/app/supplier/services',
    context: 'supplier',
    requiredPermissions: [],
    navKey: 'nav.supplierServices',
    navGroup: 'activity',
    navPlacement: 'primary',
    navOrder: 4,
    navBottom: 4,
    // "Servizi e prezzi" is 74 px in the bar and "Services and prices" 95 px: neither fits a column of 72 px (360 px screen).
    navBarKey: 'nav.supplierServicesBar',
    icon: 'Tag',
    component: async () => ({ default: (await import('@/features/supplier/services/supplier-services-page')).SupplierServicesPage }),
  },
  {
    // The guided creation of a service, in four steps; the draft is the service itself, saved at every step (SP-06).
    path: '/app/supplier/services/new',
    context: 'supplier',
    requiredPermissions: [],
    component: async () => ({
      default: (await import('@/features/supplier/services/supplier-service-wizard-page')).SupplierServiceWizardPage,
    }),
  },
  {
    // One service: every field, the preview that follows what is typed, "Visibile ai clienti" (SP-06).
    path: '/app/supplier/services/:id',
    context: 'supplier',
    requiredPermissions: [],
    component: async () => ({
      default: (await import('@/features/supplier/services/supplier-service-detail-page')).SupplierServiceDetailPage,
    }),
  },
  {
    // Preview of the public showcase and where it is published (SU-13, A4-16).
    path: '/app/supplier/showcase',
    context: 'supplier',
    requiredPermissions: [],
    navKey: 'nav.supplierShowcase',
    navGroup: 'activity',
    navPlacement: 'primary',
    navOrder: 5,
    icon: 'Store',
    component: async () => ({ default: (await import('@/features/supplier/supplier-showcase-preview-page')).SupplierShowcasePreviewPage }),
  },
  {
    // The customers of the supplier (SP-16b): the hosts of CasaZen and the private customers of the showcase, with their jobs. The sixth of
    // the seven entries of the menu (SP-D1); on the phone it is behind "Altro". No flag.
    path: '/app/supplier/clients',
    context: 'supplier',
    requiredPermissions: [],
    navKey: 'nav.supplierClients',
    navGroup: 'activity',
    navPlacement: 'primary',
    navOrder: 6,
    icon: 'Users',
    component: async () => ({ default: (await import('@/features/supplier/clients/supplier-clients-page')).SupplierClientsPage }),
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
    navOrder: 32,
    icon: 'HelpCircle',
    component: async () => ({ default: (await import('@/features/supplier/ical-help-page')).IcalHelpPage }),
  },
  {
    // The earnings of the supplier (SP-16b): gross, commission and net of every job. A page that hangs from the settings (SP-D1): in no
    // menu, the page of the settings links to it. Behind `SupplierOnlinePayments`: while it is off the entry is hidden and the route
    // goes to the home of the area.
    path: '/app/supplier/earnings',
    context: 'supplier',
    requiredPermissions: [],
    navKey: 'nav.supplierEarnings',
    navParent: '/app/supplier/settings',
    navOrder: 1,
    icon: 'Coins',
    featureFlag: 'supplierOnlinePayments',
    component: async () => ({ default: (await import('@/features/supplier/earnings/supplier-earnings-page')).SupplierEarningsPage }),
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
