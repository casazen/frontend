import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { ACCOUNTANT_PACKAGE_FOLDERS, type AccountantPackageSettings } from '@/types';
import { BILLING_STEPS } from '../billing-wizard-ids';
import {
  accountantChange,
  accountantProblemsOf,
  draftLeftOut,
  initialValues,
  isAccountantRefused,
  lastMonthOf,
  lastSendErrorKey,
  periodLabel,
  stepIdsFor,
} from '../billing-wizard-model';
import { accountantAnswersOf, accountantProblems, accountantStepSchema, isPlainEmail, type BillingWizardValues } from '../billing-wizard-schema';
import { swissSetup } from './billing-fixtures';

const TODAY = '2026-11-15';
const NOBODY = { vatNumber: false, fiscalCode: false };

/** An organization that sends every month, on the 5th, two folders, to an address. */
const SAVED: AccountantPackageSettings = {
  enabled: true,
  email: 'studio@esempio.it',
  sendDay: 5,
  contents: ['guestDocuments', 'collections'],
  lastSend: null,
  updatedAt: '2026-11-14T10:00:00Z',
};

/** What the server answers for an organization that saved nothing: no address, the send off, the day 3 and every folder. */
const NONE: AccountantPackageSettings = { enabled: false, email: null, sendDay: 3, contents: [...ACCOUNTANT_PACKAGE_FOLDERS], lastSend: null, updatedAt: null };

function values(overrides: Partial<BillingWizardValues> = {}): BillingWizardValues {
  return { ...initialValues(swissSetup(), { organizationName: 'Casa Lugano SA', today: TODAY }), ...overrides };
}

function problem(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('failed', 'ERR_BAD_REQUEST', config, undefined, { status, statusText: '', headers: {}, config, data });
}

describe('the step «Commercialista» exists only while the package of the accountant is on (E15/F02/US02/T01)', () => {
  const WITHOUT = [BILLING_STEPS.issuer, BILLING_STEPS.vat, BILLING_STEPS.numbering, BILLING_STEPS.touristTax, BILLING_STEPS.issuing, BILLING_STEPS.summary];

  it('StepIdsFor_WithTheFlagOff_IsTheWizardItWasAndNeverHasTheStep', () => {
    expect(stepIdsFor('CH', false)).toEqual(WITHOUT);
    expect(stepIdsFor('CH', false, false)).toEqual(WITHOUT);
    expect(stepIdsFor('IT', true, false)).not.toContain(BILLING_STEPS.accountant);
  });

  it('StepIdsFor_WithTheFlagOn_PutsTheOptionalStepAfterTheOthersAndBeforeTheSummary', () => {
    expect(stepIdsFor('CH', false, true)).toEqual([BILLING_STEPS.issuer, BILLING_STEPS.vat, BILLING_STEPS.numbering, BILLING_STEPS.touristTax, BILLING_STEPS.issuing, BILLING_STEPS.accountant, BILLING_STEPS.summary]);
    expect(stepIdsFor('IT', true, true)).toEqual([
      BILLING_STEPS.issuer,
      BILLING_STEPS.vat,
      BILLING_STEPS.numbering,
      BILLING_STEPS.touristTax,
      BILLING_STEPS.channels,
      BILLING_STEPS.mandate,
      BILLING_STEPS.issuing,
      BILLING_STEPS.italy,
      BILLING_STEPS.accountant,
      BILLING_STEPS.summary,
    ]);
  });

  it('InitialValues_NothingOfTheSendIsAnAnswerYet_EveryOneIsNotTouched', () => {
    expect(values()).toMatchObject({ accountantEmail: null, accountantMonthly: null, accountantDay: null, accountantContents: null });
  });
});

describe('what a save of the step sends (accountantChange)', () => {
  it('AccountantChange_NothingTouchedOrNothingReadable_SavesNothing', () => {
    expect(accountantChange(SAVED, values(), 'whole')).toEqual({ request: null, leftOut: [] });
    expect(accountantChange(SAVED, values(), 'draft')).toEqual({ request: null, leftOut: [] });
    // The settings could not be read (403, an error, still on their way): nothing can be saved, whatever the form holds.
    expect(accountantChange(null, values({ accountantEmail: 'altro@esempio.it' }), 'whole')).toEqual({ request: null, leftOut: [] });
    expect(accountantChange(undefined, values({ accountantEmail: 'altro@esempio.it' }), 'draft')).toEqual({ request: null, leftOut: [] });
  });

  it('AccountantChange_AnAddressAndTheMonthlySend_SendTheWholeSettingsWithTheAddressCutAtItsEnds', () => {
    const change = accountantChange(NONE, values({ accountantEmail: '  studio@esempio.it ', accountantMonthly: true }), 'whole');
    expect(change.leftOut).toEqual([]);
    // All the settings go together (the server refuses a body with a field missing): the day and the folders are the server's own.
    expect(change.request).toEqual({ enabled: true, email: 'studio@esempio.it', sendDay: 3, contents: [...ACCOUNTANT_PACKAGE_FOLDERS] });
    // A copy: nothing the request holds is the list of the settings the server answered.
    expect(change.request?.contents).not.toBe(NONE.contents);
  });

  it('AccountantChange_WhatIsOnScreenIsWhatTheServerHas_SendsNothingEvenWithAnotherCapitalOrOrder', () => {
    expect(accountantChange(SAVED, values({ accountantEmail: 'Studio@Esempio.IT', accountantMonthly: true, accountantDay: 5, accountantContents: ['collections', 'guestDocuments'] }), 'whole')).toEqual({
      request: null,
      leftOut: [],
    });
  });

  it('AccountantChange_TheMonthlySendTurnedOff_KeepsTheAddressTheDayAndTheFolders', () => {
    expect(accountantChange(SAVED, values({ accountantMonthly: false }), 'whole').request).toEqual({ enabled: false, email: 'studio@esempio.it', sendDay: 5, contents: ['guestDocuments', 'collections'] });
  });

  it('AccountantChange_TheAddressEmptiedWithTheSendOff_ClearsTheAddress', () => {
    expect(accountantChange(SAVED, values({ accountantEmail: '', accountantMonthly: false }), 'whole').request).toEqual({
      enabled: false,
      email: null,
      sendDay: 5,
      contents: ['guestDocuments', 'collections'],
    });
  });

  it('AccountantChange_AWholeSaveThatDoesNotHoldTogether_IsRefusedAndSaysWhichSettingsAreWrong', () => {
    // The send on with no address to send it to.
    expect(accountantChange(NONE, values({ accountantMonthly: true }), 'whole')).toEqual({ request: null, leftOut: ['accountantEmail'] });
    // An address that is not a plain one, a day that not every month has, no folder at all.
    expect(accountantChange(SAVED, values({ accountantEmail: 'Mario <mario@esempio.it>', accountantDay: 29, accountantContents: [] }), 'whole')).toEqual({
      request: null,
      leftOut: ['accountantEmail', 'accountantDay', 'accountantContents'],
    });
  });

  it('AccountantChange_ADraft_KeepsWhatHoldsTogetherAndLeavesTheRestOut', () => {
    // The address is not a plain one: it is left out, the day is kept.
    expect(accountantChange(SAVED, values({ accountantEmail: 'non-un-indirizzo', accountantDay: 10 }), 'draft')).toEqual({
      request: { enabled: true, email: 'studio@esempio.it', sendDay: 10, contents: ['guestDocuments', 'collections'] },
      leftOut: ['accountantEmail'],
    });
    // The same draft, whole, is refused as a whole.
    expect(accountantChange(SAVED, values({ accountantEmail: 'non-un-indirizzo', accountantDay: 10 }), 'whole').request).toBeNull();
  });

  it('AccountantChange_ADraftOfTheSendOnWithNoAddress_NeverTurnsItOn', () => {
    expect(accountantChange(NONE, values({ accountantMonthly: true }), 'draft')).toEqual({ request: null, leftOut: ['accountantMonthly'] });
    // Not even next to an address that is not a plain one.
    expect(accountantChange(NONE, values({ accountantMonthly: true, accountantEmail: 'studio' }), 'draft')).toEqual({ request: null, leftOut: ['accountantEmail', 'accountantMonthly'] });
    // With an address that is valid the two go together.
    expect(accountantChange(NONE, values({ accountantMonthly: true, accountantEmail: 'studio@esempio.it' }), 'draft').request).toMatchObject({ enabled: true, email: 'studio@esempio.it' });
  });

  it('AccountantChange_ADraftThatEmptiesTheAddressWhileTheSendStaysOn_LeavesTheEmptyingOut', () => {
    expect(accountantChange(SAVED, values({ accountantEmail: '' }), 'draft')).toEqual({ request: null, leftOut: ['accountantEmail'] });
    // With the send turned off in the same draft the address may go.
    expect(accountantChange(SAVED, values({ accountantEmail: '', accountantMonthly: false }), 'draft')).toEqual({
      request: { enabled: false, email: null, sendDay: 5, contents: ['guestDocuments', 'collections'] },
      leftOut: [],
    });
  });

  it('AccountantChange_ADraftWithNoFolder_KeepsTheFoldersTheServerHas', () => {
    expect(accountantChange(SAVED, values({ accountantContents: [], accountantDay: 6 }), 'draft')).toEqual({
      request: { enabled: true, email: 'studio@esempio.it', sendDay: 6, contents: ['guestDocuments', 'collections'] },
      leftOut: ['accountantContents'],
    });
  });

  it('DraftLeftOut_TheStepOfTheAccountant_IsWhatTheDraftDoesNotKeepAndNothingWhenTheSettingsCannotBeRead', () => {
    const start = values();
    const typed = values({ accountantEmail: 'non-un-indirizzo' });
    expect(draftLeftOut(BILLING_STEPS.accountant, typed, { initial: start, onRecord: NOBODY, accountant: SAVED })).toEqual(['accountantEmail']);
    expect(draftLeftOut(BILLING_STEPS.accountant, values({ accountantDay: 9 }), { initial: start, onRecord: NOBODY, accountant: SAVED })).toEqual([]);
    expect(draftLeftOut(BILLING_STEPS.accountant, typed, { initial: start, onRecord: NOBODY, accountant: null })).toEqual([]);
    expect(draftLeftOut(BILLING_STEPS.accountant, typed, { initial: start, onRecord: NOBODY })).toEqual([]);
  });
});

describe('what the step holds together (accountantProblems, the schema)', () => {
  it.each<[string, boolean]>([
    ['studio@esempio.it', true],
    ['  Studio.Rossi@Esempio.it ', true],
    ['studio+fatture@sub.esempio.it', true],
    ['', false],
    ['studio', false],
    ['studio@esempio', false],
    ['studio@esempio.', false],
    ['studio@.it', false],
    ['@esempio.it', false],
    ['stu dio@esempio.it', false],
    ['studio@@esempio.it', false],
    ['Mario Rossi <studio@esempio.it>', false],
    ['studio@esempio.it, altro@esempio.it', false],
    [`${'a'.repeat(250)}@esempio.it`, false],
  ])('IsPlainEmail_%s_Is%s', (text, expected) => {
    expect(isPlainEmail(text)).toBe(expected);
  });

  it('AccountantProblems_EachSettingThatTheServerWouldRefuse_IsToldOnItsOwnFieldWithItsOwnWords', () => {
    const good = { email: 'studio@esempio.it', enabled: true, sendDay: 28, contents: ['vat'] };
    expect(accountantProblems(good)).toEqual([]);
    expect(accountantProblems({ ...good, email: 'studio' })).toEqual([{ field: 'accountantEmail', messageKey: 'billingWizard.errors.accountantEmail' }]);
    // A blank address is no address: the monthly send has nowhere to go (and an address that is blank is not «not a plain address»).
    expect(accountantProblems({ ...good, email: '   ' })).toEqual([{ field: 'accountantEmail', messageKey: 'billingWizard.errors.accountantEmailMissing' }]);
    expect(accountantProblems({ ...good, email: '', enabled: false })).toEqual([]);
    expect(accountantProblems({ ...good, sendDay: 0 })).toEqual([{ field: 'accountantDay', messageKey: 'billingWizard.errors.accountantDay' }]);
    expect(accountantProblems({ ...good, sendDay: 29 })).toEqual([{ field: 'accountantDay', messageKey: 'billingWizard.errors.accountantDay' }]);
    expect(accountantProblems({ ...good, sendDay: 3.5 })).toEqual([{ field: 'accountantDay', messageKey: 'billingWizard.errors.accountantDay' }]);
    expect(accountantProblems({ ...good, contents: [] })).toEqual([{ field: 'accountantContents', messageKey: 'billingWizard.errors.accountantContents' }]);
  });

  it('AccountantAnswersOf_AFieldTheAnswerChangedShowsTheAnswer_AnyOtherTheServers', () => {
    expect(accountantAnswersOf(SAVED, values())).toEqual({ email: 'studio@esempio.it', enabled: true, sendDay: 5, contents: ['guestDocuments', 'collections'] });
    expect(accountantAnswersOf(SAVED, values({ accountantEmail: '', accountantMonthly: false, accountantDay: 9, accountantContents: ['vat'] }))).toEqual({
      email: '',
      enabled: false,
      sendDay: 9,
      contents: ['vat'],
    });
    // The settings of an organization that has none: no address.
    expect(accountantAnswersOf(NONE, values()).email).toBe('');
  });

  it('AccountantStepSchema_AStepNothingWasTouchedInOrWhoseSettingsCannotBeRead_HasNothingToCheck', () => {
    expect(accountantStepSchema(SAVED).safeParse(values()).success).toBe(true);
    expect(accountantStepSchema(NONE).safeParse(values()).success).toBe(true);
    expect(accountantStepSchema(null).safeParse(values({ accountantMonthly: true })).success).toBe(true);
    expect(accountantStepSchema(undefined).safeParse(values({ accountantMonthly: true })).success).toBe(true);
  });

  it('AccountantStepSchema_TheSendTurnedOnWithNoAddress_IsAProblemOfTheAddressUntilThereIsOne', () => {
    const turnedOn = accountantStepSchema(NONE).safeParse(values({ accountantMonthly: true }));
    expect(turnedOn.success).toBe(false);
    if (!turnedOn.success) expect(turnedOn.error.issues.map((issue) => [issue.path.join('.'), issue.message])).toEqual([['accountantEmail', 'billingWizard.errors.accountantEmailMissing']]);
    expect(accountantStepSchema(NONE).safeParse(values({ accountantMonthly: true, accountantEmail: 'studio@esempio.it' })).success).toBe(true);
    // The server already has an address: turning the send on is enough.
    expect(accountantStepSchema({ ...SAVED, enabled: false }).safeParse(values({ accountantMonthly: true })).success).toBe(true);
  });
});

describe('what the server refuses in the settings of the send', () => {
  it.each([
    ['accountant_package_recipient_invalid', 'accountantEmail', 'billingWizard.errors.accountantEmail'],
    ['accountant_package_recipient_missing', 'accountantEmail', 'billingWizard.errors.accountantEmailMissing'],
    ['accountant_package_send_day_invalid', 'accountantDay', 'billingWizard.errors.accountantDay'],
    ['accountant_package_contents_invalid', 'accountantContents', 'billingWizard.errors.accountantContents'],
    ['accountant_package_owner_accounting_required', 'accountantContents', 'billingWizard.errors.accountantOwnerAccounting'],
  ])('AccountantProblemsOf_%s_IsTheProblemOfTheField_%s', (code, name, messageKey) => {
    expect(accountantProblemsOf(problem(422, { code }))).toEqual([{ name, messageKey }]);
  });

  it('AccountantProblemsOf_AnythingElse_NamesNoField', () => {
    // A code that names no field (the whole save is refused), a status that is not 422, a body that has no code, a code that is a property of every object, and what is no error of axios.
    expect(accountantProblemsOf(problem(422, { code: 'accountant_package_settings_invalid' }))).toEqual([]);
    expect(accountantProblemsOf(problem(400, { code: 'accountant_package_recipient_invalid' }))).toEqual([]);
    expect(accountantProblemsOf(problem(422, {}))).toEqual([]);
    expect(accountantProblemsOf(problem(422, { code: 'constructor' }))).toEqual([]);
    expect(accountantProblemsOf(new Error('boom'))).toEqual([]);
    expect(accountantProblemsOf(null)).toEqual([]);
  });

  it('IsAccountantRefused_OnlyA403_IsTheRefusalOfTheRoleOrOfTheReach', () => {
    expect(isAccountantRefused(problem(403, { code: 'forbidden' }))).toBe(true);
    expect(isAccountantRefused(problem(422, { code: 'accountant_package_recipient_invalid' }))).toBe(false);
    expect(isAccountantRefused(new Error('boom'))).toBe(false);
  });
});

describe('the words of the dates and of the last send', () => {
  it('LastMonthOf_IsTheMonthBeforeToday_AlsoAcrossTheYear', () => {
    expect(lastMonthOf('2026-11-15')).toBe('2026-10');
    expect(lastMonthOf('2026-03-01')).toBe('2026-02');
    expect(lastMonthOf('2026-01-03')).toBe('2025-12');
  });

  it('PeriodLabel_AMonthIsWrittenInTheLanguageOfTheApp_AnythingElseAsItCame', () => {
    expect(periodLabel('2026-10', 'it-IT')).toBe('ottobre 2026');
    expect(periodLabel('2026-10', 'en-GB')).toBe('October 2026');
    expect(periodLabel('2026-13', 'it-IT')).toBe('2026-13');
    expect(periodLabel('not a month', 'it-IT')).toBe('not a month');
  });

  it('LastSendErrorKey_EveryCodeTheServerRecords_HasItsOwnWordsAndAnUnknownOneANeutralLine', () => {
    for (const code of ['package_too_large', 'package_failed', 'storage_failed', 'link_not_configured', 'email_not_configured', 'email_not_queued']) {
      expect(lastSendErrorKey(code), code).not.toBe('billingWizard.accountant.lastSend.errors.unknown');
      expect(lastSendErrorKey(code), code).toMatch(/^billingWizard\.accountant\.lastSend\.errors\./);
    }
    for (const code of ['a_code_of_the_future', '', null, undefined, 'constructor', '__proto__']) expect(lastSendErrorKey(code), String(code)).toBe('billingWizard.accountant.lastSend.errors.unknown');
  });
});
