import { describe, expect, it } from 'vitest';
import { ownerReadinessOn } from '@/features/owner-accounting/owner-accounting-model';
import { policy, profile } from '@/features/owner-accounting/__tests__/owner-accounting-fixtures';
import type { OwnerIssuerProfile, OwnerMandate } from '@/types';
import {
  completedSteps,
  documentsState,
  identityState,
  mandateState,
  parseTab,
  paymentsState,
  ruleState,
  shownValue,
  tabSearch,
  type OwnerTab,
} from '../owner-profile-model';

const DAY = '2026-11-27';
const TABS: OwnerTab[] = ['overview', 'identity', 'payments', 'mandate', 'rule', 'reports'];

const readiness = (profileOverrides = {}, policyOverrides = {}) => ownerReadinessOn([profile(profileOverrides)], [policy(policyOverrides)], DAY);

const mandate = (overrides: Partial<OwnerMandate> = {}): OwnerMandate =>
  ({ id: 'm', ownerId: 'o', validFrom: '2026-01-01', validTo: null, commissionPercent: 20, commissionIncludesVat: false, ...overrides }) as OwnerMandate;

const issuer = (overrides: Partial<OwnerIssuerProfile> = {}): OwnerIssuerProfile => ({ exists: true, canIssue: true, countryCode: 'IT', ...overrides }) as OwnerIssuerProfile;

describe('the section of the page that the address names', () => {
  it('OwnerTab_AKnownSection_IsOpened_AnythingElseOpensTheOverview', () => {
    expect(parseTab('payments', TABS)).toBe('payments');
    expect(parseTab('documents', TABS)).toBe('overview');
    expect(parseTab('nonsense', TABS)).toBe('overview');
    expect(parseTab(null, TABS)).toBe('overview');
  });

  it('OwnerTab_TheAddressOfASection_KeepsTheOtherParameters_AndTheOverviewHasNone', () => {
    const params = new URLSearchParams('period=2026-10&tab=rule');
    expect(tabSearch(params, 'mandate')).toBe('?period=2026-10&tab=mandate');
    expect(tabSearch(params, 'overview')).toBe('?period=2026-10');
    expect(tabSearch(new URLSearchParams('tab=rule'), 'overview')).toBe('');
    expect(params.get('tab')).toBe('rule');
  });
});

describe('what the page shows of a value that identifies a person', () => {
  it('OwnerValue_InClear_IsMaskedUntilTheyAskForIt_AndWhatTheServerMaskedStaysAsItCame', () => {
    const full = profile({ masked: false });
    expect(shownValue(full, 'fiscalCode', 'RSSMRT80A01H501U', false)).toBe('••••••••••••501U');
    expect(shownValue(full, 'fiscalCode', 'RSSMRT80A01H501U', true)).toBe('RSSMRT80A01H501U');
    expect(shownValue(full, 'taxResidenceCountry', 'IT', false)).toBe('IT');
    expect(shownValue(profile({ masked: true }), 'fiscalCode', '••••3456', true)).toBe('••••3456');
    expect(shownValue(full, 'legalName', null, false)).toBeNull();
  });
});

describe('the state of each step of the path', () => {
  it('OwnerSteps_AProfileThatIsComplete_AndItsRuleApproved_AreAllDone', () => {
    const ready = readiness();
    expect(identityState(ready)).toBe('done');
    expect(paymentsState(ready)).toBe('done');
    expect(ruleState(ready)).toBe('done');
  });

  it('OwnerSteps_WithoutAProfile_EveryStepOfTheProfileIsToDo', () => {
    const none = ownerReadinessOn([], [policy()], DAY);
    expect(identityState(none)).toBe('todo');
    expect(paymentsState(none)).toBe('todo');
    expect(ruleState(none)).toBe('todo');
  });

  it('OwnerSteps_AMissingFact_IsToDoOnlyInTheStepItBelongsTo', () => {
    expect(identityState(readiness({ legalName: null }))).toBe('todo');
    expect(paymentsState(readiness({ legalName: null }))).toBe('done');
    expect(identityState(readiness({ fiscalCode: null, vatNumber: null, foreignTaxId: null }))).toBe('todo');
    expect(identityState(readiness({ fiscalCode: null, vatNumber: '01234567890' }))).toBe('done');
    expect(paymentsState(readiness({ bankAccountReference: ' ' }))).toBe('todo');
    expect(paymentsState(readiness({ settlementCurrency: null }))).toBe('todo');
    expect(ruleState(readiness({ taxJurisdiction: null }))).toBe('todo');
    expect(ruleState(readiness({ revenueRecognitionRule: null }))).toBe('todo');
    expect(identityState(readiness({ taxJurisdiction: null }))).toBe('done');
  });

  it('OwnerSteps_ARuleThatIsNotApproved_OrNotChosen_IsToDo_EvenWhenTheProfileHasGaps', () => {
    expect(ruleState(readiness({}, { approved: false, approvedAt: null, approvedByName: null }))).toBe('todo');
    expect(ruleState(readiness({ accountingPolicyId: null }))).toBe('todo');
    expect(ruleState(readiness({ legalName: null }, { approved: false, approvedAt: null, approvedByName: null }))).toBe('todo');
    expect(ruleState(readiness({ legalName: null }))).toBe('done');
    expect(ruleState(readiness({ taxJurisdiction: 'CH' }))).toBe('todo');
  });

  it('OwnerSteps_TheMandate_IsDoneOnlyWhileAVersionIsInForce_AndUnknownWhileItIsNotRead', () => {
    expect(mandateState(undefined, DAY)).toBe('unknown');
    expect(mandateState([], DAY)).toBe('todo');
    expect(mandateState([mandate()], DAY)).toBe('done');
    expect(mandateState([mandate({ validFrom: '2027-01-01' })], DAY)).toBe('todo');
    expect(mandateState([mandate({ validTo: '2026-06-30' })], DAY)).toBe('todo');
  });

  it('OwnerSteps_TheIssuerProfile_IsDoneWhenItCanIssue_AndHasNoStateWhenItIsNotForThePersonOrNotItalian', () => {
    expect(documentsState(issuer())).toBe('done');
    expect(documentsState(issuer({ canIssue: false }))).toBe('todo');
    expect(documentsState(issuer({ exists: false, canIssue: false }))).toBe('todo');
    expect(documentsState(issuer({ countryCode: 'CH' }))).toBe('unknown');
    expect(documentsState(null)).toBe('unknown');
    expect(documentsState(undefined)).toBe('unknown');
  });

  it('OwnerSteps_TheProgress_CountsOnlyTheStepsThatHaveAState', () => {
    expect(completedSteps(['done', 'todo', 'unknown', 'done'])).toEqual({ done: 2, total: 3 });
    expect(completedSteps(['unknown'])).toEqual({ done: 0, total: 0 });
    expect(completedSteps([])).toEqual({ done: 0, total: 0 });
  });
});
