import { generatePath } from 'react-router-dom';
import type { FeatureFlags } from '@/config/feature-flags';
import { getManifestEntry, hasEntryPermission, isEntryFeatureEnabled, type PermissionPredicate, type RouteManifestEntry } from '@/config/route-manifest';
import { BILLING_SETUP_PATH } from '@/features/fiscal/billing-wizard/billing-wizard-ids';
import { billingStepOfReason } from '@/lib/onboarding-billing';
import { GUEST_REGISTRATION_STEP_ID } from '@/types/guest-registration.types';
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

export interface LaunchCandidate {
  path: string;
  step?: string;
  propertyParam?: string;
}

interface LaunchEntry {
  property?: readonly LaunchCandidate[];
  general: readonly LaunchCandidate[];
  /** What a focus asks for, instead of the lists above (tried first, then the lists above). */
  focus?: Partial<Record<LaunchFocus, { property?: readonly LaunchCandidate[]; general?: readonly LaunchCandidate[] }>>;
  /**
   * The step of the wizard to open on, from the reason the part is open for (the part «Fatturazione» opens its wizard at the step of its first missing item). `null`: the
   * reason says no step, and the wizard opens where it would without one. A step the candidate itself names (`LaunchCandidate.step`) is used when the reason gives none.
   */
  stepOfReason?: (reason: string | null | undefined) => string | null;
  /**
   * The page of the target is behind a feature flag (the wizard «Fatturazione» is behind `fiscalDocumentIssuance`) and the target exists only while that flag is on: with the
   * flag off, or while the flags are not known, nothing resolves and the part says «Non ancora disponibile». A link to it would be sent back to the home of the area by the
   * route guard, which is a dead link. The callers pass the flags to `resolveLaunchTarget`; a target without this mark ignores them.
   */
  needsFeatureFlag?: boolean;
}

const CONNECT = '/app/short-rent/integrations/octorate';
const ACTIVATION = '/app/short-rent/properties/:id/activation';

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
  // The wizard «Fatturazione» (E11/F02/US01/T01): the whole invoicing setup, opened at the step its part is missing. Its route exists only while the issuance of the fiscal
  // documents is on: with it off the part says «Non ancora disponibile» instead of leading to the home of the area.
  fiscal: { general: [{ path: BILLING_SETUP_PATH }], stepOfReason: billingStepOfReason, needsFeatureFlag: true },
  marketplace: { general: [{ path: '/app/short-rent/marketplace' }] },
  summary: { general: [{ path: '/app/short-rent/onboarding/summary' }] },
  guestRegistration: { property: [{ path: ACTIVATION, step: GUEST_REGISTRATION_STEP_ID }], general: [{ path: '/app/short-rent/properties' }] },
};

export interface ResolvedLaunch {
  entry: RouteManifestEntry;
  to: string;
}

export function resolveCandidates(
  candidates: readonly LaunchCandidate[],
  propertyId: string | undefined,
  hasPermission?: PermissionPredicate,
  lookup: (path: string) => RouteManifestEntry | undefined = getManifestEntry,
  step?: string | null,
  gate?: { features: Partial<FeatureFlags> | undefined },
): ResolvedLaunch | null {
  for (const candidate of candidates) {
    const entry = lookup(candidate.path);
    if (!entry || !hasEntryPermission(entry, hasPermission)) continue;
    if (gate && !isEntryFeatureEnabled(entry, gate.features)) continue;
    if (candidate.path.includes(':id') && !propertyId) continue;
    const path = candidate.path.includes(':id') ? generatePath(candidate.path, { id: propertyId ?? '' }) : candidate.path;
    const query: string[] = [];
    if (candidate.propertyParam && propertyId) query.push(`${candidate.propertyParam}=${encodeURIComponent(propertyId)}`);
    const opensOn = step ?? candidate.step;
    if (opensOn) query.push(`step=${encodeURIComponent(opensOn)}`);
    return { entry, to: query.length > 0 ? `${path}?${query.join('&')}` : path };
  }
  return null;
}

/**
 * The page that does a launch target (and, for `compliance`, its focus) for a property or for the whole org, resolved against the ROUTE_MANIFEST:
 * `null` when no candidate is a page the person may open (the part then says «Non ancora disponibile», never a dead link). A target this version of
 * the app does not know (the server is newer) resolves to `null` too. `reason` is the reason the part is open for: a wizard that has the steps of its own parts
 * (the registry says how, `stepOfReason`) opens at the one the reason points to. `features` are the flags the page is shown under: a target that exists only while its flag
 * is on (`needsFeatureFlag`, the wizard «Fatturazione») resolves to `null` without them, so a caller that does not pass them never leads to a page the guard refuses.
 */
export function resolveLaunchTarget(
  target: OnboardingLaunchTarget | string,
  focus?: LaunchFocus | null,
  propertyId?: string | null,
  hasPermission?: PermissionPredicate,
  reason?: string | null,
  features?: Partial<FeatureFlags>,
): ResolvedLaunch | null {
  if (!Object.hasOwn(REGISTRY, target)) return null;
  const entry = REGISTRY[target as OnboardingLaunchTarget];
  const property = propertyId ?? undefined;
  const focused = focus ? entry.focus?.[focus] : undefined;
  const step = entry.stepOfReason?.(reason) ?? null;
  const gate = entry.needsFeatureFlag ? { features } : undefined;
  const lists = [
    ...(property ? [focused?.property, entry.property] : []),
    focused?.general,
    entry.general,
  ];
  for (const list of lists) {
    const resolved = list ? resolveCandidates(list, property, hasPermission, getManifestEntry, step, gate) : null;
    if (resolved) return resolved;
  }
  return null;
}

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
  chooseIssuer: { target: 'fiscal' },
};

export function launchTargetForAction(action: OnboardingFlowAction | string | null | undefined): ActionLaunch | null {
  return typeof action === 'string' && Object.hasOwn(ACTION_LAUNCH, action) ? ACTION_LAUNCH[action as OnboardingFlowAction] : null;
}

export function allLaunchCandidates(): LaunchCandidate[] {
  return Object.values(REGISTRY).flatMap((entry) => [
    ...(entry.property ?? []),
    ...entry.general,
    ...Object.values(entry.focus ?? {}).flatMap((focused) => [...(focused?.property ?? []), ...(focused?.general ?? [])]),
  ]);
}
