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
];
