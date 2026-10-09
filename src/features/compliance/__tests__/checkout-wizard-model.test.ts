import { describe, expect, it } from 'vitest';
import type { CheckoutWizardState } from '@/types/compliance.types';
import {
  DEFAULT_CLEANING_CATEGORY,
  answersFromState,
  checkoutStepSchemas,
  completeCommand,
  progressCommand,
  stepFromState,
  type CheckoutAnswers,
} from '../checkout-wizard-model';

const ANSWERS: CheckoutAnswers = {
  departureConfirmed: true,
  cleaningChoice: 'Skip',
  supplierOrgId: null,
  serviceCategory: 'cleaning',
  serviceNotes: '',
  touristTaxCollection: 'CollectedAtProperty',
  propertyReady: true,
  propertyNotes: '',
};

function state(overrides: Partial<CheckoutWizardState> = {}): CheckoutWizardState {
  return {
    bookingId: 'b-1',
    bookingStatus: 'CheckedIn',
    currentStep: 'stay-summary',
    startedAt: '2026-09-24T09:00:00Z',
    completedAt: null,
    steps: [],
    stay: {
      guestName: 'Mario Rossi',
      propertyId: 'p-1',
      propertyName: 'Villa Aurora',
      propertyCity: 'Roma',
      checkInDate: '2026-09-22T00:00:00Z',
      checkOutDate: '2026-09-24T00:00:00Z',
      nights: 2,
      numberOfGuests: 2,
      numberOfAdults: 2,
      numberOfChildren: 0,
      arrivedAt: null,
      source: 'Manual',
      departureConfirmed: false,
    },
    alloggiati: { status: 'DaInviareManualmente', sent: false, deadlineAt: '2026-09-22T22:00:00Z', isOverdue: false, dataComplete: true },
    cleaning: { choice: null, supplierOrgId: null, category: null, notes: null, requestId: null },
    touristTax: { recordedAmount: 12, currency: 'EUR', collectedWithOnlinePayment: false, collection: null },
    propertyReady: { ready: null, readyAt: null, notes: null },
    ...overrides,
  };
}

/** The messages a step gives for these answers: empty when the step is valid. */
function problems(step: keyof typeof checkoutStepSchemas, answers: Partial<CheckoutAnswers>) {
  const schema = checkoutStepSchemas[step];
  if (!schema) throw new Error(`no rules for ${step}`);
  const result = schema.safeParse({ ...ANSWERS, ...answers });
  return result.success ? [] : result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

describe('answers from the server', () => {
  it('answersFromState_NothingAnsweredYet_StartsEmptyWithTheDefaultCategory', () => {
    expect(answersFromState(state())).toEqual({
      departureConfirmed: false,
      cleaningChoice: null,
      supplierOrgId: null,
      serviceCategory: DEFAULT_CLEANING_CATEGORY,
      serviceNotes: '',
      touristTaxCollection: null,
      propertyReady: null,
      propertyNotes: '',
    });
  });

  it('answersFromState_SavedProgress_GivesBackEveryAnswer', () => {
    const saved = answersFromState(
      state({
        stay: { ...state().stay, departureConfirmed: true },
        cleaning: { choice: 'Request', supplierOrgId: 's-1', category: 'maintenance', notes: 'Rubinetto', requestId: null },
        touristTax: { recordedAmount: 12, currency: 'EUR', collectedWithOnlinePayment: false, collection: 'NotDue' },
        propertyReady: { ready: false, readyAt: null, notes: 'Manca il letto' },
      }),
    );

    expect(saved).toEqual({
      departureConfirmed: true,
      cleaningChoice: 'Request',
      supplierOrgId: 's-1',
      serviceCategory: 'maintenance',
      serviceNotes: 'Rubinetto',
      touristTaxCollection: 'NotDue',
      propertyReady: false,
      propertyNotes: 'Manca il letto',
    });
  });

  it('answersFromState_TaxPaidOnlineAndNotAnsweredYet_ProposesCollectedOnline', () => {
    const proposed = answersFromState(
      state({ touristTax: { recordedAmount: 12, currency: 'EUR', collectedWithOnlinePayment: true, collection: null } }),
    );

    expect(proposed.touristTaxCollection).toBe('CollectedOnline');
  });

  it('answersFromState_TaxAnsweredAndPaidOnline_KeepsTheAnswer', () => {
    const kept = answersFromState(
      state({ touristTax: { recordedAmount: 12, currency: 'EUR', collectedWithOnlinePayment: true, collection: 'NotCollected' } }),
    );

    expect(kept.touristTaxCollection).toBe('NotCollected');
  });

  it.each([
    ['cleaning', 'cleaning'],
    ['property-ready', 'property-ready'],
    ['not-a-step', 'stay-summary'],
    ['', 'stay-summary'],
  ])('stepFromState_ServerSays%s_Opens%s', (current, expected) => {
    expect(stepFromState(state({ currentStep: current }))).toBe(expected);
  });
});

describe('rules of the steps', () => {
  it('checkoutStepSchemas_AlloggiatiStep_HasNoRulesBecauseItNeverBlocks', () => {
    expect(checkoutStepSchemas.alloggiati).toBeUndefined();
  });

  it('checkoutStepSchemas_StaySummary_NeedsTheDepartureConfirmed', () => {
    expect(problems('stay-summary', { departureConfirmed: false })).toEqual([
      { path: 'departureConfirmed', message: 'compliance.checkout.errors.confirmDeparture' },
    ]);
    expect(problems('stay-summary', { departureConfirmed: true })).toEqual([]);
  });

  it('checkoutStepSchemas_Cleaning_NeedsAChoice', () => {
    expect(problems('cleaning', { cleaningChoice: null })).toEqual([
      { path: 'cleaningChoice', message: 'compliance.checkout.errors.cleaningChoice' },
    ]);
    expect(problems('cleaning', { cleaningChoice: 'Skip' })).toEqual([]);
  });

  it('checkoutStepSchemas_CleaningRequest_NeedsTheSupplierAndTheCategory', () => {
    expect(problems('cleaning', { cleaningChoice: 'Request', supplierOrgId: null, serviceCategory: 'cleaning' })).toEqual([
      { path: 'supplierOrgId', message: 'compliance.checkout.errors.cleaningSupplier' },
    ]);
    expect(problems('cleaning', { cleaningChoice: 'Request', supplierOrgId: 's-1', serviceCategory: '' })).toEqual([
      { path: 'serviceCategory', message: 'compliance.checkout.errors.cleaningCategory' },
    ]);
    expect(problems('cleaning', { cleaningChoice: 'Request', supplierOrgId: null, serviceCategory: '' })).toHaveLength(2);
    expect(problems('cleaning', { cleaningChoice: 'Request', supplierOrgId: 's-1', serviceCategory: 'cleaning' })).toEqual([]);
  });

  it('checkoutStepSchemas_CleaningSkipped_IgnoresTheSupplierFields', () => {
    expect(problems('cleaning', { cleaningChoice: 'Skip', supplierOrgId: null, serviceCategory: '' })).toEqual([]);
  });

  it.each(['CollectedOnline', 'CollectedAtProperty', 'NotCollected', 'NotDue'] as const)(
    'checkoutStepSchemas_TouristTax_%sIsAnAnswer',
    (collection) => {
      expect(problems('tourist-tax', { touristTaxCollection: collection })).toEqual([]);
    },
  );

  it('checkoutStepSchemas_TouristTax_NeedsHowItWasCollected', () => {
    expect(problems('tourist-tax', { touristTaxCollection: null })).toEqual([
      { path: 'touristTaxCollection', message: 'compliance.checkout.errors.taxCollection' },
    ]);
  });

  it('checkoutStepSchemas_PropertyReady_NeedsAnAnswerAndNoIsAnAnswer', () => {
    expect(problems('property-ready', { propertyReady: null })).toEqual([
      { path: 'propertyReady', message: 'compliance.checkout.errors.propertyReady' },
    ]);
    expect(problems('property-ready', { propertyReady: true })).toEqual([]);
    expect(problems('property-ready', { propertyReady: false })).toEqual([]);
  });
});

describe('commands for the server', () => {
  it('progressCommand_Skipped_SendsNoSupplierDataAndTrimsTheNotes', () => {
    const command = progressCommand(
      { ...ANSWERS, supplierOrgId: 's-1', serviceNotes: 'Cambio biancheria', propertyNotes: '  Tutto ok  ' },
      'tourist-tax',
    );

    expect(command).toEqual({
      currentStep: 'tourist-tax',
      departureConfirmed: true,
      cleaningChoice: 'Skip',
      supplierOrgId: null,
      serviceCategory: null,
      serviceNotes: null,
      touristTaxCollection: 'CollectedAtProperty',
      propertyReady: true,
      propertyNotes: 'Tutto ok',
    });
  });

  it('progressCommand_Request_SendsTheSupplierTheCategoryAndTheNotes', () => {
    const command = progressCommand(
      { ...ANSWERS, cleaningChoice: 'Request', supplierOrgId: 's-1', serviceCategory: 'cleaning', serviceNotes: ' Cambio biancheria ' },
      'cleaning',
    );

    expect(command).toMatchObject({ supplierOrgId: 's-1', serviceCategory: 'cleaning', serviceNotes: 'Cambio biancheria' });
  });

  it('progressCommand_NothingAnsweredYet_KeepsTheNulls', () => {
    const command = progressCommand({ ...ANSWERS, departureConfirmed: false, cleaningChoice: null, touristTaxCollection: null, propertyReady: null }, 'stay-summary');

    expect(command).toMatchObject({ departureConfirmed: false, cleaningChoice: null, touristTaxCollection: null, propertyReady: null });
  });

  it('completeCommand_PropertyNotAnswered_IsNotReady', () => {
    expect(completeCommand({ ...ANSWERS, propertyReady: null }).propertyReady).toBe(false);
    expect(completeCommand({ ...ANSWERS, propertyReady: false }).propertyReady).toBe(false);
    expect(completeCommand({ ...ANSWERS, propertyReady: true }).propertyReady).toBe(true);
  });

  it('completeCommand_Answers_AreSentAsAnswered', () => {
    expect(completeCommand({ ...ANSWERS, cleaningChoice: 'Request', supplierOrgId: 's-1', serviceNotes: 'Note', propertyNotes: ' ' })).toEqual({
      confirmDeparture: true,
      cleaningChoice: 'Request',
      supplierOrgId: 's-1',
      serviceCategory: 'cleaning',
      serviceNotes: 'Note',
      touristTaxCollection: 'CollectedAtProperty',
      propertyReady: true,
      propertyNotes: null,
    });
  });
});
