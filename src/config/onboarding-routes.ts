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
    // The owner step of the plan (E10/F03/US05/T01, NF-109, ONB-06), for an org on the agency plan: the owners imported or completed, their associations and shares,
    // the data for the statements and the invitations to the portal, with the accounting for the owners told apart from the properties that work. In no menu: a row of
    // the plan (`OwnerStepRow`, drawn only for the agency plan and its administrator) leads here. It asks `property.read` like the plan; the owners are the organization
    // administrator's (the server asks the agency permissions of the owner and the administrators), and the page tells anyone else so instead of meeting a 403. The page
    // also reads the agency plan flag (`agencyTier`): while it is off the address leads back to the plan.
    path: '/app/short-rent/onboarding/owners',
    context: 'short-rent',
    requiredPermissions: ['property.read'],
    orgBillingAdmin: true,
    featureFlag: 'octorateOnboarding',
    component: async () => ({ default: (await import('@/features/onboarding/owner-onboarding-page')).OwnerOnboardingPage }),
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
];
