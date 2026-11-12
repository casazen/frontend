import { describe, expect, it } from 'vitest';
import { ROUTE_MANIFEST, getManifestEntry, type PermissionPredicate, type RouteManifestEntry } from '@/config/route-manifest';
import {
  allLaunchCandidates,
  launchTargetForAction,
  resolveCandidates,
  resolveLaunchTarget,
} from '@/lib/onboarding-part-launch';
import { flowOfPart } from '@/lib/onboarding-flows';
import { ONBOARDING_FLOW_ACTIONS, ONBOARDING_LAUNCH_TARGETS, ONBOARDING_PART_KEYS } from '@/types/onboarding.types';

const PROPERTY = '9d4f6a0e-2c1b-4c5d-8e7f-3a2b1c0d9e8f';

/** The pages the registry names that exist today: a renamed page breaks this list, not the person. */
const EXISTING = [
  '/app/short-rent/integrations/octorate',
  '/app/short-rent/channels',
  '/app/short-rent/properties',
  '/app/short-rent/properties/create',
  '/app/short-rent/properties/:id/edit',
  '/app/short-rent/properties/:id/pricing',
  '/app/short-rent/properties/:id/activation',
  '/app/short-rent/compliance',
  '/app/short-rent/compliance/cin',
  '/app/short-rent/compliance/identification',
  '/app/short-rent/reports/tourist-tax',
  '/app/short-rent/fiscal/wizard',
  '/app/short-rent/fiscal/issuer',
  '/app/short-rent/marketplace',
];

const permissions =
  (granted: string[]): PermissionPredicate =>
  (contextKey, permission) =>
    contextKey === 'short-rent' && granted.includes(permission);

describe('the launch registry of the plan «Inizia con CasaZen» (E10/F03/US02/T02)', () => {
  it('registry_EveryCandidateThatExistsToday_IsAPageOfTheManifestInShortRent', () => {
    for (const path of EXISTING) {
      const entry = getManifestEntry(path);
      expect(entry, `${path} is not a route of the ROUTE_MANIFEST`).toBeDefined();
      expect(entry?.context, path).toBe('short-rent');
    }
  });

  it('registry_EveryPathItNames_IsEitherInTheManifestOrOnTheListOfThePagesOtherEpicsStillRegister', () => {
    // The ones that are not in the manifest yet are the paths the lead aligns with the tasks of E03 and E05; nothing else may be missing.
    const stillToRegister = new Set(['/app/short-rent/compliance/sender', '/app/short-rent/messages']);
    const missing = allLaunchCandidates()
      .map((candidate) => candidate.path)
      .filter((path) => !getManifestEntry(path) && !stillToRegister.has(path));

    expect(missing).toEqual([]);
  });

  it('registry_EveryLaunchTargetOfTheBackend_HasAnEntryAndEveryPartKeyHasAKnownFlowOrNone', () => {
    for (const target of ONBOARDING_LAUNCH_TARGETS) expect(Object.hasOwn({ connect: 1, mapping: 1, channels: 1, listings: 1, prices: 1, compliance: 1, identification: 1, messages: 1, fiscal: 1, marketplace: 1, summary: 1 }, target), target).toBe(true);
    // The parts that list properties name a flow; the partners and the summary list none.
    expect(ONBOARDING_PART_KEYS.filter((part) => flowOfPart(part) === undefined)).toEqual(['partners', 'activation']);
  });

  it('resolveLaunchTarget_PagesThatExist_ResolveToTheirAddressWithTheStepOfTheWizard', () => {
    expect(resolveLaunchTarget('connect')?.to).toBe('/app/short-rent/integrations/octorate?step=consent');
    expect(resolveLaunchTarget('mapping')?.to).toBe('/app/short-rent/integrations/octorate?step=mapping');
    expect(resolveLaunchTarget('channels')?.to).toBe('/app/short-rent/channels');
    expect(resolveLaunchTarget('identification')?.to).toBe('/app/short-rent/compliance/identification');
    expect(resolveLaunchTarget('fiscal')?.to).toBe('/app/short-rent/fiscal/wizard');
    expect(resolveLaunchTarget('marketplace')?.to).toBe('/app/short-rent/marketplace');
  });

  it('resolveLaunchTarget_APropertyIsNamed_OpensThePageOfThatProperty', () => {
    expect(resolveLaunchTarget('listings', null, PROPERTY)?.to).toBe(`/app/short-rent/properties/${PROPERTY}/edit`);
    expect(resolveLaunchTarget('prices', null, PROPERTY)?.to).toBe(`/app/short-rent/properties/${PROPERTY}/pricing`);
    expect(resolveLaunchTarget('compliance', null, PROPERTY)?.to).toBe(`/app/short-rent/properties/${PROPERTY}/activation`);
    // Without a property: the page of the whole org, never a path with its `:id` unfilled.
    expect(resolveLaunchTarget('listings')?.to).toBe('/app/short-rent/properties/create');
    expect(resolveLaunchTarget('prices')?.to).toBe('/app/short-rent/properties');
    expect(resolveLaunchTarget('compliance')?.to).toBe('/app/short-rent/compliance');
  });

  it('resolveLaunchTarget_FocusOfTheCompliance_OpensTheSenderTheCinOrTheTaxOfTheProperty', () => {
    // The sender wizard of E03 is not registered yet: the target falls back to the page that exists, and wins the day it is registered.
    expect(resolveLaunchTarget('compliance', 'sender', PROPERTY)?.to).toBe(`/app/short-rent/properties/${PROPERTY}/activation`);
    expect(resolveLaunchTarget('compliance', 'cin', PROPERTY)?.to).toBe(`/app/short-rent/properties/${PROPERTY}/activation?step=cin`);
    expect(resolveLaunchTarget('compliance', 'taxRate', PROPERTY)?.to).toBe(`/app/short-rent/properties/${PROPERTY}/activation?step=tourist-tax`);
    expect(resolveLaunchTarget('compliance', 'cin')?.to).toBe('/app/short-rent/compliance/cin');
    expect(resolveLaunchTarget('compliance', 'taxRate')?.to).toBe('/app/short-rent/reports/tourist-tax');
  });

  it('resolveLaunchTarget_PersonWhoMayNotOpenThePage_GetsNullNeverADeadLink', () => {
    const readOnly = permissions(['property.read']);

    // The activation of a property is written (`property.write`): a reader gets no link, and the part says so.
    expect(resolveLaunchTarget('compliance', null, PROPERTY, readOnly)).toBeNull();
    expect(resolveLaunchTarget('listings', null, PROPERTY, readOnly)).toBeNull();
    // A page they can read is still resolved.
    expect(resolveLaunchTarget('channels', null, null, readOnly)?.to).toBe('/app/short-rent/channels');
  });

  it('resolveLaunchTarget_UnknownTarget_ResolvesToNullNeverToTheDashboard', () => {
    expect(resolveLaunchTarget('somethingNew')).toBeNull();
    expect(resolveLaunchTarget('toString')).toBeNull();
    expect(resolveLaunchTarget('')).toBeNull();
  });

  it('resolveCandidates_TargetWithNoRegisteredPage_ResolvesToNullAndTheFirstPageThatIsThereWins', () => {
    const lookup = (registered: string[]) => (path: string): RouteManifestEntry | undefined => (registered.includes(path) ? ROUTE_MANIFEST.find((entry) => entry.path === '/app/short-rent/channels') : undefined);
    const candidates = [{ path: '/app/short-rent/nowhere' }, { path: '/app/short-rent/elsewhere', step: 'x y' }];

    expect(resolveCandidates(candidates, undefined, undefined, lookup([]))).toBeNull();
    // The first candidate that is a page of the manifest wins, and the step of a wizard is encoded.
    expect(resolveCandidates(candidates, undefined, undefined, lookup(['/app/short-rent/elsewhere']))?.to).toBe('/app/short-rent/elsewhere?step=x%20y');
    expect(resolveCandidates(candidates, undefined, undefined, lookup(['/app/short-rent/nowhere', '/app/short-rent/elsewhere']))?.to).toBe('/app/short-rent/nowhere');
    // A page of one property is not a candidate without the property.
    expect(resolveCandidates([{ path: '/app/short-rent/properties/:id/edit' }], undefined, undefined, lookup(['/app/short-rent/properties/:id/edit']))).toBeNull();
  });

  it('launchTargetForAction_EveryActionOfTheFlowStatus_TurnsIntoATargetThatIsInTheRegistry', () => {
    expect(launchTargetForAction('chooseSender')).toEqual({ target: 'compliance', focus: 'sender' });
    expect(launchTargetForAction('activate')).toEqual({ target: 'summary' });
    expect(launchTargetForAction('connect')).toEqual({ target: 'connect' });
    expect(launchTargetForAction('reconnect')).toEqual({ target: 'connect' });
    expect(launchTargetForAction('confirmMapping')).toEqual({ target: 'mapping' });
    expect(launchTargetForAction('fixListing')).toEqual({ target: 'listings' });
    for (const action of ONBOARDING_FLOW_ACTIONS) {
      const launch = launchTargetForAction(action);
      expect(launch, action).not.toBeNull();
      expect(ONBOARDING_LAUNCH_TARGETS as readonly string[], action).toContain(launch?.target);
    }
  });

  it('launchTargetForAction_ActionThisVersionDoesNotKnow_IsNull', () => {
    expect(launchTargetForAction('somethingNew')).toBeNull();
    expect(launchTargetForAction('toString')).toBeNull();
    expect(launchTargetForAction(null)).toBeNull();
    expect(launchTargetForAction(undefined)).toBeNull();
  });
});
