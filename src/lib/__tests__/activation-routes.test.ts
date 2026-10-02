import { describe, expect, it } from 'vitest';
import { activationStepCtaKey, activationStepRoute } from '../activation-routes';
import type { ActivationStep, ActivationStepKey } from '@/types/onboarding.types';
import type { PermissionPredicate } from '@/config/route-manifest';
import i18n from '@/i18n/config';

const ALL: PermissionPredicate = () => true;
const NONE: PermissionPredicate = () => false;

function step(key: ActivationStepKey, state: ActivationStep['state'], reason: ActivationStep['reason'] = null): ActivationStep {
  return { key, state, reason };
}

describe('activationStepRoute (PL-15)', () => {
  it.each([
    [step('account', 'todo', 'onboarding_incomplete'), '/onboarding'],
    [step('organization', 'todo', 'org_profile_incomplete'), '/app/short-rent/settings/organization'],
    [step('property', 'todo', 'no_property'), '/app/short-rent/properties/create'],
    [step('cin', 'inProgress', 'cin_missing_or_invalid'), '/app/short-rent/properties'],
    [step('payments', 'todo', 'connect_not_started'), '/app/short-rent/settings/payments'],
    [step('payments', 'inProgress', 'connect_requirements_due'), '/app/short-rent/settings/payments'],
    [step('sitePublished', 'todo', 'properties_paused'), '/app/short-rent/properties'],
    [step('sitePublished', 'todo', 'compliance_pending'), '/app/short-rent/compliance'],
    [step('sitePublished', 'inProgress', 'payments_not_ready'), '/app/short-rent/settings/payments'],
    [step('firstBooking', 'todo', 'awaiting_first_booking'), '/app/short-rent/vetrina'],
  ])('activationStepRoute_%j_OpensThePageThatFixesIt', (activationStep, expected) => {
    expect(activationStepRoute(activationStep, ALL)).toBe(expected);
  });

  it('activationStepRoute_DoneOrBlockedStep_OffersNoPage', () => {
    expect(activationStepRoute(step('payments', 'done'), ALL)).toBeNull();
    expect(activationStepRoute(step('cin', 'blocked', 'no_property'), ALL)).toBeNull();
    expect(activationStepRoute(step('firstBooking', 'blocked', 'site_not_published'), ALL)).toBeNull();
  });

  it('activationStepRoute_UserWithoutThePermissionOfThePage_OffersNoPage', () => {
    // Payments need property.write, the organization page the org administrator: the guard would send them away.
    expect(activationStepRoute(step('payments', 'todo', 'connect_not_started'), NONE)).toBeNull();
    expect(activationStepRoute(step('organization', 'todo', 'org_profile_incomplete'), NONE)).toBeNull();
    // The wizard of the first access has no permission.
    expect(activationStepRoute(step('account', 'todo', 'onboarding_incomplete'), NONE)).toBe('/onboarding');
  });

  it('activationStepRoute_DisabledOrgOrUnknownReason_OffersNoPageToGuess', () => {
    expect(activationStepRoute(step('sitePublished', 'blocked', 'org_inactive'), ALL)).toBeNull();
    expect(
      activationStepRoute(step('sitePublished', 'todo', 'a_future_reason' as ActivationStep['reason']), ALL),
    ).toBeNull();
  });
});

describe('activationStepCtaKey (PL-15)', () => {
  it('activationStepCtaKey_PaymentsNotStartedOrStarted_AsksToConnectOrToContinue', () => {
    expect(activationStepCtaKey(step('payments', 'todo', 'connect_not_started'))).toBe('activation.cta.paymentsStart');
    expect(activationStepCtaKey(step('payments', 'inProgress', 'connect_requirements_due'))).toBe(
      'activation.cta.paymentsContinue',
    );
  });

  it('activationStepCtaKey_EveryStepAndReason_HasALabelInBothLanguages', () => {
    const keys: ActivationStepKey[] = ['account', 'organization', 'property', 'cin', 'payments', 'sitePublished', 'firstBooking'];
    const reasons: ActivationStep['reason'][] = [
      null,
      'no_property',
      'properties_paused',
      'properties_inactive',
      'compliance_pending',
      'payments_not_ready',
    ];
    for (const key of keys) {
      for (const state of ['todo', 'inProgress'] as const) {
        for (const reason of reasons) {
          const cta = activationStepCtaKey(step(key, state, reason));
          expect(i18n.exists(cta, { lng: 'it' }), `it ${cta}`).toBe(true);
          expect(i18n.exists(cta, { lng: 'en' }), `en ${cta}`).toBe(true);
        }
      }
    }
  });
});
