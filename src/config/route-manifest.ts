import { isFeatureRuleEnabled, type FeatureFlagRule, type FeatureFlags } from './feature-flags';
import { ONBOARDING_ROUTES } from './onboarding-routes';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';
import { profilePathForContext } from '@/lib/profile-path';

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

/**
 * The light queries that give a menu entry its counter ({@link RouteManifestEntry.navCount}); see `useNavCounts`. `compliance` is
 * the number of things that carry a risk of a sanction (the Alloggiati Web communications and the guest data they need), in red.
 * `activities` is the number of the urgent items of the "To do" list (`GET api/me/activities/count`, ADR-026-R12), in red too.
 * `messages` is the number of the guests' messages the host has not read, in all the conversations (`GET api/messages/unread?includeOta=true`).
 */
export type NavCountKey = 'bookingRequests' | 'supplierRequests' | 'compliance' | 'activities' | 'messages';

/** The main menu of an area never has more primary entries than this: the rest goes to "Altro" (UI-04a). */
export const MAX_PRIMARY_NAV_ENTRIES = 8;

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
  /**
   * Order in the menu of the area: primary entries first (the groups follow the entries), then "Altro". For a page that hangs from
   * an entry ({@link navParent}) it is the order of its tab.
   */
  navOrder?: number;
  icon?: string;
  /**
   * `path` of the menu entry this page belongs to (UI-04a). The page is in no menu: while it is open the entry it hangs
   * from is the highlighted one, and the entry and its pages are the tabs on top of each of them (`NavSectionTabs`, which
   * `PageHeader` draws in the rental areas; the other areas link to them from the page of the entry, `NavChildLinks`). This is how
   * the menu stays short: a section is one entry, its pages are tabs. A page that hangs from an entry the user cannot open takes
   * a place in "Altro" itself, so no page the user may open is left without a way in. The one other parent is the profile of the
   * area (`profilePathForContext`), which is in no menu because the menu of the user leads to it and which anyone can open: its
   * pages (Notifiche) are tabs of it and take no place in "Altro".
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
  /**
   * Counter shown next to the entry in the menu; read from a query the app already makes (`useNavCounts`). A page that hangs from an
   * entry ({@link navParent}) is in no menu: its counter, if it has one (the messages not read yet), is on its tab (`NavSectionTabs`).
   */
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
  /**
   * Backend feature flag: while off the entry is in no menu and its route redirects to the context home. A list of flags is met while ANY of them is on (a page that serves
   * two sources, each behind a flag of its own).
   */
  featureFlag?: FeatureFlagRule;
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
    // The printable QR of the entrance of a property (NF-13), opened from «Identificazione e accesso»: the page was built before and no
    // route reached it. In no menu: that page leads to it. It asks what reading the property asks, and reads the id from `:propertyId`.
    path: '/app/short-rent/properties/:propertyId/qr',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    component: async () => ({ default: (await import('@/pages/PropertyQrCode')).PropertyQrCodePage }),
  },
  {
    // Interventi (SR-08): what the host asked of the suppliers, from the request to the payment. A tab of the section Immobili: the page
    // hangs from that entry. Reading it asks what reading the properties asks; the steps on a request ask
    // `property.write` or `servicerequest.write`, and the page hides the buttons from who may not.
    path: '/app/short-rent/interventions',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.interventions',
    navParent: '/app/short-rent/properties',
    navOrder: 1,
    icon: 'Wrench',
    component: async () => ({ default: (await import('@/features/service-requests/interventions')).InterventionsPage }),
  },
  {
    // «Richiedi un intervento» (SR-08b): the guided request in four steps. It asks what asking asks, `servicerequest.write` (the
    // collaborator has it); it is a page of the interventions, so it is before `:id`.
    path: '/app/short-rent/interventions/request',
    context: 'short-rent',
    requiredPermissions: ['servicerequest.write'],
    component: async () => ({ default: (await import('@/features/service-requests/interventions')).RequestInterventionPage }),
  },
  {
    path: '/app/short-rent/interventions/:id',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    component: async () => ({ default: (await import('@/features/service-requests/interventions')).InterventionDetailPage }),
  },
  {
    // What the host still has to do (CIN, check-ins, Alloggiati, cleanings); the Alloggiati dashboard and the CIN page hang from it.
    // In the main menu, with the number of the things that carry a risk of a sanction: what the law dates is not tucked away in
    // "Altro". The page reads `GET api/compliance/summary`, which asks `booking.read` as well as the properties.
    path: '/app/short-rent/compliance',
    context: 'short-rent',
    requiredPermissions: ['property.read', 'booking.read'],
    navKey: 'nav.compliance',
    navGroup: 'everyday',
    navPlacement: 'primary',
    navOrder: 3.5,
    navCount: 'compliance',
    icon: 'ClipboardCheck',
    component: async () => ({
      default: (await import('@/features/compliance/compliance-summary-page')).ComplianceSummaryPage,
    }),
  },
  {
    // Regime fiscale: a tab of Incassi, with Ricavi and Report.
    path: '/app/short-rent/fiscal',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.fiscal',
    navParent: '/app/short-rent/payments',
    navOrder: 3,
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
    // «Come emetti i documenti?» (E06/F02/US02/T03, FIS-02, NF-82): who issues the fiscal documents of the organization and which document its
    // regime needs. A guided flow opened from a card of the fiscal page, in no menu and no tab. It changes the setting of the whole
    // organization, so it asks `property.write`, as the backend does for the save (which also needs `payment.read` and the whole organization:
    // the wizard says so when the server refuses).
    path: '/app/short-rent/fiscal/issuer',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    component: async () => ({
      default: (await import('@/features/fiscal/issuer-wizard/issuer-wizard-page')).IssuerWizardPage,
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
    // The fiscal documents (FIS-04, FIS-07, NF-84, NF-87, E06/F03/US04/T01): the list of the ones CasaZen issued for its direct bookings and of the ones imported read-only from the
    // channel manager, with the state of each in simple words, the PDF and the XML, and the CSV and the Excel file. A tab of Incassi next to Regime fiscale. It asks what the backend asks:
    // `payment.read` for the list, the downloads and the files (`FiscalDocumentsController`), plus `property.read` for the setting that tells who issues. It exists while either flag of the
    // documents is on (CasaZen issues, or the channel manager's documents are imported): with both off the tab, the card of the fiscal page and the link of the payment ledger are not there
    // and the address leads to the home of the area. The ledger of the payments (E06/F04/US01/T04) links to it only while this entry is here, its flags are on and the caller holds these.
    path: '/app/short-rent/fiscal/documents',
    context: 'short-rent',
    requiredPermissions: ['property.read', 'payment.read'],
    featureFlag: ['fiscalDocumentIssuance', 'octorateDocumentImport'],
    navKey: 'nav.fiscalDocuments',
    navParent: '/app/short-rent/payments',
    navOrder: 3.5,
    icon: 'FileText',
    component: async () => ({
      default: (await import('@/features/fiscal/documents/fiscal-documents-page')).FiscalDocumentsPage,
    }),
  },
  {
    // The reports of short rent (SR-10): revenue, occupancy and bookings by channel to download, the fiscal ones as the fiscal page
    // has them, and the pages that already hold the rest (Alloggiati, payments). For who may read payments (aggregated money):
    // the others find the reserved page. A tab of Incassi, with Ricavi and Regime fiscale.
    path: '/app/short-rent/reports',
    context: 'short-rent',
    requiredPermissions: ['payment.read'],
    navKey: 'nav.reports',
    navParent: '/app/short-rent/payments',
    navOrder: 2,
    icon: 'TrendingUp',
    component: async () => ({ default: (await import('@/features/reports/reports-page')).ReportsPage }),
  },
  {
    // The documents of the organization in one place (NF-99, REP-04): the property documents, the contracts, the tourist tax receipts and, as
    // their tasks arrive, the compliance proofs and the fiscal documents; filtered by type, days and property, searched, downloaded one by one
    // or as a ZIP of a period. A tab of Incassi right after Report (2.5: Regime fiscale keeps its 3). It asks what the API asks at its door,
    // `property.read` (backend policy `SharedPropertyRead`); the server then opens each type with the permission of its own area, and the page
    // offers only the types it sends. For who may not read payments, the page that hangs from Incassi takes a place in "Altro" (UI-04a).
    path: '/app/short-rent/documents',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.documents',
    navParent: '/app/short-rent/payments',
    navOrder: 2.5,
    icon: 'FileText',
    component: async () => ({ default: (await import('@/features/document-archive/documents-page')).DocumentsPage }),
  },
  {
    // The tourist tax per comune and period (NF-100, REP-05): owed, paid and the receipts, where the host records a payment. A page of
    // the list of reports (its row "Apri" leads here), in no menu and no tab; reading it asks for payments, and the buttons that write
    // ask for `payment.write` inside the page.
    path: '/app/short-rent/reports/tourist-tax',
    context: 'short-rent',
    requiredPermissions: ['payment.read'],
    component: async () => ({ default: (await import('@/features/reports/tourist-tax/tourist-tax-summary-page')).TouristTaxSummaryPage }),
  },
  {
    // The reviews of the host's properties (DB-12b): the guests' reviews of the stays booked on the site, newest first, with the one
    // answer of the host and the report to CasaZen. A tab of Prenotazioni, after the guests.
    path: '/app/short-rent/reviews',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navKey: 'nav.reviews',
    navParent: '/app/short-rent/bookings',
    navOrder: 3,
    icon: 'Star',
    component: async () => ({ default: (await import('@/features/reviews/host-reviews-page')).HostReviewsPage }),
  },
  {
    // The calendars of all the properties in one list (SR-10b): the channel, when each was last read, what needs a look and "Sincronizza ora";
    // "Collega" leads to the tab Calendari of the property, where calendars are linked. A tab of Immobili, whose calendars it lists.
    // Who may read the properties sees the state; only who may write them gets the buttons.
    path: '/app/short-rent/channels',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.channels',
    navParent: '/app/short-rent/properties',
    navOrder: 3,
    icon: 'CalendarSync',
    component: async () => ({ default: (await import('@/features/channels/channels-page')).ChannelsPage }),
  },
  {
    // Identity verification console (NF-12, NF-50, NF-51): the verifications that wait for an operator, with why and the checks, and the figures.
    // A tab of "Da approvare", the other queue of decisions. It asks the permission the API asks for every call of it, `verification.decision` (the
    // owner, the administrators and the property managers; E03/F04/US02/T01): an entry the user opens must not end on a 403.
    path: '/app/short-rent/verifications',
    context: 'short-rent',
    requiredPermissions: ['verification.decision'],
    navKey: 'nav.verifications',
    navParent: '/app/short-rent/approval-queue',
    navOrder: 1,
    icon: 'ShieldCheck',
    component: async () => ({ default: (await import('@/pages/VerificationQueuePage')).VerificationQueuePage }),
  },
  {
    // Approval queue (NF-06, NF-68): items requiring human decision before execution: the drafts of messages, the campaigns, the texts of the AI.
    // In "Altro", the entry of the queues of decisions: the verifications of the guests are its other tab. Deciding asks its own permission,
    // `approval.decide` (the owner, the administrators and the property managers; not the collaborator or the accountant), the one the API asks
    // for every call of the queue: an entry the user opens must not end on a 403.
    path: '/app/short-rent/approval-queue',
    context: 'short-rent',
    requiredPermissions: ['approval.decide'],
    navKey: 'nav.approvalQueue',
    navPlacement: 'secondary',
    navOrder: 29,
    icon: 'CheckSquare',
    component: async () => ({ default: (await import('@/pages/ApprovalQueuePage')).ApprovalQueuePage }),
  },
  {
    // «Attività» (NF-07, ADR-026): everything the system asks of the host, the most urgent first, each with its «Fallo ora»; the counter
    // is the number of the urgent ones. In "Altro", the last of it: the main menu has its eight entries (UI-04a) and the Home already
    // carries the first item and the next ones; "Altro" says on its own tab that something urgent waits inside. The server shows each user
    // only the items its scope reaches (HostScope), so the page asks what reading the properties asks, held by every role of the area;
    // each «Fallo ora» opens a page that asks its own permission (`ACTION_ROUTE_MAP`). Not the staff page `/app/admin/activities`.
    path: '/app/short-rent/activities',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.activities',
    navPlacement: 'secondary',
    navOrder: 35,
    navCount: 'activities',
    icon: 'ListChecks',
    component: async () => ({ default: (await import('@/features/todo/todo-list')).TodoListPage }),
  },
  {
    // The domain of the booking site: the last tab of the section, after its look and its documents.
    path: '/app/short-rent/settings/domain',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    navKey: 'nav.domain',
    navParent: '/app/short-rent/vetrina',
    navOrder: 3,
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
    // Where the host connects the account that the booking payments go to: the last tab of Incassi.
    path: '/app/short-rent/settings/payments',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    navKey: 'nav.stripeConnect',
    navParent: '/app/short-rent/payments',
    navOrder: 4,
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
    // The assistant of the guests' messages (E05/F05/US04/T02, NF-66): its rules, its properties and its situations, in "Altro". Only with the flag `messageAssistant`
    // (backend `MessageAssistant`, off by default): while it is off the entry is in no menu, the address leads to the home of the area and the server answers 404 to every
    // endpoint of the assistant. The page asks `property.write` (the exceptions and the answers of a property are written with it); inside it, the rules, the situations
    // and the answers of the organization are changed by the organization administrator alone, and the others read them with the reason in words.
    path: '/app/short-rent/settings/assistant',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    featureFlag: 'messageAssistant',
    navKey: 'nav.assistant',
    navPlacement: 'secondary',
    navOrder: 34,
    icon: 'Sparkles',
    component: async () => ({ default: (await import('@/features/assistant/assistant-settings-page')).AssistantSettingsPage }),
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
    // A change of the price and the rules of many days of many properties, in a guided wizard with a summary before anything is sent (NF-78, NF-05). It is not in a menu: the
    // calendar has the button that opens it, and it needs the right to write properties (the API checks it again for every property).
    path: '/app/short-rent/bookings/calendar/bulk',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    component: async () => ({ default: (await import('@/features/bookings/calendar-bulk-page')).CalendarBulkPage }),
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
    // The host wizard "Guest check-in" of a booking (NF-40): guests, documents, checks, tax and send. Opened from the "To do" item
    // `StartCheckIn` and from the booking whose guest data are incomplete.
    path: '/app/short-rent/bookings/:id/check-in',
    context: 'short-rent',
    requiredPermissions: ['booking.write'],
    component: async () => ({
      default: (await import('@/features/checkin/wizard/checkin-wizard')).CheckInWizardPage,
    }),
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
  // The other pages of the marketplace (MKT): the tab Le mie app, a category, the search. They are in no menu: the entry above stays the
  // highlighted one (the pages are under its address) and its tabs lead to them. The old page of the categories is Scopri now.
  {
    path: '/app/short-rent/marketplace/categories',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    component: async () => ({ default: (await import('@/features/marketplace/categories-redirect')).MarketplaceCategoriesRedirect }),
  },
  {
    path: '/app/short-rent/marketplace/categories/:category',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    component: async () => ({ default: (await import('@/features/marketplace/category-page')).MarketplaceCategoryPage }),
  },
  {
    path: '/app/short-rent/marketplace/search',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    component: async () => ({ default: (await import('@/features/marketplace/search-page')).MarketplaceSearchPage }),
  },
  {
    path: '/app/short-rent/marketplace/mine',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    component: async () => ({ default: (await import('@/features/marketplace/mine-page')).MarketplaceMinePage }),
  },
  {
    // The page of a supplier, which can be shared (MKT): the supplier is read for the property of the address.
    path: '/app/short-rent/marketplace/suppliers/:orgId',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    component: async () => ({ default: (await import('@/features/marketplace/supplier-page')).MarketplaceSupplierPage }),
  },
  {
    // The guided activation of a sales channel or a connected tool through the channel manager (E09/F02/US04/T01, MKT-03, NF-56): `channel` or `tool` and the
    // code of the portal in the catalog. In no menu: the cards of the marketplace and the Active tab lead here, with the property and where to come back to
    // in the query. It writes the connection, so it asks `ota.write` and the channel manager's flag, as the backend does.
    path: '/app/short-rent/marketplace/activate/:kind/:code',
    context: 'short-rent',
    requiredPermissions: ['ota.write'],
    featureFlag: 'octorateConnector',
    component: async () => ({
      default: (await import('@/features/marketplace/activation/activation-wizard-page')).ActivationWizardPage,
    }),
  },
  {
    // The guided request of a function of the channel manager's license (E09/F02/US04/T03, MKT-03, PO-12, D21): CasaZen cannot switch a module of the license on, so the
    // wizard prepares the request and records it as Requested until the license shows the module. In no menu: the cards and the detail of the function lead here. Same
    // permission and flag as the activation: the license is read from, and the request is recorded for, the connected channel manager.
    path: '/app/short-rent/marketplace/request/:moduleCode',
    context: 'short-rent',
    requiredPermissions: ['ota.write'],
    featureFlag: 'octorateConnector',
    component: async () => ({
      default: (await import('@/features/marketplace/functions/licensed-request-wizard-page')).LicensedRequestWizardPage,
    }),
  },
  {
    // The hand-off to a Partner Hub partner (E09/F02/US04/T04, MKT-03, S18, Q-006): the activation happens on the partner's own site, so the wizard prepares what the
    // partner will ask, opens the site in the same tab and records what the person declares. In no menu: the cards of the Partners group lead here. The partners never
    // depend on the channel manager, so there is no flag; the declaration is written (`ota.write`), as the backend asks.
    path: '/app/short-rent/marketplace/partners/:code/activate',
    context: 'short-rent',
    requiredPermissions: ['ota.write'],
    component: async () => ({
      default: (await import('@/features/marketplace/partners/partner-wizard-page')).PartnerWizardPage,
    }),
  },
  {
    // The trusted suppliers of an agency (ADR-010): `/trusted-suppliers` answers only an org on the Agency plan (`agencyTier`). Next to
    // the interventions they are asked for: a tab of Immobili, there while the flag is on.
    path: '/app/short-rent/trusted-suppliers',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    featureFlag: 'agencyTier',
    navKey: 'nav.trustedSuppliers',
    navParent: '/app/short-rent/properties',
    navOrder: 2,
    icon: 'Users',
    component: async () => ({ default: (await import('@/pages/TrustedSuppliersPage')).TrustedSuppliersPage }),
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
    navKey: 'nav.alloggiatiReports',
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
    // «Identificazione e accesso» (E03/F01/US03): the lock code of each property, write-only, and the way to the printable QR of its entrance. A
    // tab of Adempimenti (the page links from there and from what is still to do: `?property=<id>` opens the code of one property). It asks what
    // setting a code asks, `property.write` (the policy of `POST properties/{id}/access-code`); the list it reads asks `property.read`.
    path: '/app/short-rent/compliance/identification',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    navKey: 'nav.identification',
    navParent: '/app/short-rent/compliance',
    navOrder: 3,
    icon: 'ShieldCheck',
    component: async () => ({
      default: (await import('@/features/compliance/identification/identification-page')).IdentificationPage,
    }),
  },
  {
    // «Attiva l'invio automatico alla Polizia» (E03/F01/US02/T02, NF-42): the wizard that sets who sends the guest data to the police and to ISTAT for one property
    // (`?property=<id>`), with the passage on the panel of the channel manager and the connection test. In no menu: the panel «Invio a Polizia e ISTAT» of the property page
    // (its «Attiva o ricollega» appears because this route exists), the cockpit of the adempimenti, the «Da fare» of the activation and the onboarding lead here. It asks what
    // changing the sender asks, `property.write` (the endpoints it calls ask it); the property is read with `property.read`. No flag: the channel manager is offered only where
    // the server says it can send, so with the connector off the wizard has only the other ways.
    path: '/app/short-rent/compliance/sender',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    component: async () => ({
      default: (await import('@/features/compliance/sender-wizard/sender-wizard')).SenderWizardPage,
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
    // Ricavi: the first tab of Incassi after the payments themselves.
    path: '/app/short-rent/payments/revenue',
    context: 'short-rent',
    requiredPermissions: ['payment.read'],
    navKey: 'nav.revenue',
    navParent: '/app/short-rent/payments',
    navOrder: 1,
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
    // The OTA channels (behind their flag): the last tab of Immobili, after the calendars they sit with.
    path: '/app/short-rent/ota',
    context: 'short-rent',
    requiredPermissions: ['ota.read'],
    navKey: 'nav.ota',
    navParent: '/app/short-rent/properties',
    navOrder: 4,
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
    // «Collega i tuoi canali» (E02/F01/US01/T04, ADR-023): the guided connection of the inventory to the channel manager, behind its flag.
    // In no menu: the onboarding, the list of the properties and the settings of the integrations lead here. It is also the callback page
    // the channel manager sends the host back to after the consent (`Octorate__RedirectUri` of the backend is this address on the host of
    // the web app), so it may open with a `code` and a `state` in the address. Writing the connection asks `ota.write`, as the backend does.
    path: '/app/short-rent/integrations/octorate',
    context: 'short-rent',
    requiredPermissions: ['ota.write'],
    component: async () => ({
      default: (await import('@/features/integrations/octorate/connect-wizard')).OctorateConnectWizardPage,
    }),
    featureFlag: 'octorateConnector',
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
    // In no menu: the menu of the user (header and phone sheet, `profilePathForContext`) leads here, as it does for every area.
    path: '/app/short-rent/profile',
    context: 'short-rent',
    requiredPermissions: [],
    navKey: 'nav.profile',
    icon: 'User',
    component: async () => ({ default: (await import('@/features/profile/profile-page')).ProfilePage }),
    legacyPaths: ['/profile'],
  },
  {
    // Notifiche (E05/F03/US02, NF-65): how the user wants to be alerted, kind of event by kind of event, and the quiet hours. The second tab of
    // Profilo: the page hangs from the profile, which the menu of the user leads to (`resolveNavEntries`: it is in no menu and not in "Altro").
    // The settings are the user's own, so it asks no permission, and the API takes the user from the token.
    path: '/app/short-rent/profile/notifications',
    context: 'short-rent',
    requiredPermissions: [],
    navKey: 'nav.notificationPreferences',
    navParent: '/app/short-rent/profile',
    navOrder: 1,
    icon: 'Bell',
    component: async () => ({
      default: (await import('@/features/profile/notification-preferences-page')).NotificationPreferencesPage,
    }),
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
    // Contracts are managed from the property's Contracts tab, not a separate menu entry.
    // Old list addresses now lead back to the properties.
    navKey: 'nav.leases',
    icon: 'FileText',
    component: async () => ({ default: (await import('@/features/leases/legacy-leases-redirect')).LegacyLeasesRedirect }),
    legacyPaths: ['/leases'],
  },
  {
    // Canoni (LR-04b): the rent register of the month. It is not a menu entry: a canone exists only inside a contract,
    // and the sheet of that contract opens it. This address stays for the register of every contract, linked from there.
    path: '/app/long-rent/rents',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    navKey: 'nav.rents',
    icon: 'Wallet',
    component: async () => ({ default: (await import('@/features/leases')).RentsPage }),
  },
  {
    // Compatibility address for the area agenda. Contract deadlines live on the contract sheet.
    path: '/app/long-rent/deadlines',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    navKey: 'nav.longRentDeadlines',
    icon: 'CalendarDays',
    component: async () => ({
      default: (await import('@/features/leases/deadlines/long-rent-deadlines-page')).LongRentDeadlinesPage,
    }),
  },
  {
    // Inquilini (LR-09): who lives in the properties let long term, since when, for how much and how punctually, with the copy of a
    // person's data and the request to erase them. Tenant data lives inside each contract. The compatibility address remains available; the
    // copy and the erasure ask `lease.create` too (the sheet hides them from who may not).
    path: '/app/long-rent/tenants',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    navKey: 'nav.longRentTenants',
    icon: 'Users',
    component: async () => ({ default: (await import('@/features/leases/tenants/tenants-page')).TenantsPage }),
  },
  {
    path: '/app/long-rent/tenants/:id',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    component: async () => ({ default: (await import('@/features/leases/tenants/tenant-detail-page')).TenantDetailPage }),
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
    // Maintenance requests of one lease: the landlord or the agency approves or rejects, and pays only after approval.
    // The same list is the Manutenzione section of the property. The tenant uses /portale-conduttore/.../richiesta-manutenzione.
    path: '/app/long-rent/leases/:id/manutenzione',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    component: async () => ({
      default: (await import('@/features/maintenance-requests/landlord-page')).LandlordMaintenancePage,
    }),
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
    navOrder: 3,
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
    // hides the buttons from who may not). The entry point is the Interventi tab of each property.
    path: '/app/long-rent/service-requests',
    context: 'long-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.serviceRequests',
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
    // the leases; the others find the reserved page. A standalone report, without contract-list tabs.
    path: '/app/long-rent/fiscal',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    navKey: 'nav.longRentFiscal',
    navPlacement: 'secondary',
    navOrder: 3,
    icon: 'Receipt',
    component: async () => ({ default: (await import('@/features/leases/fiscal/long-rent-fiscal-page')).LongRentFiscalPage }),
  },
  {
    // Condominium payments are made externally; this page lists reminders and records manual settlement.
    path: '/app/long-rent/payments',
    context: 'long-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.longRentPayments',
    navPlacement: 'secondary',
    navOrder: 35,
    icon: 'CreditCard',
    component: async () => ({
      default: (await import('@/features/leases/landlord-payments-page')).LandlordPaymentsPage,
    }),
  },
  {
    // In no menu: the menu of the user (header and phone sheet, `profilePathForContext`) leads here.
    path: '/app/long-rent/profile',
    context: 'long-rent',
    requiredPermissions: [],
    navKey: 'nav.profile',
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
    // "Ruoli e permessi" (AM-04b-FU2): what each role can do, in one table; opened from the page of the people. In no menu, like the invitation.
    path: '/app/account/people/roles',
    context: 'account',
    requiredPermissions: ['org.members.manage'],
    component: async () => ({ default: (await import('@/features/team/roles-page')).RolesPage }),
  },
  {
    // "Cosa vede" (AM-04b-FU2): what one person finds in CasaZen, with «E se fosse…» to try another role. `:key` is the row of the page of
    // the people (`m-<id>` or `i-<id>`). In no menu either: «Persone» stays the highlighted entry.
    path: '/app/account/people/:key/preview',
    context: 'account',
    requiredPermissions: ['org.members.manage'],
    component: async () => ({ default: (await import('@/features/team/person-preview-page')).PersonPreviewPage }),
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
    // «Rendiconti» (E06/F05/US01/T02, NF-25): the monthly statements of the agency's owners, with the real PDF and CSV. It reads and writes the agency
    // endpoint `/statements` (ADR-010: only an org on the Agency plan, so behind `agencyTier`), which is the agency's own and not the platform console's:
    // it was `/app/admin/statements` and that address stays as an old one that opens this page. The backend asks `agency.statement.view` for it (and
    // `agency.statement.manage` to approve and publish), which the owner and the administrators hold from their role in the org and which is not among the
    // context permissions of `/me/contexts` (so it cannot be a `requiredPermissions` entry): like the other pages of the agency's money, the entry is for
    // the org billing administrator, who is that owner or administrator, and the page checks the role and the plan of the organization before it reads anything (the flag is the environment's, the plan is each organization's: the backend refuses any other plan with a bare 403).
    path: '/app/account/statements',
    context: 'account',
    requiredPermissions: [],
    orgBillingAdmin: true,
    featureFlag: 'agencyTier',
    navKey: 'nav.statements',
    navGroup: 'account',
    navPlacement: 'primary',
    navOrder: 3.5,
    icon: 'FileText',
    component: async () => ({ default: (await import('@/pages/StatementsPage')).StatementsPage }),
    legacyPaths: ['/app/admin/statements'],
  },
  {
    // Withholding tax management (ADR-018): the withholding of the month by owner, the F24 with its PDF and the registration of its payment. For the
    // org billing administrator, who holds `agency.withholding.manage` as the owner or an administrator. Agency plan only (`agencyTier`).
    path: '/app/account/withholding',
    context: 'account',
    requiredPermissions: [],
    orgBillingAdmin: true,
    featureFlag: 'agencyTier',
    navKey: 'nav.withholding',
    navGroup: 'account',
    navPlacement: 'primary',
    navOrder: 4,
    icon: 'FileText',
    component: async () => ({ default: (await import('@/pages/WithholdingPage')).WithholdingPage }),
  },
  {
    // Wire transfer batch management (ADR-017): the payment files (SEPA for EUR, Swiss for CHF) that pay the owners' published statements. The backend asks
    // `agency.wire.manage`, which only the owner and the administrators hold: the entry is for the org billing administrator, and the page checks the role
    // before it reads anything, the plan of the organization too. Agency plan only (`agencyTier`).
    path: '/app/account/wire-transfers',
    context: 'account',
    requiredPermissions: [],
    orgBillingAdmin: true,
    featureFlag: 'agencyTier',
    navKey: 'nav.wireTransfers',
    navGroup: 'account',
    navPlacement: 'primary',
    navOrder: 4.5,
    icon: 'Send',
    component: async () => ({ default: (await import('@/pages/WireTransferPage')).WireTransferPage }),
  },
  {
    // «Chiusura mensile» (E06/F05/US02/T04, NF-110): the month of the agency's owners in four groups (to prepare, to check, approved, published) with
    // its readiness and the next step of each owner: check, approve, publish, pay, close. It reads the endpoints of the owner accounting, which need
    // the finance permissions of the owner and the administrators and the whole reach of the org, so it is behind the plan (`agencyTier`) and for the
    // org billing administrator like the other pages of the agency's money. In "Altro": the main menu of the area is at its limit.
    path: '/app/account/owner-close',
    context: 'account',
    requiredPermissions: [],
    orgBillingAdmin: true,
    featureFlag: 'agencyTier',
    navKey: 'nav.ownerClose',
    navPlacement: 'secondary',
    navOrder: 26,
    icon: 'CalendarCheck',
    component: async () => ({ default: (await import('@/features/owner-accounting/month-end-close-page')).MonthEndClosePage }),
  },
  {
    // One version of the statement of an owner (E06/F05/US02/T04): the formula, every line with its source, what changed since the version before, the
    // payouts and the withholding evidence, the invoices linked from the external fiscal system. In no menu: «Chiusura mensile» leads here.
    path: '/app/account/owner-close/versions/:versionId',
    context: 'account',
    requiredPermissions: [],
    orgBillingAdmin: true,
    featureFlag: 'agencyTier',
    component: async () => ({ default: (await import('@/features/owner-accounting/statement-detail-page')).StatementDetailPage }),
  },
  {
    // «Dati finanziari» of an owner (E06/F05/US02/T04, NF-109): the fiscal profile masked, the mandate, the rule set with the accountant's approval, what the
    // activation still misses. In no menu: the month-end close and its anomalies lead here.
    path: '/app/account/owners/:ownerId/financial',
    context: 'account',
    requiredPermissions: [],
    orgBillingAdmin: true,
    featureFlag: 'agencyTier',
    component: async () => ({ default: (await import('@/features/owners/owner-financial-profile-page')).OwnerFinancialProfilePage }),
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
  // Messages (E05/F02/US03, NF-61)
  {
    // Messaggi: every conversation with the guests, the ones of the channels and the direct ones, "Da rispondere" first, with the number of the
    // messages not read yet on its tab. The first tab of Prenotazioni after the bookings. The main menu has its eight entries (UI-04a), so
    // the page hangs from the entry of the bookings like the guests and the reviews do. The server shows each user only the conversations
    // its scope reaches (HostScope); reading asks `booking.read`, and answering asks `booking.write` inside the page.
    path: '/app/short-rent/messages',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navKey: 'nav.messages',
    navParent: '/app/short-rent/bookings',
    navOrder: 1,
    navCount: 'messages',
    icon: 'MessageSquare',
    component: async () => ({ default: (await import('@/features/messages/inbox-page')).InboxPage }),
  },
  {
    // One conversation (E05/F02/US03/T02, NF-61/63/64): the messages in the middle, the booking and the link to the guest beside them, the
    // box that answers; from a very wide screen the inbox is the third column. In no menu: the rows of the list and of the Home lead
    // here. It asks `booking.read`, like the list; answering asks `booking.write` inside the page. The key of the conversation is the one the
    // server gave (`ota:…`, `direct:…`), escaped in the address.
    path: '/app/short-rent/messages/:threadKey',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    component: async () => ({ default: (await import('@/features/messages/thread-page')).ThreadPage }),
  },
  // Guests
  {
    // Ospiti: the second tab of Prenotazioni, after the messages.
    path: '/app/short-rent/guests',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navKey: 'nav.guests',
    navParent: '/app/short-rent/bookings',
    navOrder: 2,
    icon: 'Users',
    component: async () => ({ default: (await import('@/features/guests/guests-page')).GuestsPage }),
  },
  {
    path: '/app/short-rent/guests/:id',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    component: async () => ({ default: (await import('@/features/guests/guest-detail-page')).GuestDetailPage }),
  },
  // The CRM and marketing module (NF-23, NF-95, ADR-021, E07): aggregated guest data for marketing and segmentation, filtered by HostScope.
  // It is unfinished, so every page of it is behind the flag `crmMarketing` (backend `CrmMarketing`): while the flag is off the entry is in
  // no menu and the addresses lead to the home of the area. The entry «CRM Ospiti» is one of «Altro» (the main menu has its eight entries),
  // right after the queue of the verifications of the guests; the pages of the epic hang from it as tabs (`navParent` set to its path), in
  // this order: `nav.crmSegments`, `nav.crmCampaigns`, `nav.crmAutomations`, `nav.crmMerge`.
  // Convention: each page task of the epic adds its own entry here with `featureFlag: 'crmMarketing'` and `navParent:
  // '/app/short-rent/crm/guests'`, never a menu entry of its own. The pages the e-mails link to (`/unsubscribe`, `/marketing/confirm`, the
  // consent and welcome pages) are public routes, not entries of this table, and are never behind the flag: an e-mail already sent keeps working.
  // The pages ask `guest.read`, what the API behind them asks (`CrmController`): with `booking.read` the accountant, who has no `guest.read`,
  // would see the entry and end on the no-access page.
  {
    path: '/app/short-rent/crm/guests',
    context: 'short-rent',
    requiredPermissions: ['guest.read'],
    featureFlag: 'crmMarketing',
    navKey: 'nav.crm',
    navPlacement: 'secondary',
    navOrder: 30,
    icon: 'Users',
    component: async () => ({ default: (await import('@/pages/crm/GuestList')).default }),
  },
  {
    path: '/app/short-rent/crm/guests/:id',
    context: 'short-rent',
    requiredPermissions: ['guest.read'],
    featureFlag: 'crmMarketing',
    component: async () => ({ default: (await import('@/pages/crm/GuestDetail')).default }),
  },
  {
    // The merge proposals (E07/F01/US04/T03, NF-88): the pairs of profiles the matching thinks are one guest, which the host decides. The
    // last tab of the CRM (after the audiences, the campaigns and the automations). The API lists them for `guest.read` but merges and
    // dismisses for `guest.write`, and the page is for deciding, so it asks `guest.write`.
    path: '/app/short-rent/crm/merge',
    context: 'short-rent',
    requiredPermissions: ['guest.write'],
    featureFlag: 'crmMarketing',
    navKey: 'nav.crmMerge',
    navParent: '/app/short-rent/crm/guests',
    navOrder: 4,
    icon: 'Users',
    component: async () => ({ default: (await import('@/features/crm/merge/merge-page')).MergePage }),
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
  {
    // Reads the agency endpoint `/internal-activities` (ADR-010), which answers only an org on the Agency plan: behind `agencyTier`.
    path: '/app/admin/activities',
    context: 'admin',
    requiredPermissions: ['admin.users.read'],
    featureFlag: 'agencyTier',
    navKey: 'nav.staffActivities',
    navGroup: 'platform',
    navPlacement: 'secondary',
    navOrder: 26,
    icon: 'ClipboardCheck',
    component: async () => ({ default: (await import('@/pages/StaffActivitiesPage')).StaffActivitiesPage }),
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
    // Requests waiting for the supplier's answer (`toAnswer` of `GET /supplier/inbox/counts`: not those that wait for the customer, SP-08b).
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
    // "Il mio sito vetrina" (SP-13c): where the public showcase stands, publishing, pausing and sharing it (the preview of SU-13, A4-16
    // became this overview).
    path: '/app/supplier/showcase',
    context: 'supplier',
    requiredPermissions: [],
    navKey: 'nav.supplierShowcase',
    navGroup: 'activity',
    navPlacement: 'primary',
    navOrder: 5,
    icon: 'Store',
    component: async () => ({ default: (await import('@/features/supplier/showcase/showcase-hub-page')).SupplierShowcaseHubPage }),
  },
  {
    // "Crea la tua vetrina" (SP-13e): the guided creation of the showcase in four steps, on the same draft as the editor. No entry of the
    // menu: the overview leads to it while there is nothing yet.
    path: '/app/supplier/showcase/publish',
    context: 'supplier',
    requiredPermissions: [],
    component: async () => ({
      default: (await import('@/features/supplier/showcase/publish-wizard-page')).SupplierShowcasePublishWizardPage,
    }),
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
  // The pages of the activation with Octorate (epic E10), behind the flag `octorateOnboarding`: see `onboarding-routes.ts`.
  ...ONBOARDING_ROUTES,
];

export type PermissionPredicate = (contextKey: AppContextKey, permission: string) => boolean;

/** Entries behind a feature flag need the flag on; without flags (not loaded) they are hidden. */
export function isEntryFeatureEnabled(entry: RouteManifestEntry, features?: Partial<FeatureFlags>): boolean {
  return isFeatureRuleEnabled(features, entry.featureFlag);
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

  // The profile of the area is no entry of a menu: the menu of the user leads to it, and nobody is without it (it asks no permission). The
  // pages that hang from it (Notifiche) are its tabs, found from the profile itself, so they take no place in the menus or in "Altro".
  const profilePath = profilePathForContext(contextKey);

  const menu: RouteManifestEntry[] = [];
  const hanging: RouteManifestEntry[] = [];
  for (const entry of available) {
    if (entry.navPlacement !== undefined) menu.push(entry);
    else if (entry.navParent !== undefined && menuPaths.has(entry.navParent)) hanging.push(entry);
    else if (entry.navParent === profilePath) continue;
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
 * The pages of the section the page at `pathname` belongs to, in tab order (UI-04a): the entry the section hangs from, then the
 * pages that hang from it that the user may open. They are the tabs on top of each of them (`NavSectionTabs`). Empty when
 * `pathname` is not the address of one of them (a record of the section, `/payments/:id`, is not a tab), when the user cannot open
 * the entry (its pages are then entries of "Altro" of their own, `resolveNavEntries`) and when there is no other page to go to.
 */
export function getNavSection(
  pathname: string,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
): RouteManifestEntry[] {
  const place = pathname.replace(/\/+$/, '') || '/';
  const page = ROUTE_MANIFEST.find((entry) => entry.path === place);
  if (!page) return [];

  const head = page.navParent === undefined ? page : ROUTE_MANIFEST.find((entry) => entry.path === page.navParent);
  if (!head || head.navParent !== undefined || !isEntryAvailable(head, hasPermission, features)) return [];

  const section = [head, ...getNavChildren(head.path, hasPermission, features)];
  return section.length > 1 && section.includes(page) ? section : [];
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
