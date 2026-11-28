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

export type NavGroup =
  | 'everyday'
  | 'offer'
  | 'management'
  | 'portfolio'
  | 'work'
  | 'activity'
  | 'platform'
  | 'account'
  | 'owners'
  | 'support'
  | 'content'
  | 'system';

export type NavPlacement = 'primary' | 'secondary' | 'footer';

/**
 * The light queries that give a menu entry its counter ({@link RouteManifestEntry.navCount}); see `useNavCounts`. `compliance` is
 * the number of things that carry a risk of a sanction (the Alloggiati Web communications and the guest data they need), in red.
 * `activities` is the number of the urgent items of the "To do" list (`GET api/me/activities/count`, ADR-026-R12), in red too.
 * `messages` is the number of the guests' messages the host has not read, in all the conversations (`GET api/messages/unread?includeOta=true`).
 */
export type NavCountKey = 'bookingRequests' | 'supplierRequests' | 'compliance' | 'activities' | 'messages';

export const MAX_PRIMARY_NAV_ENTRIES = 11;

export const MAX_BOTTOM_NAV_ENTRIES = 4;

export interface RouteManifestEntry {
  path: string;
  context: AppContextKey;
  requiredPermissions: string[];
  permissionMode?: 'any';
  navKey?: string;
  navTabKey?: string;
  navLabel?: string;
  navGroup?: NavGroup;
  navPlacement?: NavPlacement;
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
  navBottom?: number;
  navBarKey?: string;
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
  featureFlag?: FeatureFlagRule;
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
    icon: 'Building2',
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
    path: '/app/short-rent/properties/:propertyId/qr',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    component: async () => ({ default: (await import('@/pages/PropertyQrCode')).PropertyQrCodePage }),
  },
  {
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
    // The wizard «Fatturazione» (E11/F02/US01/T01, NF-82, NF-118): the whole invoicing setup of the organization (who issues, the VAT, the numbering, the tourist tax, for an
    // agency the commissions of the portals and the standard mandate, the issuing, the Italian reminders and the summary), a part of the onboarding guide. A guided flow opened
    // from a card of the fiscal page and from the guide, in no menu and no tab. It is read by who reads the properties and the payments (`GET api/billing-setup` asks
    // `payment.read`): a person who may not change it (no `property.write`, or an access to only some of the properties) sees it read-only, with the reason. It exists while the
    // issuance of the fiscal documents is on: with it off the tab and the card are not there and the address leads to the home of the area, as the backend answers 404.
    path: '/app/short-rent/fiscal/setup',
    context: 'short-rent',
    requiredPermissions: ['property.read', 'payment.read'],
    featureFlag: 'fiscalDocumentIssuance',
    component: async () => ({
      default: (await import('@/features/fiscal/billing-wizard/billing-wizard-page')).BillingWizardPage,
    }),
  },
  {
    // The old wizard «Come emetti i documenti?» (E06/F02/US02/T03): CasaZen issues every document since 2026-11-14, so its address leads to the wizard «Fatturazione».
    path: '/app/short-rent/fiscal/issuer',
    context: 'short-rent',
    requiredPermissions: [],
    component: async () => ({
      default: (await import('@/features/fiscal/billing-wizard/legacy-issuer-redirect')).LegacyIssuerRedirect,
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
    path: '/app/short-rent/accountant',
    context: 'short-rent',
    requiredPermissions: ['payment.read'],
    featureFlag: 'accountantPackage',
    navKey: 'nav.accountant',
    navParent: '/app/short-rent/payments',
    navOrder: 2.25,
    icon: 'FileCheck',
    component: async () => ({ default: (await import('@/features/accountant/accountant-package-page')).AccountantPackagePage }),
  },
  {
    path: '/app/short-rent/documents',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.documents',
    navParent: '/app/short-rent/payments',
    navOrder: 2.5,
    icon: 'FolderOpen',
    component: async () => ({ default: (await import('@/features/document-archive/documents-page')).DocumentsPage }),
  },
  {
    path: '/app/short-rent/reports/tourist-tax',
    context: 'short-rent',
    requiredPermissions: ['payment.read'],
    component: async () => ({ default: (await import('@/features/reports/tourist-tax/tourist-tax-summary-page')).TouristTaxSummaryPage }),
  },
  {
    path: '/app/short-rent/reports/tourist-tax/year-end',
    context: 'short-rent',
    requiredPermissions: ['payment.read'],
    featureFlag: 'taxReportingExports',
    component: async () => ({ default: (await import('@/features/reports/tourist-tax/tourist-tax-year-end-page')).TouristTaxYearEndPage }),
  },
  {
    path: '/app/short-rent/reports/collections',
    context: 'short-rent',
    requiredPermissions: ['payment.read'],
    component: async () => ({ default: (await import('@/features/reports/collections/collections-report-page')).CollectionsReportPage }),
  },
  {
    path: '/app/short-rent/reports/channel-costs',
    context: 'short-rent',
    requiredPermissions: ['payment.read'],
    component: async () => ({ default: (await import('@/features/reports/channel-costs/channel-costs-page')).ChannelCostsPage }),
  },
  {
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
    path: '/app/short-rent/bookings/flow',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navKey: 'nav.bookingFlow',
    navParent: '/app/short-rent/bookings',
    navOrder: 4,
    icon: 'ListChecks',
    component: async () => ({ default: (await import('@/features/bookings/booking-flow-page')).BookingFlowPage }),
  },
  {
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
    path: '/app/short-rent/activation',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.propertyActivation',
    navParent: '/app/short-rent/properties',
    navOrder: 4,
    icon: 'ListChecks',
    component: async () => ({ default: (await import('@/features/properties/property-activation-page')).PropertyActivationPage }),
  },
  {
    // Identity verification console (NF-12, NF-50, NF-51): the verifications that wait for an operator, with why and the checks, and the figures.
    // The last tab of the Cruscotto, after «Da approvare», the other queue of decisions. It asks the permission the API asks for every call of it,
    // `verification.decision` (the owner, the administrators and the property managers; E03/F04/US02/T01): an entry the user opens must not end on a 403.
    path: '/app/short-rent/verifications',
    context: 'short-rent',
    requiredPermissions: ['verification.decision'],
    navKey: 'nav.verifications',
    navParent: '/app/short-rent',
    navOrder: 3,
    icon: 'ShieldCheck',
    component: async () => ({ default: (await import('@/pages/VerificationQueuePage')).VerificationQueuePage }),
  },
  {
    // Approval queue (NF-06, NF-68): items requiring human decision before execution: the drafts of messages, the campaigns, the texts of the AI.
    // A tab of the Cruscotto («Da approvare»), with the «Da fare» list and the verifications of the guests: what waits for the host is one section
    // of the menu, not entries of "Altro". Deciding asks its own permission, `approval.decide` (the owner, the administrators and the property
    // managers; not the collaborator or the accountant), the one the API asks for every call of the queue: an entry the user opens must not end on a 403.
    path: '/app/short-rent/approval-queue',
    context: 'short-rent',
    requiredPermissions: ['approval.decide','marketing.manage'],
    permissionMode: 'any',
    navKey: 'nav.approvalQueue',
    navTabKey: 'nav.toApprove',
    navParent: '/app/short-rent',
    navOrder: 2,
    icon: 'CheckSquare',
    component: async () => ({ default: (await import('@/pages/ApprovalQueuePage')).ApprovalQueuePage }),
  },
  {
    path: '/app/short-rent/activities',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.todo',
    navParent: '/app/short-rent',
    navOrder: 1,
    navCount: 'activities',
    icon: 'ListChecks',
    component: async () => ({ default: (await import('@/features/todo/todo-list')).TodoListPage }),
  },
  {
    path: '/app/short-rent/settings/domain',
    navParent: '/app/short-rent/settings',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    navKey: 'nav.domain',
    icon: 'Globe',
    navOrder: 40,
    component: async () => ({
      default: (await import('@/features/settings/domain/custom-domain-settings-page')).CustomDomainSettingsPage,
    }),
  },
  {
    // «Incorpora nel tuo sito» (E41/F03/US01, NF-147, NF-149): where the agency takes a booking widget to its own website (code to paste, preview, plugin for WordPress, tag manager). The tab
    // right after the domain, which it extends and links to. Only with the flag `siteEmbed` (backend `SiteEmbed`, off by default): while it is off the tab is not there and the address leads to the
    // home of the area. It is the page of the account administrator (`orgBillingAdmin`, as the tabs around it): the domain settings it reads are the administrator's to read, and a refused read would
    // send the whole app to the page of no access, so anyone else who opens the address is told so and nothing is asked.
    path: '/app/short-rent/settings/embed',
    navParent: '/app/short-rent/settings',
    context: 'short-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    featureFlag: 'siteEmbed',
    navKey: 'nav.embed',
    icon: 'Store',
    navOrder: 41,
    component: async () => ({
      default: (await import('@/features/settings/embed/embed-settings-page')).EmbedSettingsPage,
    }),
  },
  {
    // Plans and Stripe checkout; also the return page of the checkout and of the billing portal (backend PL-11). In no
    // menu since UI-04a: the org badge of the header leads here (`usePlanPagePath`) and the page links to the billing one.
    path: '/app/short-rent/settings/plan',
    navParent: '/app/short-rent/settings',
    context: 'short-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.plan',
    icon: 'CreditCard',
    navOrder: 70,
    component: async () => ({
      default: (await import('@/features/billing/plans-page')).PlansPage,
    }),
  },
  {
    // In no menu since UI-04a: the plan page links to it (and the org badge to the plan page).
    path: '/app/short-rent/settings/billing',
    navParent: '/app/short-rent/settings',
    context: 'short-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.billing',
    icon: 'Receipt',
    navOrder: 80,
    component: async () => ({
      default: (await import('@/features/billing/billing-settings-page')).BillingSettingsPage,
    }),
  },
  {
    path: '/app/short-rent/settings',
    context: 'short-rent',
    requiredPermissions: [],
    navKey: 'nav.settings',
    navPlacement: 'footer',
    navOrder: 40,
    icon: 'Settings',
    component: async () => ({ default: (await import('@/features/settings/settings-index')).SettingsIndex }),
  },
  {
    path: '/app/short-rent/settings/organization',
    navParent: '/app/short-rent/settings',
    context: 'short-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.organization',
    icon: 'Settings',
    navOrder: 10,
    component: async () => ({
      default: (await import('@/features/settings/organization/organization-settings-page')).OrganizationSettingsPage,
    }),
  },
  {
    path: '/app/short-rent/settings/site-appearance',
    navParent: '/app/short-rent/settings',
    context: 'short-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.siteAppearance',
    icon: 'Palette',
    navOrder: 30,
    component: async () => ({
      default: (await import('@/features/settings/site-appearance/site-appearance-page')).SiteAppearancePage,
    }),
  },
  {
    path: '/app/short-rent/settings/site-documents',
    navParent: '/app/short-rent/settings',
    context: 'short-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.siteDocuments',
    icon: 'FileText',
    navOrder: 50,
    component: async () => ({
      default: (await import('@/features/settings/site-documents/site-documents-page')).SiteDocumentsPage,
    }),
  },
  {
    path: '/app/short-rent/settings/payments',
    navParent: '/app/short-rent/settings',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    navKey: 'nav.stripeConnect',
    icon: 'Wallet',
    navOrder: 60,
    component: async () => ({
      default: (await import('@/features/settings/payments-page')).ConnectPaymentsPage,
    }),
  },
  {
    path: '/app/short-rent/settings/invitations',
    navParent: '/app/short-rent/settings',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.hostInvites',
    icon: 'Gift',
    navOrder: 20,
    component: async () => ({
      default: (await import('@/features/invites/host-invites-page')).HostInvitesPage,
    }),
  },
  {
    path: '/app/short-rent/settings/ai',
    navParent: '/app/short-rent/settings',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    navKey: 'aiSettings.title',
    icon: 'Sparkles',
    navOrder: 90,
    component: async () => ({ default: (await import('@/features/settings/ai-settings-page')).AiSettingsPage }),
  },
  {
    path: '/app/short-rent/settings/guest-portal',
    context: 'short-rent',
    requiredPermissions: ['guestportal.manage', 'property.read'],
    featureFlag: 'guestPortal',
    navKey: 'guestPortal.host.title',
    navParent: '/app/short-rent/settings',
    navOrder: 82,
    icon: 'Settings',
    component: async () => ({ default: (await import('@/features/settings/guest-portal-settings-page')).GuestPortalSettingsPage }),
  },
  {
    path: '/app/short-rent/settings/assistant',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    featureFlag: 'messageAssistant',
    navKey: 'nav.assistant',
    navParent: '/app/short-rent/settings/ai',
    navOrder: 2,
    icon: 'Sparkles',
    component: async () => ({ default: (await import('@/features/assistant/assistant-settings-page')).AssistantSettingsPage }),
  },
  {
    path: '/app/short-rent/automations',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    featureFlag: 'routines',
    navKey: 'nav.routines',
    navPlacement: 'primary',
    navGroup: 'everyday',
    navOrder: 3.75,
    icon: 'Workflow',
    component: async () => ({ default: (await import('@/pages/RoutinesPage')).RoutinesPage }),
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
    navCount: 'bookingRequests',
    icon: 'BedDouble',
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
    path: '/app/short-rent/marketplace/suppliers/:orgId',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    component: async () => ({ default: (await import('@/features/marketplace/supplier-page')).MarketplaceSupplierPage }),
  },
  {
    path: '/app/short-rent/marketplace/activate/:kind/:code',
    context: 'short-rent',
    requiredPermissions: ['ota.write'],
    featureFlag: 'octorateConnector',
    component: async () => ({
      default: (await import('@/features/marketplace/activation/activation-wizard-page')).ActivationWizardPage,
    }),
  },
  {
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
    path: '/app/short-rent/trusted-suppliers',
    context: 'short-rent',
    requiredPermissions: [ORG_BILLING_ADMIN_PERMISSION],
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
    // «Notifica alla polizia (Ticino)» (casazen/backend#979): the guided notification of the guests of a property in canton Ticino to the cantonal police is a LAYER of the
    // cockpit now (E30/F02/US03/T02: `?detail=ticino:<property>[:<day>]` over `/app/short-rent/compliance`, opened by the cockpit item `NotifyTicinoPolice`, the bell and the
    // property page). This address is the old page, which stays only so that no link breaks (notifications, e-mails, bookmarks): `?property=<id>&date=yyyy-MM-dd` redirects to
    // the cockpit with the layer open on that property and day, and the page draws nothing of its own. In no menu. The layer reads guest data (`booking.read`; the API also asks `guest.read`).
    path: '/app/short-rent/compliance/ticino',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    component: async () => ({ default: (await import('@/pages/SwissCompliancePage')).SwissCompliancePage }),
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
    path: '/app/short-rent/profile',
    context: 'short-rent',
    requiredPermissions: [],
    navKey: 'nav.profile',
    icon: 'User',
    component: async () => ({ default: (await import('@/features/profile/profile-page')).ProfilePage }),
    legacyPaths: ['/profile'],
  },
  {
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
    navKey: 'nav.leases',
    icon: 'FileText',
    component: async () => ({ default: (await import('@/features/leases/legacy-leases-redirect')).LegacyLeasesRedirect }),
    legacyPaths: ['/leases'],
  },
  {
    path: '/app/long-rent/rents',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    navKey: 'nav.rents',
    icon: 'Wallet',
    component: async () => ({ default: (await import('@/features/leases')).RentsPage }),
  },
  {
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
    path: '/app/long-rent/leases/:id/manutenzione',
    context: 'long-rent',
    requiredPermissions: ['lease.read'],
    component: async () => ({
      default: (await import('@/features/maintenance-requests/landlord-page')).LandlordMaintenancePage,
    }),
  },
  {
    path: '/app/long-rent/leases/:id/edit',
    context: 'long-rent',
    requiredPermissions: ['lease.read', 'lease.create'],
    component: async () => ({ default: (await import('@/features/leases')).LeaseWizardPage }),
  },
  {
    path: '/app/long-rent/leases/:id/guided-contract',
    context: 'long-rent',
    requiredPermissions: ['lease.read', 'lease.create'],
    component: async () => ({
      default: (await import('@/pages/long-rent/leases/concordatofacile-offer-page')).ConcordatoFacileOfferPage,
    }),
  },
  {
    path: '/app/long-rent/leases/:id/concordatofacile',
    context: 'long-rent',
    requiredPermissions: ['lease.read', 'lease.create'],
    component: async () => ({
      default: (await import('@/pages/long-rent/leases/guided-contract-redirect')).GuidedContractRedirect,
    }),
  },
  {
    path: '/app/long-rent/properties',
    context: 'long-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.properties',
    navGroup: 'portfolio',
    navPlacement: 'primary',
    navOrder: 3,
    navBottom: 2,
    icon: 'Building2',
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
    path: '/app/long-rent/properties/:id/mode',
    context: 'long-rent',
    requiredPermissions: ['property.write'],
    component: async () => ({
      default: (await import('@/features/properties/mode/property-mode-wizard-page')).LongRentPropertyModePage,
    }),
  },
  {
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
    navParent: '/app/long-rent/settings',
    context: 'long-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.plan',
    icon: 'CreditCard',
    navOrder: 70,
    component: async () => ({
      default: (await import('@/features/billing/plans-page')).PlansPageContent,
    }),
  },
  {
    path: '/app/long-rent/settings/billing',
    navParent: '/app/long-rent/settings',
    context: 'long-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.billing',
    icon: 'Receipt',
    navOrder: 80,
    component: async () => ({
      default: (await import('@/features/billing/billing-settings-page')).BillingSettingsContent,
    }),
  },
  {
    path: '/app/long-rent/settings',
    context: 'long-rent',
    requiredPermissions: [],
    navKey: 'nav.settings',
    navPlacement: 'footer',
    navOrder: 40,
    icon: 'Settings',
    component: async () => ({ default: (await import('@/features/settings/settings-index')).SettingsIndex }),
  },
  {
    path: '/app/long-rent/settings/organization',
    navParent: '/app/long-rent/settings',
    context: 'long-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.organization',
    icon: 'Settings',
    navOrder: 10,
    component: async () => ({
      default: (await import('@/features/settings/organization/organization-settings-page')).OrganizationSettingsContent,
    }),
  },
  {
    path: '/app/long-rent/settings/invitations',
    navParent: '/app/long-rent/settings',
    context: 'long-rent',
    requiredPermissions: ['property.read'],
    navKey: 'nav.hostInvites',
    icon: 'Gift',
    navOrder: 20,
    component: async () => ({
      default: (await import('@/features/invites/host-invites-page')).HostInvitesContent,
    }),
  },
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
    path: '/app/account/people/invite',
    context: 'account',
    requiredPermissions: ['org.members.manage'],
    component: async () => ({ default: (await import('@/features/team/invite/invite-page')).InvitePage }),
  },
  {
    path: '/app/account/people/roles',
    context: 'account',
    requiredPermissions: ['org.members.manage'],
    component: async () => ({ default: (await import('@/features/team/roles-page')).RolesPage }),
  },
  {
    path: '/app/account/people/:key/preview',
    context: 'account',
    requiredPermissions: ['org.members.manage'],
    component: async () => ({ default: (await import('@/features/team/person-preview-page')).PersonPreviewPage }),
  },
  {
    path: '/app/account/properties',
    context: 'account',
    requiredPermissions: ['org.members.manage'],
    navKey: 'nav.properties',
    navGroup: 'account',
    navPlacement: 'primary',
    navOrder: 3,
    navBottom: 3,
    icon: 'Building2',
    component: async () => ({ default: (await import('@/features/account/properties/account-properties-page')).AccountPropertiesPage }),
  },
  {
    path: '/app/account/owners',
    context: 'account',
    requiredPermissions: [],
    orgBillingAdmin: true,
    featureFlag: 'agencyTier',
    navKey: 'nav.owners',
    navGroup: 'account',
    navPlacement: 'primary',
    navOrder: 4,
    icon: 'UserRound',
    component: async () => ({ default: (await import('@/features/owners/owners-list-page')).OwnersListPage }),
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
    navParent: '/app/account/owner-close',
    navOrder: 1,
    icon: 'FileText',
    component: async () => ({ default: (await import('@/pages/StatementsPage')).StatementsPage }),
    legacyPaths: ['/app/admin/statements'],
  },
  {
    // «Fatture ai proprietari» (E13/F02/US01/T03, NF-114): the invoices of the agency to its owners, made from their statements, with the filters of the month and of the owner and the PDF of
    // each. A tab of «Chiusura mensile», right after the statements they are made from (the order asks for 1.5: the withholding and the transfers keep theirs). Behind the flag
    // `ownerInvoicing` (the backend answers 404 while it is off, and the page is not in the menu); the page checks the role and the agency plan of the organization before it reads anything.
    path: '/app/account/owner-invoices',
    context: 'account',
    requiredPermissions: [],
    orgBillingAdmin: true,
    featureFlag: 'ownerInvoicing',
    navKey: 'nav.ownerInvoices',
    navParent: '/app/account/owner-close',
    navOrder: 1.5,
    icon: 'Receipt',
    component: async () => ({ default: (await import('@/features/owner-invoices/owner-invoices-page')).OwnerInvoicesPage }),
  },
  {
    // «Autofatture (TD17)» (E17/F03/US01/T02, NF-116): the invoices CasaZen makes for an Italian account holder when a foreign portal charges it a commission with no VAT: the drafts of the month, their review and their issue.
    // A tab of «Chiusura mensile» right after the invoices to the owners (the order asks for 1.6: the withholding and the transfers keep theirs): the drafts are made from the owner ledger of the month. It asks what the API asks at
    // its door, `agency.invoice.manage` (the owner and the administrators of the organization, whole organization only, on the agency plan: the page checks the role and the plan before it reads anything), and it exists only
    // while the issuance of fiscal documents is on (off: no entry, the address leads to the home of the area, and the backend answers 404).
    path: '/app/account/self-billing',
    context: 'account',
    requiredPermissions: [],
    orgBillingAdmin: true,
    featureFlag: 'fiscalDocumentIssuance',
    navKey: 'nav.selfBilling',
    navParent: '/app/account/owner-close',
    navOrder: 1.6,
    icon: 'Receipt',
    component: async () => ({ default: (await import('@/features/fiscal/self-billing/self-billing-page')).SelfBillingPage }),
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
    navParent: '/app/account/owner-close',
    navOrder: 2,
    icon: 'FileText',
    component: async () => ({ default: (await import('@/pages/WithholdingPage')).WithholdingPage }),
  },
  {
    path: '/app/account/wire-transfers',
    context: 'account',
    requiredPermissions: [],
    orgBillingAdmin: true,
    featureFlag: 'agencyTier',
    navKey: 'nav.wireTransfers',
    navParent: '/app/account/owner-close',
    navOrder: 3,
    icon: 'Send',
    component: async () => ({ default: (await import('@/pages/WireTransferPage')).WireTransferPage }),
  },
  {
    // «Commissioni dei canali» (E13/F02/US03/T01, NF-115, ⚖ R2): what each portal keeps when its reservation carries no commission, the same editor as the step of the wizard «Fatturazione» for the
    // changes made after the setup. It reads the rules of the owner ledger (`agency.statement.view`) and writes them (`agency.owner.financial.manage`, the whole organization), which only the
    // owner and the administrators hold and which are not among the context permissions of `/me/contexts`: like the other pages of the agency's money, it is behind the plan (`agencyTier`) and for the org
    // billing administrator, and the page checks the role and the plan before it reads anything. A tab of «Chiusura mensile», after the transfers: the stays held back for a missing commission are found there.
    path: '/app/account/channel-commissions',
    context: 'account',
    requiredPermissions: [],
    orgBillingAdmin: true,
    featureFlag: 'agencyTier',
    navKey: 'nav.channelCommissions',
    navParent: '/app/account/owner-close',
    navOrder: 4,
    icon: 'Coins',
    component: async () => ({ default: (await import('@/features/owner-accounting/channel-commission-rules-page')).ChannelCommissionRulesPage }),
  },
  {
    path: '/app/account/owner-close',
    context: 'account',
    requiredPermissions: [],
    orgBillingAdmin: true,
    featureFlag: 'agencyTier',
    navKey: 'nav.ownerClose',
    navGroup: 'owners',
    navPlacement: 'primary',
    navOrder: 5,
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
    // billing pages of the rental areas stay as the pages Stripe returns to, and hand these people over to this one. Pinned at the foot of the
    // sidebar with «Impostazioni», as the settings of the rental areas are.
    path: '/app/account/billing',
    context: 'account',
    requiredPermissions: [],
    orgBillingAdmin: true,
    navKey: 'nav.billing',
    navPlacement: 'footer',
    navOrder: 40,
    icon: 'CreditCard',
    component: async () => ({ default: (await import('@/features/account/billing/account-billing-page')).AccountBillingPage }),
  },
  {
    path: '/app/account/profile',
    context: 'account',
    requiredPermissions: [],
    navKey: 'nav.profile',
    icon: 'User',
    component: async () => ({ default: (await import('@/features/account/account-profile-page')).AccountProfilePage }),
  },
  {
    // "Impostazioni" (AM-08b): the org's name, the address of its booking site, its contact email and its Stripe account in one page, for
    // the owner and the administrators (`org.settings.manage`; the endpoints are the ones of `OrgBillingAdmin`, which they pass too). The
    // organization and payments pages of the rental areas stay where they are. Pinned at the foot of the sidebar.
    path: '/app/account/settings',
    context: 'account',
    requiredPermissions: ['org.settings.manage'],
    navKey: 'nav.accountSettings',
    navPlacement: 'footer',
    navOrder: 41,
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
    navKey: 'nav.invites',
    navGroup: 'platform',
    navPlacement: 'primary',
    navOrder: 4,
    icon: 'UserPlus',
    component: async () => ({ default: (await import('@/features/admin/admin-invites-page')).AdminInvitesPage }),
    legacyPaths: ['/admin/suppliers/invite'],
  },
  {
    path: '/app/admin/invite-qr',
    context: 'admin',
    requiredPermissions: ['admin.users.manage'],
    icon: 'QrCode',
    component: async () => ({ default: (await import('@/features/admin/admin-invite-qr-page')).AdminInviteQrPage }),
  },
  {
    path: '/app/admin/jobs',
    context: 'admin',
    requiredPermissions: ['admin.jobs.read'],
    navKey: 'nav.jobs',
    navGroup: 'system',
    navPlacement: 'primary',
    navOrder: 7,
    navBottom: 4,
    icon: 'Workflow',
    component: async () => ({ default: (await import('@/features/admin/admin-jobs-page')).AdminJobsPage }),
    legacyPaths: ['/admin/jobs'],
  },
  {
    path: '/app/admin/property-preparation',
    context: 'admin',
    requiredPermissions: ['admin.jobs.read'],
    navKey: 'nav.propertyPreparation',
    navParent: '/app/admin/jobs',
    navOrder: 5,
    icon: 'ListChecks',
    component: async () => ({ default: (await import('@/features/admin/admin-property-preparation-page')).AdminPropertyPreparationPage }),
  },
  {
    path: '/app/admin/ai',
    context: 'admin',
    requiredPermissions: ['admin.seo.read'],
    navKey: 'nav.ai',
    navParent: '/app/admin/jobs',
    navOrder: 1,
    icon: 'Sparkles',
    component: async () => ({ default: (await import('@/features/admin/admin-ai-page')).AdminAiPage }),
    legacyPaths: ['/admin/ai'],
  },
  {
    path: '/app/admin/ai/playground',
    context: 'admin',
    requiredPermissions: ['admin.seo.read'],
    component: async () => ({ default: (await import('@/features/admin/agent-playground')).AgentPlaygroundPage }),
  },
  {
    path: '/app/admin/seo',
    context: 'admin',
    requiredPermissions: ['admin.seo.read'],
    navKey: 'nav.seo',
    navGroup: 'content',
    navPlacement: 'primary',
    navOrder: 5,
    icon: 'Globe',
    component: async () => ({ default: (await import('@/features/admin/seo-dashboard-page')).SeoDashboardPage }),
    legacyPaths: ['/admin/seo'],
  },
  {
    path: '/app/admin/marketing',
    context: 'admin',
    requiredPermissions: ['admin.seo.read'],
    navKey: 'nav.marketing',
    navParent: '/app/admin/seo',
    navOrder: 1,
    icon: 'TrendingUp',
    component: async () => ({ default: (await import('@/features/admin/marketing-page')).MarketingPage }),
    legacyPaths: ['/admin/marketing'],
  },
  {
    path: '/app/short-rent/messages',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navKey: 'nav.messages',
    navGroup: 'everyday',
    navPlacement: 'primary',
    navOrder: 3.25,
    navCount: 'messages',
    icon: 'MessageSquare',
    component: async () => ({ default: (await import('@/features/messages/inbox-page')).InboxPage }),
  },
  {
    path: '/app/short-rent/messages/:threadKey',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    component: async () => ({ default: (await import('@/features/messages/thread-page')).ThreadPage }),
  },
  {
    path: '/app/short-rent/guests',
    context: 'short-rent',
    requiredPermissions: ['booking.read'],
    navKey: 'nav.guests',
    navParent: '/app/short-rent/bookings',
    navOrder: 2,
    icon: 'ContactRound',
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
  // no menu and the addresses lead to the home of the area. The entry «Ospiti e marketing» is in the group «Gestione» of the main menu, after Incassi;
  // the pages of the epic hang from it as tabs (`navParent` set to its path), in
  // this order: «Ospiti» (the entry itself, `nav.crmGuestsTab`), `nav.crmSegments`, `nav.crmCampaigns`, `nav.crmAutomations`, `nav.crmMerge`.
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
    navTabKey: 'nav.crmGuestsTab',
    navGroup: 'management',
    navPlacement: 'primary',
    navOrder: 8,
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
    path: '/app/short-rent/crm/segments',
    context: 'short-rent',
    requiredPermissions: ['marketing.manage'],
    featureFlag: 'crmMarketing',
    navKey: 'nav.crmSegments',
    navParent: '/app/short-rent/crm/guests',
    navOrder: 1,
    icon: 'Users',
    component: async () => ({ default: (await import('@/pages/SegmentsPage')).SegmentsPage }),
  },
  {
    path: '/app/short-rent/crm/campaigns',
    context: 'short-rent',
    requiredPermissions: ['marketing.manage'],
    featureFlag: 'crmMarketing',
    navKey: 'nav.crmCampaigns',
    navParent: '/app/short-rent/crm/guests',
    navOrder: 2,
    icon: 'Users',
    component: async () => ({ default: (await import('@/pages/CampaignsPage')).CampaignsPage }),
  },
  {
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
  // is "Conformità" (UI-04a), in the group «Sistema»: the tax rates and the LTR reference data are its tabs.
  {
    path: '/app/admin/cin',
    context: 'admin',
    requiredPermissions: ['admin.cin.read'],
    navKey: 'nav.complianceAudit',
    navGroup: 'system',
    navPlacement: 'primary',
    navOrder: 6,
    icon: 'BadgeCheck',
    component: async () => ({ default: (await import('@/features/admin/admin-cin-page')).AdminCinPage }),
    // The old /admin/cin URL was the admin audit, not the host CIN page: it must land here (A1-16).
    legacyPaths: ['/admin/cin'],
  },
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
  // Admin ISTAT regions (E21/F01/US02/T01, NF-44, NF-52): the table the staff keeps of the ISTAT communication of each region (its system, deadline, required guest fields, whether the channel
  // manager sends it, the source and the day it was checked), which the hosts read from the sender wizard and the page of their property. The third tab of «Conformità», after the tax rates and the
  // LTR reference data. The platform administrator's only: the endpoints answer 403 to anyone else, and no flag stands in front of it (it is platform data).
  {
    path: '/app/admin/compliance/istat-regions',
    context: 'admin',
    requiredPermissions: ['admin.cin.read'],
    navKey: 'nav.istatRegions',
    navParent: '/app/admin/cin',
    navOrder: 3,
    icon: 'FileCheck',
    component: async () => ({ default: (await import('@/pages/admin/IstatRegionsPage')).IstatRegionsPage }),
  },
  {
    path: '/app/admin/demo',
    context: 'admin',
    requiredPermissions: ['admin.cin.read'],
    navKey: 'nav.demoEnvironment',
    navParent: '/app/admin/jobs',
    navOrder: 2,
    icon: 'Shield',
    component: async () => ({ default: (await import('@/features/admin/admin-demo-page')).AdminDemoPage }),
  },
  {
    path: '/app/admin/activities',
    context: 'admin',
    requiredPermissions: ['admin.users.read'],
    featureFlag: 'agencyTier',
    navKey: 'nav.staffActivities',
    navGroup: 'support',
    navPlacement: 'primary',
    navOrder: 4.5,
    icon: 'ClipboardCheck',
    component: async () => ({ default: (await import('@/pages/StaffActivitiesPage')).StaffActivitiesPage }),
  },
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
    navCount: 'supplierRequests',
    icon: 'Inbox',
    component: async () => ({ default: (await import('@/features/supplier/supplier-inbox-page')).SupplierInboxPage }),
  },
  {
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
    path: '/app/supplier/services',
    context: 'supplier',
    requiredPermissions: [],
    navKey: 'nav.supplierServices',
    navGroup: 'activity',
    navPlacement: 'primary',
    navOrder: 4,
    navBottom: 4,
    navBarKey: 'nav.supplierServicesBar',
    icon: 'Tag',
    component: async () => ({ default: (await import('@/features/supplier/services/supplier-services-page')).SupplierServicesPage }),
  },
  {
    path: '/app/supplier/services/new',
    context: 'supplier',
    requiredPermissions: [],
    component: async () => ({
      default: (await import('@/features/supplier/services/supplier-service-wizard-page')).SupplierServiceWizardPage,
    }),
  },
  {
    path: '/app/supplier/services/:id',
    context: 'supplier',
    requiredPermissions: [],
    component: async () => ({
      default: (await import('@/features/supplier/services/supplier-service-detail-page')).SupplierServiceDetailPage,
    }),
  },
  {
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
    path: '/app/supplier/showcase/publish',
    context: 'supplier',
    requiredPermissions: [],
    component: async () => ({
      default: (await import('@/features/supplier/showcase/publish-wizard-page')).SupplierShowcasePublishWizardPage,
    }),
  },
  {
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
  ...ONBOARDING_ROUTES,
];

export type PermissionPredicate = (contextKey: AppContextKey, permission: string) => boolean;

export function isEntryFeatureEnabled(entry: RouteManifestEntry, features?: Partial<FeatureFlags>): boolean {
  return isFeatureRuleEnabled(features, entry.featureFlag);
}

export function hasEntryPermission(
  entry: RouteManifestEntry,
  hasPermission?: PermissionPredicate,
): boolean {
  if (!hasPermission) return true;
  if (entry.orgBillingAdmin && !hasPermission(entry.context, ORG_BILLING_ADMIN_PERMISSION)) return false;
  if (entry.permissionMode === 'any') return entry.requiredPermissions.some(permission => hasPermission(entry.context, permission));
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

type PathAccess = (path: string) => boolean;

function isEntryAvailable(
  entry: RouteManifestEntry,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
  canOpenPath?: PathAccess,
): boolean {
  return hasEntryPermission(entry, hasPermission) && isEntryFeatureEnabled(entry, features) && (canOpenPath?.(entry.path) ?? true);
}

const PLACEMENT_RANK: Record<NavPlacement, number> = { primary: 0, secondary: 1, footer: 2 };

function placementRank(entry: RouteManifestEntry): number {
  return PLACEMENT_RANK[entry.navPlacement ?? 'secondary'];
}

function byNavOrder(a: RouteManifestEntry, b: RouteManifestEntry): number {
  return (a.navOrder ?? 99) - (b.navOrder ?? 99);
}

function byMenuOrder(a: RouteManifestEntry, b: RouteManifestEntry): number {
  return placementRank(a) - placementRank(b) || byNavOrder(a, b);
}

interface ContextNavEntries {
  menu: RouteManifestEntry[];
  hanging: RouteManifestEntry[];
}

function resolveNavEntries(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
  canOpenPath?: PathAccess,
): ContextNavEntries {
  const available = ROUTE_MANIFEST.filter(
    (entry) =>
      entry.context === contextKey &&
      (entry.navPlacement !== undefined || entry.navParent !== undefined) &&
      isEntryAvailable(entry, hasPermission, features, canOpenPath),
  );
  const availablePaths = new Set(available.map((entry) => entry.path));

  const profilePath = profilePathForContext(contextKey);

  const menu: RouteManifestEntry[] = [];
  const hanging: RouteManifestEntry[] = [];
  for (const entry of available) {
    const isRentalSettings = entry.path === '/app/short-rent/settings' || entry.path === '/app/long-rent/settings';
    if (isRentalSettings && !available.some(child => child.navParent === entry.path)) continue;
    if (entry.navPlacement !== undefined) menu.push(entry);
    else if (entry.navParent === profilePath) continue;
    else if (entry.navParent !== undefined && availablePaths.has(entry.navParent)) hanging.push(entry);
    else menu.push({ ...entry, navPlacement: 'secondary' });
  }
  return { menu: menu.sort(byMenuOrder), hanging: hanging.sort(byNavOrder) };
}

export function getVisibleNavEntries(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
  canOpenPath?: PathAccess,
): RouteManifestEntry[] {
  return resolveNavEntries(contextKey, hasPermission, features, canOpenPath).menu;
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

export function getSecondaryNavEntries(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
): RouteManifestEntry[] {
  return getVisibleNavEntries(contextKey, hasPermission, features).filter(
    (entry) => entry.navPlacement === 'secondary',
  );
}

export function getFooterNavEntries(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
): RouteManifestEntry[] {
  return getVisibleNavEntries(contextKey, hasPermission, features).filter((entry) => entry.navPlacement === 'footer');
}

export function getBottomNavEntries(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
  canOpenPath?: PathAccess,
): RouteManifestEntry[] {
  return getVisibleNavEntries(contextKey, hasPermission, features, canOpenPath)
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
  canOpenPath?: PathAccess,
): RouteManifestEntry[] {
  return ROUTE_MANIFEST.filter(
    (entry) => entry.navParent === parentPath && isEntryAvailable(entry, hasPermission, features, canOpenPath),
  ).sort(byNavOrder);
}

export function getNavSection(
  pathname: string,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
  canOpenPath?: PathAccess,
): RouteManifestEntry[] {
  const place = pathname.replace(/\/+$/, '') || '/';
  const page = ROUTE_MANIFEST.find((entry) => entry.path === place);
  if (!page) return [];

  const head = page.navParent === undefined ? page : ROUTE_MANIFEST.find((entry) => entry.path === page.navParent);
  if (!head || !isEntryAvailable(head, hasPermission, features, canOpenPath)) return [];

  const section = [head, ...getNavChildren(head.path, hasPermission, features, canOpenPath)];
  return section.length > 1 && section.includes(page) ? section : [];
}

export function getNavMatchEntries(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
  canOpenPath?: PathAccess,
): RouteManifestEntry[] {
  const { menu, hanging } = resolveNavEntries(contextKey, hasPermission, features, canOpenPath);
  return [...menu, ...hanging];
}

export interface NavSection {
  group: NavGroup;
  entries: RouteManifestEntry[];
}

export interface ContextNav {
  sections: NavSection[];
  more: RouteManifestEntry[];
  footer: RouteManifestEntry[];
}

export function getContextNav(
  contextKey: AppContextKey,
  hasPermission?: PermissionPredicate,
  features?: Partial<FeatureFlags>,
  options: { withoutBottom?: boolean; canOpenPath?: PathAccess } = {},
): ContextNav {
  const sections: NavSection[] = [];
  const more: RouteManifestEntry[] = [];
  const footer: RouteManifestEntry[] = [];
  for (const entry of getVisibleNavEntries(contextKey, hasPermission, features, options.canOpenPath)) {
    if (options.withoutBottom && entry.navBottom !== undefined) continue;
    if (entry.navPlacement === 'footer') {
      footer.push(entry);
      continue;
    }
    if (entry.navPlacement !== 'primary') {
      more.push(entry);
      continue;
    }
    const group = entry.navGroup ?? 'everyday';
    const section = sections.find((candidate) => candidate.group === group);
    if (section) section.entries.push(entry);
    else sections.push({ group, entries: [entry] });
  }
  return { sections, more, footer };
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
