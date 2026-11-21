import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { getActivationBlockedProblem } from '@/api/compliance.api';
import {
  ACTIVATION_STEP_ORDER,
  ORIGIN_STEP_PARAM,
  REVIEW_STEP_ID,
  changedPropertyFields,
  initialStepId,
  knownBlockers,
  openReminders,
  propertyFormPayload,
  stepHref,
  wizardStepIds,
} from '../activation-wizard-model';
import type { ComplianceWizardStep } from '@/types/compliance.types';
import type { Property } from '@/types';

const property = {
  id: 'prop-1',
  name: 'Casa Palermo',
  description: 'Bilocale in centro storico',
  address: 'Via Roma 1',
  city: 'Palermo',
  postalCode: '90133',
  latitude: null,
  longitude: null,
  bedrooms: 1,
  bathrooms: 1,
  maxGuests: 4,
  nightlyRate: 90,
  cleaningFee: 30,
  damageDeposit: 0,
  amenities: ['WiFi', 'Kitchen'],
  houseRules: null,
  timezone: 'Europe/Rome',
  cancellationPolicyId: null,
  isActive: true,
  cinCode: 'IT082053C2ABCDEFGH',
  slug: null,
} as unknown as Property;

function step(id: string, status: ComplianceWizardStep['status'], blocker = true, blockers: ComplianceWizardStep['blockers'] = []) {
  return { id, label: id, status, blocker, blockers } as ComplianceWizardStep;
}

function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  });
}

describe('changedPropertyFields', () => {
  it('changedPropertyFields_FormSubmittedUnchanged_ReturnsNoField', () => {
    const stored = propertyFormPayload(property);
    // What the form sends for untouched fields: empty strings, reordered amenities, undefined coordinates.
    const submitted = { ...stored, houseRules: '', slug: '', latitude: undefined, amenities: ['Kitchen', 'WiFi'] };

    expect(changedPropertyFields(stored, submitted)).toEqual({});
  });

  it('changedPropertyFields_NameAndRateChanged_ReturnsOnlyThoseFields', () => {
    const stored = propertyFormPayload(property);

    expect(changedPropertyFields(stored, { ...stored, name: 'Casa al mare', nightlyRate: 110 })).toEqual({
      name: 'Casa al mare',
      nightlyRate: 110,
    });
  });

  it('changedPropertyFields_CinWithSpacesOrLowerCase_IsNotAChange', () => {
    const stored = propertyFormPayload(property);

    expect(changedPropertyFields(stored, { ...stored, cinCode: 'it 082053-c2abcdefgh' })).toEqual({});
  });

  it('changedPropertyFields_CinCleared_SendsTheExplicitRemoval', () => {
    const stored = propertyFormPayload(property);

    expect(changedPropertyFields(stored, { ...stored, cinCode: '' })).toEqual({ cinCode: '' });
  });
});

describe('wizard steps', () => {
  const steps = [
    step('ical', 'warning', false),
    step('base-data', 'complete'),
    step('cin', 'pending', true, [{ step: 'cin', code: 'activation_cin_missing', message: 'm' }]),
    step('safety', 'pending'),
    step('tourist-tax', 'warning', false),
  ];

  it('wizardStepIds_ApiOrderDifferent_UsesWizardOrderThenReview', () => {
    expect(wizardStepIds(steps)).toEqual(['base-data', 'cin', 'safety', 'tourist-tax', 'ical', REVIEW_STEP_ID]);
  });

  it('initialStepId_OpenBlockers_FirstOpenBlockingStep', () => {
    expect(initialStepId(steps)).toBe('cin');
  });

  it('initialStepId_EverythingComplete_Review', () => {
    expect(initialStepId(steps.map((s) => (s.blocker ? { ...s, status: 'complete' as const } : s)))).toBe(REVIEW_STEP_ID);
  });

  it('knownBlockers_StepWithoutBlockerDetails_GenericEntryForTheStep', () => {
    expect(knownBlockers(steps)).toEqual([
      { step: 'cin', code: 'activation_cin_missing', message: 'm' },
      { step: 'safety', code: '', message: '' },
    ]);
  });

  it('openReminders_DocumentsAndSafetyAsWarnings_TheyAreTheRemindersAndNoBlocker', () => {
    // PO decision 2026-11-01 (option A): the documents and the safety sheet do not block.
    const permissive = [
      step('base-data', 'complete'),
      step('cin', 'complete'),
      step('documents', 'warning', false),
      step('safety', 'warning', false, [{ step: 'safety', code: 'safety_confirmation_missing', message: '' }]),
      step('ical', 'warning', false),
    ];

    expect(openReminders(permissive).map((s) => s.id)).toEqual(['documents', 'safety']);
    expect(knownBlockers(permissive)).toEqual([]);
    expect(initialStepId(permissive)).toBe(REVIEW_STEP_ID);
    expect(openReminders(permissive.map((s) => ({ ...s, status: 'complete' as const })))).toEqual([]);
  });
});

describe('getActivationBlockedProblem', () => {
  it('getActivationBlockedProblem_Conflict409Blocked_ReadsBlockers', () => {
    const problem = getActivationBlockedProblem(
      httpError(409, {
        code: 'property_activation_blocked',
        complianceStatus: 'Pending',
        incompleteBlockers: ['cin', 42],
        blockers: [{ step: 'cin', code: 'activation_cin_invalid', message: 'x' }, { code: 'no-step' }],
      }),
    );

    expect(problem).toEqual({
      complianceStatus: 'Pending',
      incompleteBlockers: ['cin'],
      blockers: [{ step: 'cin', code: 'activation_cin_invalid', message: 'x' }],
    });
  });

  it('getActivationBlockedProblem_OtherConflictOrStatus_Undefined', () => {
    expect(getActivationBlockedProblem(httpError(409, { code: 'activation_tos_required' }))).toBeUndefined();
    expect(getActivationBlockedProblem(httpError(422, { code: 'property_activation_blocked' }))).toBeUndefined();
    expect(getActivationBlockedProblem(new Error('boom'))).toBeUndefined();
  });
});

// E29/F02/US02/T01: the step of a property in Switzerland, where the card of the regime of its canton is.
describe('the step «Notifica degli ospiti» of a property in Switzerland', () => {
  const swiss = step('guest-registration', 'pending', true, [{ step: 'guest-registration', code: 'ticino_structure_id_missing', message: 'm' }]);

  it('ActivationStepOrder_TheSwissStep_IsTheLastOfTheKnownOnesBeforeTheSummary', () => {
    expect(ACTIVATION_STEP_ORDER.at(-1)).toBe('guest-registration');
    expect(wizardStepIds([swiss, step('ical', 'warning', false), step('base-data', 'complete')])).toEqual(['base-data', 'ical', 'guest-registration', REVIEW_STEP_ID]);
  });

  it('InitialStepId_TheSwissStepIsTheFirstBlockerStillOpen_TheWizardOpensOnIt', () => {
    expect(initialStepId([step('base-data', 'complete'), swiss])).toBe('guest-registration');
    // For a property that is already active it is a reminder (it does not block): the wizard opens on the summary.
    expect(initialStepId([step('base-data', 'complete'), { ...swiss, status: 'warning', blocker: false }])).toBe(REVIEW_STEP_ID);
  });

  it('KnownBlockers_TheSwissStepWithItsReasons_ListsThemWithTheStepTheyBelongTo', () => {
    expect(knownBlockers([swiss])).toEqual([{ step: 'guest-registration', code: 'ticino_structure_id_missing', message: 'm' }]);
  });

  it('StepHref_AnyStep_KeepsTheAddressItAlwaysHad', () => {
    expect(stepHref('cin')).toEqual({ search: '?step=cin' });
    expect(stepHref('tourist-tax', REVIEW_STEP_ID)).toEqual({ search: '?step=tourist-tax' });
    expect(stepHref('guest-registration')).toEqual({ search: '?step=guest-registration' });
  });

  it('StepHref_TheSwissStepFromAnotherStep_RemembersWhereTheHostCameFrom', () => {
    expect(ORIGIN_STEP_PARAM).toBe('from');
    expect(stepHref('guest-registration', REVIEW_STEP_ID)).toEqual({ search: '?step=guest-registration&from=review' });
    expect(stepHref('guest-registration', 'base-data')).toEqual({ search: '?step=guest-registration&from=base-data' });
    // Never back to itself.
    expect(stepHref('guest-registration', 'guest-registration')).toEqual({ search: '?step=guest-registration' });
  });
});
