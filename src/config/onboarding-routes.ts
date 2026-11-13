import type { RouteManifestEntry } from './route-manifest';

/**
 * The pages of the activation of CasaZen with Octorate (epic E10), all behind the flag `octorateOnboarding` (backend `OctorateOnboarding`): while it
 * is off an entry is in no menu and its address leads to the home of the area, as for every flagged entry of the manifest.
 *
 * `ROUTE_MANIFEST` spreads this list once. Convention: each page task of the epic adds its own entry HERE and never to the manifest, so the shared
 * manifest is touched once. This file imports the manifest for its type only (the import is erased), so the two do not depend on each other at run time.
 */
export const ONBOARDING_ROUTES: RouteManifestEntry[] = [
  {
    // «Inizia con CasaZen» (E10/F03/US01/T02, NF-104): the plan of the eleven parts. An entry of «Altro»: the main menu has its eight entries,
    // and the way in is the card of the path on the home (`OnboardingPathCard`). It asks `property.read`, what the plan the server answers
    // asks (`SharedPropertyRead`): the deferral and the exit are the organization administrator's, and the page says so to anyone else.
    path: '/app/short-rent/onboarding',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    featureFlag: 'octorateOnboarding',
    navKey: 'nav.onboardingPlan',
    navPlacement: 'secondary',
    navOrder: 32,
    icon: 'ClipboardCheck',
    component: async () => ({ default: (await import('@/features/onboarding/onboarding-plan-page')).OnboardingPlanPage }),
  },
  {
    // One part of the plan (E10/F03/US02/T02, NF-104): what it does, what the host needs, where it stands, its properties and the one button that opens the
    // wizard that owns it. In no menu: the plan, the next-step card and the «Da fare» of a part lead here. An unknown `:partKey` leads to the plan.
    path: '/app/short-rent/onboarding/parts/:partKey',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    featureFlag: 'octorateOnboarding',
    component: async () => ({ default: (await import('@/features/onboarding/onboarding-part-page')).OnboardingPartPage }),
  },
  {
    // «Riepilogo e attivazione», the last part of the plan (E10/F03/US02/T03, NF-104 part 11, NF-106): the traffic light of each flow on each property, the
    // final read-only test and the activation. In no menu. The table is read by whoever reads the properties (`property.read`); the test and the activation
    // are the organization administrator's, and the page tells anyone else so. `?flow=` opens the table on a flow (the target of the «Da fare» of a flow).
    path: '/app/short-rent/onboarding/summary',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    featureFlag: 'octorateOnboarding',
    component: async () => ({ default: (await import('@/features/onboarding/onboarding-summary-page')).OnboardingSummaryPage }),
  },
  {
    // A step that Octorate allows only from its panel (E10/F03/US02/T01, NF-107): `police`, `istat` or `channel-access`, with the property and the
    // channel in the query. In no menu: the plan, the parts and the «Da fare» of a step left half way lead here. The panel steps are written
    // (`property.write`); the page tells anyone who is not the organization administrator who does the step, instead of meeting a 403.
    path: '/app/short-rent/onboarding/panel/:kind',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    featureFlag: 'octorateOnboarding',
    component: async () => ({ default: (await import('@/features/onboarding/onboarding-panel-step-page')).OnboardingPanelStepPage }),
  },
  {
    // Where the «Da fare» of a guided step leads (`?step=<id>`: the item knows the step, not its kind): it finds the step and opens its page.
    path: '/app/short-rent/onboarding/panel',
    context: 'short-rent',
    requiredPermissions: ['property.write'],
    featureFlag: 'octorateOnboarding',
    component: async () => ({ default: (await import('@/features/onboarding/onboarding-panel-step-page')).OnboardingPanelResumePage }),
  },
  {
    // The integration settings (E10/F03/US03/T01, NF-108, ONB-05): the health of the connection, what can be reopened (the sender of the Alloggiati communications,
    // a channel, the properties, any part of the plan) and how the properties and the listings stand. An entry of «Altro» for the organization administrator
    // (`orgBillingAdmin`, as the server asks `OrgBillingAdmin`): anyone else who opens the address reads who manages the page and no request is sent.
    path: '/app/short-rent/settings/integration',
    context: 'short-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    featureFlag: 'octorateOnboarding',
    navKey: 'nav.integrationSettings',
    navPlacement: 'secondary',
    navOrder: 34,
    icon: 'Settings',
    component: async () => ({ default: (await import('@/features/onboarding/integration-settings-page')).IntegrationSettingsPage }),
  },
  {
    // The bulk configuration (E10/F03/US03/T02, NF-105, ONB-02): an agency with many properties applies one choice to all of them or to a selection, fills the
    // data that changes per property from a file, follows how many are ready and activates a pilot group first. In no menu: the plan leads here when the agency
    // has more than 10 properties. The organization administrator's page (`orgBillingAdmin`: the server asks `OrgBillingAdmin`): anyone else who opens the
    // address reads who manages it and no request is sent.
    path: '/app/short-rent/onboarding/bulk',
    context: 'short-rent',
    requiredPermissions: [],
    orgBillingAdmin: true,
    featureFlag: 'octorateOnboarding',
    component: async () => ({ default: (await import('@/features/onboarding/onboarding-bulk-page')).OnboardingBulkPage }),
  },
  {
    // The staff queue of the «Fallo per me» requests (E10/F03/US03/T03, NF-107, NF-15, UX-15): where CasaZen support takes a request, closes it or cancels it with a
    // short note. An entry of «Altro» of the staff area, asking what the other queue pages of the staff ask (`admin.users.read`); the backend still decides: the
    // endpoints answer only to a platform administrator, and every update is logged in the log of the organization of the request.
    path: '/app/admin/onboarding-assist',
    context: 'admin',
    requiredPermissions: ['admin.users.read'],
    featureFlag: 'octorateOnboarding',
    navKey: 'nav.onboardingAssist',
    navGroup: 'platform',
    navPlacement: 'secondary',
    navOrder: 27,
    icon: 'Wrench',
    component: async () => ({ default: (await import('@/features/admin/admin-assist-queue-page')).AdminAssistQueuePage }),
  },
];
