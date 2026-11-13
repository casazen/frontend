import { generatePath } from 'react-router-dom';
import { getManifestEntry, hasEntryPermission, type PermissionPredicate, type RouteManifestEntry } from '@/config/route-manifest';
import type { OnboardingFlowAction, OnboardingLaunchTarget } from '@/types/onboarding.types';

/**
 * The launchers of the plan «Inizia con CasaZen» (E10/F03/US02/T02, NF-104): which page opens each part, resolved against the ROUTE_MANIFEST the way
 * `activation-routes.ts` does. The onboarding never re-implements a wizard: it names where the wizard that owns a part lives, and a page that does
 * not exist (yet) leads nowhere, so the part says «Non ancora disponibile» and no link is ever dead.
 *
 * The registry is keyed by the `launchTarget` code the plan and the reopen of the backend return. Each target is an ordered list of candidate
 * paths, with an optional `step` of a wizard: the first candidate that is in the manifest and that the person may open wins. A candidate is a
 * manifest path, `:id` included, and a candidate with `:id` is for one property.
 */

/** What a target is for when the plan names more than a part: the choice of the sender, the CIN or the tourist tax rate of a property (`compliance`). */
export type LaunchFocus = 'sender' | 'cin' | 'taxRate';

/** One page a target can open: its manifest path and, for a wizard, the step it opens on. */
export interface LaunchCandidate {
  path: string;
  step?: string;
  /**
   * The query parameter that carries the property into a page that is not «of one property» by its path (`:id`): the sender wizard reads `?property=<id>`. It is written
   * when the caller names a property; a caller that names none opens the page without it, and the page asks which property.
   */
  propertyParam?: string;
}

interface LaunchEntry {
  /** For one property (`:id` in the path), tried first when the caller names a property. */
  property?: readonly LaunchCandidate[];
  /** For the whole org, or for a caller that names no property. */
  general: readonly LaunchCandidate[];
  /** What a focus asks for, instead of the lists above (tried first, then the lists above). */
  focus?: Partial<Record<LaunchFocus, { property?: readonly LaunchCandidate[]; general?: readonly LaunchCandidate[] }>>;
}

/** The connect wizard of E02 (`fe-octorate-connect-wizard`): the consent, the listings found, the mapping and the existing inventory import. */
const CONNECT = '/app/short-rent/integrations/octorate';
const ACTIVATION = '/app/short-rent/properties/:id/activation';

/**
 * The registry. The pages the other epics still have to register (the inbox of E05; the sender wizard of E03 is registered now) come FIRST in their lists: while they
 * are not in the manifest the target falls back to the page that exists, and the day they are registered they win by themselves. The paths are the
 * ones the lead aligns with their tasks (epic risks); `onboarding-part-launch.test.ts` keeps the ones that exist today in the manifest.
 */
const REGISTRY: Readonly<Record<OnboardingLaunchTarget, LaunchEntry>> = {
  connect: { general: [{ path: CONNECT, step: 'consent' }] },
  mapping: { general: [{ path: CONNECT, step: 'mapping' }] },
  channels: { general: [{ path: '/app/short-rent/channels' }, { path: CONNECT, step: 'channels' }] },
  listings: { property: [{ path: '/app/short-rent/properties/:id/edit' }], general: [{ path: '/app/short-rent/properties/create' }] },
  prices: { property: [{ path: '/app/short-rent/properties/:id/pricing' }], general: [{ path: '/app/short-rent/properties' }] },
  compliance: {
    property: [{ path: ACTIVATION }],
    general: [{ path: '/app/short-rent/compliance' }],
    focus: {
      // The sender wizard of E03 (E03/F01/US02/T02) is registered: it wins for a property (`?property=<id>`) and, with none named, opens on the choice of the property.
      sender: {
        general: [{ path: '/app/short-rent/compliance/sender' }, { path: '/app/short-rent/compliance' }],
        property: [{ path: '/app/short-rent/compliance/sender', propertyParam: 'property' }, { path: ACTIVATION }],
      },
      cin: { general: [{ path: '/app/short-rent/compliance/cin' }], property: [{ path: ACTIVATION, step: 'cin' }] },
      taxRate: { general: [{ path: '/app/short-rent/reports/tourist-tax' }], property: [{ path: ACTIVATION, step: 'tourist-tax' }] },
    },
  },
  identification: { general: [{ path: '/app/short-rent/compliance/identification' }] },
  messages: { general: [{ path: '/app/short-rent/messages' }] },
  fiscal: { general: [{ path: '/app/short-rent/fiscal/wizard' }, { path: '/app/short-rent/fiscal/issuer' }] },
  marketplace: { general: [{ path: '/app/short-rent/marketplace' }] },
  summary: { general: [{ path: '/app/short-rent/onboarding/summary' }] },
};

/** The page a target opens for a person, with the address to go to: the manifest entry that was found and the full address (the property and the step filled in). */
export interface ResolvedLaunch {
  entry: RouteManifestEntry;
  /** The address: the path with the property in it, and the step of a wizard in the query. */
  to: string;
}

/** The first candidate in the list that is a page of the manifest the person may open, as an address; `null` when none is. */
export function resolveCandidates(
  candidates: readonly LaunchCandidate[],
  propertyId: string | undefined,
  hasPermission?: PermissionPredicate,
  lookup: (path: string) => RouteManifestEntry | undefined = getManifestEntry,
): ResolvedLaunch | null {
  for (const candidate of candidates) {
    const entry = lookup(candidate.path);
    if (!entry || !hasEntryPermission(entry, hasPermission)) continue;
    // A page of one property needs the property; without it the page is not a candidate.
    if (candidate.path.includes(':id') && !propertyId) continue;
    const path = candidate.path.includes(':id') ? generatePath(candidate.path, { id: propertyId ?? '' }) : candidate.path;
    const query: string[] = [];
    if (candidate.propertyParam && propertyId) query.push(`${candidate.propertyParam}=${encodeURIComponent(propertyId)}`);
    if (candidate.step) query.push(`step=${encodeURIComponent(candidate.step)}`);
    return { entry, to: query.length > 0 ? `${path}?${query.join('&')}` : path };
  }
  return null;
}

/**
 * The page that does a launch target (and, for `compliance`, its focus) for a property or for the whole org, resolved against the ROUTE_MANIFEST:
 * `null` when no candidate is a page the person may open (the part then says «Non ancora disponibile», never a dead link). A target this version of
 * the app does not know (the server is newer) resolves to `null` too.
 */
export function resolveLaunchTarget(
  target: OnboardingLaunchTarget | string,
  focus?: LaunchFocus | null,
  propertyId?: string | null,
  hasPermission?: PermissionPredicate,
): ResolvedLaunch | null {
  if (!Object.hasOwn(REGISTRY, target)) return null;
  const entry = REGISTRY[target as OnboardingLaunchTarget];
  const property = propertyId ?? undefined;
  const focused = focus ? entry.focus?.[focus] : undefined;
  const lists = [
    ...(property ? [focused?.property, entry.property] : []),
    focused?.general,
    entry.general,
  ];
  for (const list of lists) {
    const resolved = list ? resolveCandidates(list, property, hasPermission) : null;
    if (resolved) return resolved;
  }
  return null;
}

/** What a «Do now» action of the flow status asks of the registry: the target and the focus to resolve. */
export interface ActionLaunch {
  target: OnboardingLaunchTarget;
  focus?: LaunchFocus;
}

const ACTION_LAUNCH: Readonly<Record<OnboardingFlowAction, ActionLaunch>> = {
  connect: { target: 'connect' },
  reconnect: { target: 'connect' },
  confirmMapping: { target: 'mapping' },
  chooseSender: { target: 'compliance', focus: 'sender' },
  fixListing: { target: 'listings' },
  enterCin: { target: 'compliance', focus: 'cin' },
  enterTaxRate: { target: 'compliance', focus: 'taxRate' },
  activate: { target: 'summary' },
};

/**
 * The target and the focus a «Do now» action of the flow status resolves to (`chooseSender` is `compliance` with the focus `sender`, `activate` is
 * the summary); `null` for an action this version of the app does not know.
 */
export function launchTargetForAction(action: OnboardingFlowAction | string | null | undefined): ActionLaunch | null {
  return typeof action === 'string' && Object.hasOwn(ACTION_LAUNCH, action) ? ACTION_LAUNCH[action as OnboardingFlowAction] : null;
}

/** Every candidate path of the registry, for the test that keeps the pages it names in the manifest. */
export function allLaunchCandidates(): LaunchCandidate[] {
  return Object.values(REGISTRY).flatMap((entry) => [
    ...(entry.property ?? []),
    ...entry.general,
    ...Object.values(entry.focus ?? {}).flatMap((focused) => [...(focused?.property ?? []), ...(focused?.general ?? [])]),
  ]);
}
