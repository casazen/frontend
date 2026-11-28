import { describe, expect, it } from 'vitest';
import { billingStepOfItem, billingStepOfReason } from '@/lib/onboarding-billing';
import type { BillingSetup } from '@/types';
import { BILLING_STEPS } from '../billing-wizard-ids';
import { ownerIssuersMissing, sdiConnectionOf, stepIdsFor } from '../billing-wizard-model';

const italy = (missing: BillingSetup['sections'][number]['missing']): BillingSetup => ({
  complete: missing.length === 0,
  sections: [{ section: 'italy', applies: true, complete: missing.length === 0, values: {}, missing }],
});

describe('the Italian steps of the wizard «Fatturazione» (E17/F03/US01)', () => {
  it('stepIdsFor_WithNoItalianStep_IsTheWizardItWas', () => {
    const was = [BILLING_STEPS.issuer, BILLING_STEPS.vat, BILLING_STEPS.numbering, BILLING_STEPS.touristTax, BILLING_STEPS.channels, BILLING_STEPS.mandate, BILLING_STEPS.issuing, BILLING_STEPS.italy, BILLING_STEPS.summary];
    expect(stepIdsFor('IT', true)).toEqual(was);
    expect(stepIdsFor('IT', true, false, {})).toEqual(was);
    expect(stepIdsFor('IT', true, false, { ownerIssuers: false, sdi: false })).toEqual(was);
  });

  it('stepIdsFor_TheOwnersWhoIssue_AreAStepOnlyForAnAgencyThatHasThem_AfterItalia', () => {
    const steps = stepIdsFor('IT', true, false, { ownerIssuers: true });
    expect(steps).toEqual([
      BILLING_STEPS.issuer,
      BILLING_STEPS.vat,
      BILLING_STEPS.numbering,
      BILLING_STEPS.touristTax,
      BILLING_STEPS.channels,
      BILLING_STEPS.mandate,
      BILLING_STEPS.issuing,
      BILLING_STEPS.italy,
      BILLING_STEPS.ownerIssuers,
      BILLING_STEPS.summary,
    ]);
    expect(stepIdsFor('IT', false, false, { ownerIssuers: true })).not.toContain(BILLING_STEPS.ownerIssuers);
    const swiss = stepIdsFor('CH', true, false, { ownerIssuers: true });
    expect(swiss).toContain(BILLING_STEPS.ownerIssuers);
    expect(swiss).not.toContain(BILLING_STEPS.italy);
  });

  it('stepIdsFor_TheSendingToTheSdi_IsAStepOnlyForAnItalianIssuer_BeforeTheAccountant', () => {
    expect(stepIdsFor('IT', false, true, { sdi: true })).toEqual([
      BILLING_STEPS.issuer,
      BILLING_STEPS.vat,
      BILLING_STEPS.numbering,
      BILLING_STEPS.touristTax,
      BILLING_STEPS.issuing,
      BILLING_STEPS.italy,
      BILLING_STEPS.sdi,
      BILLING_STEPS.accountant,
      BILLING_STEPS.summary,
    ]);
    expect(stepIdsFor('CH', true, false, { sdi: true })).not.toContain(BILLING_STEPS.sdi);
    expect(stepIdsFor('', true, false, { sdi: true })).not.toContain(BILLING_STEPS.sdi);
  });

  it('theItemsOfTheItalianSection_ReopenTheirOwnStep_AndAnUnknownOneStillOpensItalia', () => {
    expect(billingStepOfItem({ key: 'owner_issuer_missing', section: 'italy' })).toBe(BILLING_STEPS.ownerIssuers);
    expect(billingStepOfItem({ key: 'sdi_issuer_registration_pending', section: 'italy' })).toBe(BILLING_STEPS.sdi);
    expect(billingStepOfReason('owner_issuer_missing')).toBe(BILLING_STEPS.ownerIssuers);
    expect(billingStepOfItem({ key: 'brand_new_item', section: 'italy' })).toBe(BILLING_STEPS.italy);
  });

  it('ownerIssuersMissing_IsTheCountOfTheServer_NeverWorkedOutFromTheRows', () => {
    expect(ownerIssuersMissing(undefined)).toBe(0);
    expect(ownerIssuersMissing(italy([]))).toBe(0);
    expect(ownerIssuersMissing(italy([{ key: 'owner_issuer_missing', section: 'italy', reason: 'required', count: 3 }]))).toBe(3);
    expect(ownerIssuersMissing(italy([{ key: 'owner_issuer_missing', section: 'italy', reason: 'required' }]))).toBe(0);
  });

  it('sdiConnectionOf_ConnectedOnlyWithAChannelAndTheSendingOn_WaitingForTheCredentialsWithout_NotConnectedWhenItIsOff', () => {
    expect(sdiConnectionOf({ providerConfigured: true, sendingOn: true })).toBe('connected');
    expect(sdiConnectionOf({ providerConfigured: false, sendingOn: true })).toBe('waitingCredentials');
    expect(sdiConnectionOf({ providerConfigured: true, sendingOn: false })).toBe('notConnected');
    expect(sdiConnectionOf({ providerConfigured: false, sendingOn: false })).toBe('notConnected');
  });
});
