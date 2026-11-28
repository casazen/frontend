import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import type { ChannelAccountHolder, ChannelCommissionRuleSet } from '@/types';
import { BILLING_STEPS } from '../billing-wizard-ids';
import {
  commissionRulesRequest,
  commissionStartTooEarly,
  draftLeftOut,
  firstMissingStep,
  holderChangesRequest,
  initialValues,
  isNeedsWholeOrg,
  mandateTemplateOf,
  portalSettingsChanged,
  problemsOf,
  stepIdsFor,
  stepSave,
  taxProfileAddition,
} from '../billing-wizard-model';
import { numberingStepSchema, seriesOf, type BillingWizardValues } from '../billing-wizard-schema';
import { emptySetup, italianSetup, swissSetup } from './billing-fixtures';

const TODAY = '2026-11-14';
const NOBODY = { vatNumber: false, fiscalCode: false };

function values(overrides: Partial<BillingWizardValues> = {}): BillingWizardValues {
  return { ...initialValues(swissSetup(), { organizationName: 'Casa Lugano SA', today: TODAY }), ...overrides };
}

function problem(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('failed', 'ERR_BAD_REQUEST', config, undefined, { status, statusText: '', headers: {}, config, data });
}

describe('what the wizard starts from', () => {
  it('InitialValues_IssuerThatHasNotSaidItsCountry_StartsWithNoCountryEvenThoughTheServerAnswersItsDefault', () => {
    expect(initialValues(emptySetup(), { organizationName: 'Casa Mia Srl', today: TODAY })).toMatchObject({ countryCode: '', legalName: 'Casa Mia Srl', regime: '', swissVatRegistered: '' });
    expect(initialValues(swissSetup(), { organizationName: 'Altro', today: TODAY })).toMatchObject({
      countryCode: 'CH',
      legalName: 'Casa Lugano SA',
      swissVatRegistered: 'yes',
      swissVatNumber: 'CHE-123.456.789',
      guestDocumentSeries: '{year}',
      ownerInvoiceSeries: 'PM{year}',
    });
  });

  it('InitialValues_TouristTaxNeverConfirmed_LeavesEveryPortalUnansweredSoNobodyConfirmsADefaultByNotChoosing', () => {
    const start = initialValues(swissSetup(), { organizationName: 'x', today: TODAY });
    expect(Object.values(start.touristTaxCollectors)).toHaveLength(7);
    expect(Object.values(start.touristTaxCollectors).every((collector) => collector === '')).toBe(true);
  });

  it('StepIdsFor_FollowTheCountryAndThePlan', () => {
    expect(stepIdsFor('CH', false)).toEqual([BILLING_STEPS.issuer, BILLING_STEPS.vat, BILLING_STEPS.numbering, BILLING_STEPS.touristTax, BILLING_STEPS.issuing, BILLING_STEPS.summary]);
    expect(stepIdsFor('IT', true)).toEqual([
      BILLING_STEPS.issuer,
      BILLING_STEPS.vat,
      BILLING_STEPS.numbering,
      BILLING_STEPS.touristTax,
      BILLING_STEPS.channels,
      BILLING_STEPS.mandate,
      BILLING_STEPS.issuing,
      BILLING_STEPS.italy,
      BILLING_STEPS.summary,
    ]);
    expect(stepIdsFor('', false)).not.toContain(BILLING_STEPS.italy);
  });

  it('FirstMissingStep_IsTheFirstStepOfThePersonThatHasAnItemMissing', () => {
    expect(firstMissingStep(emptySetup(), stepIdsFor('', false))).toBe(BILLING_STEPS.issuer);
    expect(firstMissingStep(swissSetup(), stepIdsFor('CH', false))).toBe(BILLING_STEPS.touristTax);
    expect(firstMissingStep(italianSetup(), stepIdsFor('IT', false))).toBeNull();
  });
});

describe('what a step saves on the server', () => {
  it('StepSave_ACheckedStepSendsEveryFieldItAsksAndOnlyThose', () => {
    expect(stepSave(BILLING_STEPS.issuer, values({ postalCode: ' 69 00 ', province: 'ti' }))).toEqual({
      section: 'issuer',
      request: { countryCode: 'CH', legalName: 'Casa Lugano SA', addressStreet: 'Via Nassa', addressCivic: '12', postalCode: '6900', city: 'Lugano', province: 'TI' },
    });
    expect(stepSave(BILLING_STEPS.vat, values())).toEqual({
      section: 'vat',
      request: { regime: 'SwissVatRegistered', vatRegistered: true, swissVatNumber: 'CHE-123.456.789', cleaningFeeTreatment: 'FollowsStay' },
    });
    expect(stepSave(BILLING_STEPS.vat, values({ swissVatRegistered: 'no' }))?.request).toEqual({ regime: 'SwissNotRegistered', vatRegistered: false, cleaningFeeTreatment: 'FollowsStay' });
    expect(stepSave(BILLING_STEPS.numbering, values())).toEqual({ section: 'numbering', request: { guestDocumentSeries: '{year}', ownerInvoiceSeries: 'PM{year}' } });
    expect(stepSave(BILLING_STEPS.issuing, values({ autoIssueGuestDocuments: true }))).toEqual({
      section: 'automation',
      request: { autoIssueGuestDocuments: true, emailGuestDocuments: false },
    });
    for (const step of [BILLING_STEPS.channels, BILLING_STEPS.mandate, BILLING_STEPS.summary]) expect(stepSave(step, values())).toBeNull();
  });

  it('StepSave_ADraftSendsWhatIsValidAndNotEmptyAndNothingThePersonDidNotAnswer', () => {
    const half = values({ legalName: '', addressStreet: 'Via Nassa', postalCode: '69', city: '' });
    const draft = stepSave(BILLING_STEPS.issuer, half, { draft: true });
    expect(draft?.request).toEqual({ countryCode: 'CH', addressStreet: 'Via Nassa', addressCivic: '12', province: 'TI' });

    expect(numberingStepSchema.safeParse(values({ guestDocumentSeries: 'AAAAAAAAAAAA' })).success).toBe(false);
    expect(stepSave(BILLING_STEPS.numbering, values({ guestDocumentSeries: 'AAAAAAAAAAAA' }), { draft: true })?.request).toEqual({ ownerInvoiceSeries: 'PM{year}' });
  });

  // Data rule: «Salva ed esci» keeps what the person changed. A proposal that is left as it was (the name of the organization as the legal name, the series of the server, a
  // «no» that nobody answered) is not an answer, and saving a draft must not make the part «Fatturazione» of the guide count it as done.
  it('StepSave_ADraftOfAStepThePersonLeftAsItStartedSendsNothing', () => {
    const start = initialValues(emptySetup(), { organizationName: 'Casa Mia Srl', today: TODAY });
    const draft = (step: Parameters<typeof stepSave>[0]) => stepSave(step, start, { draft: true, onRecord: NOBODY, initial: start });

    expect(draft(BILLING_STEPS.issuer)?.request).toEqual({});
    expect(draft(BILLING_STEPS.vat)?.request).toEqual({});
    expect(draft(BILLING_STEPS.numbering)?.request).toEqual({});
    expect(draft(BILLING_STEPS.issuing)?.request).toEqual({});
    expect(draft(BILLING_STEPS.italy)?.request).toEqual({});
    expect(stepSave(BILLING_STEPS.issuing, start)?.request).toEqual({ autoIssueGuestDocuments: false, emailGuestDocuments: false });
    expect(stepSave(BILLING_STEPS.numbering, start)?.request).toEqual({ guestDocumentSeries: start.guestDocumentSeries, ownerInvoiceSeries: start.ownerInvoiceSeries });
  });

  it('StepSave_ADraftSendsOnlyTheFieldsThePersonChanged', () => {
    const start = initialValues(emptySetup(), { organizationName: 'Casa Mia Srl', today: TODAY });
    const draft = (step: Parameters<typeof stepSave>[0], changes: Partial<BillingWizardValues>) => stepSave(step, { ...start, ...changes }, { draft: true, onRecord: NOBODY, initial: start })?.request;

    expect(draft(BILLING_STEPS.issuer, { countryCode: 'CH', addressStreet: ' Via Nassa ' })).toEqual({ countryCode: 'CH', addressStreet: 'Via Nassa' });
    expect(draft(BILLING_STEPS.issuer, { legalName: 'Casa Mia SA' })).toEqual({ legalName: 'Casa Mia SA' });
    expect(draft(BILLING_STEPS.issuing, { emailGuestDocuments: true })).toEqual({ emailGuestDocuments: true });
    expect(draft(BILLING_STEPS.italy, { virtualStampConfirmed: true, stampDutyReference: ' AUT-77 ' })).toEqual({ virtualStampConfirmed: true, stampDutyReference: 'AUT-77' });
    expect(draft(BILLING_STEPS.numbering, { ownerInvoiceSeries: 'FATT{year}' })).toEqual({ ownerInvoiceSeries: 'FATT{year}' });
  });

  // Data rule: «Salva ed esci» tells what it kept. What the person wrote and a draft does not keep (not valid, or the terms of the mandate that no step saves) is named, so that the
  // page does not say «Salvato» for all of it; what was left as it started, or emptied, is not something that was written.
  it('DraftLeftOut_NamesWhatWasWrittenAndIsNotKeptAndNothingElse', () => {
    const start = initialValues(swissSetup(), { organizationName: 'Casa Lugano SA', today: TODAY });
    const left = (step: Parameters<typeof draftLeftOut>[0], changes: Partial<BillingWizardValues>) => draftLeftOut(step, { ...start, ...changes }, { initial: start, onRecord: NOBODY });

    expect(left(BILLING_STEPS.issuer, {})).toEqual([]);
    expect(left(BILLING_STEPS.issuer, { legalName: 'Nuovo SA' })).toEqual([]);
    expect(left(BILLING_STEPS.issuer, { legalName: 'Nuovo SA', postalCode: '69' })).toEqual(['postalCode']);
    expect(left(BILLING_STEPS.issuer, { postalCode: '' })).toEqual([]);
    expect(left(BILLING_STEPS.numbering, { guestDocumentSeries: 'AAAAAAAAAAAA' })).toEqual(['guestDocumentSeries']);
    expect(left(BILLING_STEPS.issuing, { autoIssueGuestDocuments: true })).toEqual([]);
    expect(left(BILLING_STEPS.channels, { commissionPercents: { Airbnb: '16' } })).toEqual([]);
    expect(left(BILLING_STEPS.channels, { commissionPercents: { Airbnb: 'abc', Vrbo: '' } })).toEqual(['commissionPercents.Airbnb']);
    expect(left(BILLING_STEPS.mandate, {})).toEqual([]);
    expect(left(BILLING_STEPS.mandate, { mandateCommissionPercent: '20', mandatePassthroughPaymentFees: true })).toEqual(['mandateCommissionPercent', 'mandatePassthroughPaymentFees']);
  });

  it('StepSave_TouristTaxIsAListOnceEveryPortalIsAnsweredAndAnEmptyListIsAnAnswer', () => {
    const all = Object.fromEntries(['Airbnb', 'BookingCom', 'Expedia', 'Vrbo', 'TripAdvisor', 'Agoda', 'OtherChannel'].map((portal) => [portal, 'host' as const]));
    expect(stepSave(BILLING_STEPS.touristTax, values({ touristTaxCollectors: all }))?.request).toEqual({ platformCollectedTouristTaxChannels: [] });
    expect(stepSave(BILLING_STEPS.touristTax, values({ touristTaxCollectors: { ...all, Airbnb: 'portal' } }))?.request).toEqual({ platformCollectedTouristTaxChannels: ['Airbnb'] });
    expect(stepSave(BILLING_STEPS.touristTax, values({ touristTaxCollectors: { ...all, Vrbo: '' } }), { draft: true })).toBeNull();
    expect(stepSave(BILLING_STEPS.touristTax, values({ countryCode: 'IT', touristTaxCollectors: all }))).toBeNull();
  });

  it('TaxProfileAddition_OnlyWhatTheProfileDoesNotHaveYetAndThePersonWrote', () => {
    const ordinary = values({ countryCode: 'IT', regime: 'VatOrdinary', vatNumber: ' 12345678901 ' });
    expect(taxProfileAddition(ordinary, NOBODY)).toEqual({ hasPartitaIva: true, partitaIvaNumber: '12345678901' });
    expect(taxProfileAddition(ordinary, { vatNumber: true, fiscalCode: false })).toBeNull();
    expect(taxProfileAddition({ ...ordinary, countryCode: 'CH' }, NOBODY)).toBeNull();
    expect(taxProfileAddition(values({ countryCode: 'IT', regime: 'PrivatePerson', fiscalCode: 'rssmra80a01f205x' }), NOBODY)).toEqual({ fiscalCode: 'RSSMRA80A01F205X' });
    expect(taxProfileAddition(values({ countryCode: 'IT', regime: 'VatOrdinary', vatNumber: '123' }), NOBODY, { draft: true })).toBeNull();
  });

  it('SeriesOf_TheYearReplacesThePlaceholderAsTheServerDoesIt', () => {
    expect(seriesOf('{year}', 2026)).toBe('2026');
    expect(seriesOf(' PM{year} ', 2026)).toBe('PM2026');
    expect(seriesOf('A', 2026)).toBe('A');
  });
});

describe('the step «Commissioni dei canali»', () => {
  const set: ChannelCommissionRuleSet = {
    rules: [{ id: 'r-booking', channel: 'BookingCom', percent: 15, base: 'GrossExclTouristTax', validFrom: '2026-01-01', validTo: null, createdAt: '2026-01-01T00:00:00Z' }],
    channels: [
      { channel: 'Airbnb', percent: 15.5, base: 'GrossExclTouristTax', isDefault: true },
      { channel: 'BookingCom', percent: 15, base: 'GrossExclTouristTax', isDefault: false, ruleId: 'r-booking', validFrom: '2026-01-01', validTo: null },
      { channel: 'Vrbo', percent: null, isDefault: false },
    ],
  };

  it('CommissionRules_AcceptingTheDefaultsSavesThemAsTheRulesOfTheAgencyFromToday', () => {
    expect(commissionRulesRequest(set, {}, TODAY)).toEqual([
      { channel: 'BookingCom', percent: 15, base: 'GrossExclTouristTax', validFrom: '2026-01-01', validTo: null },
      { channel: 'Airbnb', percent: 15.5, base: 'GrossExclTouristTax', validFrom: TODAY },
    ]);
  });

  it('CommissionRules_ADraftSavesOnlyThePercentsThePersonTypedNeverTheDefaultsThatAreOnlyShown', () => {
    expect(commissionRulesRequest(set, {}, TODAY, { draft: true })).toBeNull();
    expect(commissionRulesRequest(set, { Airbnb: '16' }, TODAY, { draft: true })).toEqual([
      { channel: 'BookingCom', percent: 15, base: 'GrossExclTouristTax', validFrom: '2026-01-01', validTo: null },
      { channel: 'Airbnb', percent: 16, base: 'GrossExclTouristTax', validFrom: TODAY },
    ]);
  });

  it('PortalSettings_AreChangedOnlyWhenThePersonAnsweredSoADraftDoesNotAnswerForThem', () => {
    const start = values();
    expect(portalSettingsChanged(start, start)).toBe(false);
    expect(portalSettingsChanged({ ...start, portalAccountHolder: 'Agency' }, start)).toBe(true);
    expect(portalSettingsChanged({ ...start, rechargePortalCommissions: !start.rechargePortalCommissions }, start)).toBe(true);
  });

  it('CommissionRules_APercentThatIsAlreadyTheRuleInForceChangesNothing', () => {
    const done: ChannelCommissionRuleSet = { ...set, channels: set.channels.filter((row) => row.channel === 'BookingCom') };
    expect(commissionRulesRequest(done, {}, TODAY)).toBeNull();
    expect(commissionRulesRequest(done, { BookingCom: '15,00' }, TODAY)).toBeNull();
  });

  it('CommissionRules_ANewPercentClosesTheRuleInForceTheDayBeforeAndOpensAnotherFromToday', () => {
    const changed = commissionRulesRequest(set, { BookingCom: '16,5', Airbnb: '', Vrbo: '8' }, TODAY);
    expect(changed).toEqual([
      { channel: 'BookingCom', percent: 15, base: 'GrossExclTouristTax', validFrom: '2026-01-01', validTo: '2026-11-13' },
      { channel: 'BookingCom', percent: 16.5, base: 'GrossExclTouristTax', validFrom: TODAY },
      { channel: 'Vrbo', percent: 8, validFrom: TODAY },
    ]);
    const today: ChannelCommissionRuleSet = { rules: [{ ...set.rules[0], validFrom: TODAY }], channels: [{ ...set.channels[1], validFrom: TODAY }] };
    expect(commissionRulesRequest(today, { BookingCom: '12' }, TODAY)).toEqual([{ channel: 'BookingCom', percent: 12, base: 'GrossExclTouristTax', validFrom: TODAY, validTo: null }]);
  });

  it('CommissionRules_TheWizardStartsThemToday_AndThePageOfTheChannelCommissionsFromTheDayChosen', () => {
    expect(commissionRulesRequest(set, { BookingCom: '16', Vrbo: '8' }, TODAY, { draft: true, validFrom: '2026-11-01' })).toEqual([
      { channel: 'BookingCom', percent: 15, base: 'GrossExclTouristTax', validFrom: '2026-01-01', validTo: '2026-10-31' },
      { channel: 'BookingCom', percent: 16, base: 'GrossExclTouristTax', validFrom: '2026-11-01' },
      { channel: 'Vrbo', percent: 8, validFrom: '2026-11-01' },
    ]);
    expect(commissionRulesRequest(set, { BookingCom: '16', Vrbo: '8' }, TODAY, { draft: true })).toEqual([
      { channel: 'BookingCom', percent: 15, base: 'GrossExclTouristTax', validFrom: '2026-01-01', validTo: '2026-11-13' },
      { channel: 'BookingCom', percent: 16, base: 'GrossExclTouristTax', validFrom: TODAY },
      { channel: 'Vrbo', percent: 8, validFrom: TODAY },
    ]);
  });

  it('CommissionStart_ARuleInForceThatStartsAfterTheDay_IsTooEarlyOnlyForAPercentThatChangesIt', () => {
    const late: ChannelCommissionRuleSet = {
      rules: [{ ...set.rules[0], validFrom: '2026-11-05' }],
      channels: [set.channels[0], { ...set.channels[1], validFrom: '2026-11-05' }, set.channels[2]],
    };
    expect(commissionStartTooEarly(late, { BookingCom: '16' }, '2026-11-01')).toBe('2026-11-05');
    expect(commissionStartTooEarly(late, { BookingCom: '16' }, '2026-11-05')).toBeNull();
    expect(commissionStartTooEarly(late, { BookingCom: '16' }, '2026-11-20')).toBeNull();
    expect(commissionStartTooEarly(late, { BookingCom: '15' }, '2026-11-01')).toBeNull();
    expect(commissionStartTooEarly(late, { Vrbo: '8' }, '2026-11-01')).toBeNull();
    expect(commissionStartTooEarly(late, {}, '2026-11-01')).toBeNull();
  });

  it('CommissionRules_ATextThatIsNotAPercentIsLeftOutNeverSentAsZero', () => {
    expect(commissionRulesRequest({ rules: [], channels: [{ channel: 'Vrbo', percent: null, isDefault: false }] }, { Vrbo: 'abc' }, TODAY)).toBeNull();
    expect(commissionRulesRequest({ rules: [], channels: [{ channel: 'Vrbo', percent: null, isDefault: false }] }, { Vrbo: '' }, TODAY)).toBeNull();
  });

  it('HolderChanges_OnlyTheCellsThatDifferFromWhatTheServerHasAndNullBringsAListingBackToTheDefault', () => {
    const saved: ChannelAccountHolder[] = [{ propertyId: 'p1', propertyName: 'Casa 1', channel: 'Airbnb', holder: 'Agency', updatedAt: '2026-11-01T00:00:00Z' }];
    expect(holderChangesRequest({}, saved)).toBeNull();
    expect(holderChangesRequest({ 'p1|Airbnb': 'Agency', 'p2|Vrbo': 'default' }, saved)).toBeNull();
    expect(holderChangesRequest({ 'p1|Airbnb': 'default', 'p2|Vrbo': 'Owner', 'p3|Expedia': 'Agency' }, saved)).toEqual([
      { propertyId: 'p1', channel: 'Airbnb', holder: null },
      { propertyId: 'p2', channel: 'Vrbo', holder: 'Owner' },
      { propertyId: 'p3', channel: 'Expedia', holder: 'Agency' },
    ]);
  });

  it('MandateTemplate_CarriesWhatTheFormSaysAndLeavesOutTheFlatFeesThatAreNotWritten', () => {
    expect(
      mandateTemplateOf(values({ mandateCommissionPercent: '20', mandateCleaningFlatRate: '45,50', mandateLinenFlatRate: '', mandatePassthroughPaymentFees: true, mandateCommissionIncludesVat: true })),
    ).toEqual({ validFrom: TODAY, commissionPercent: 20, commissionBase: 'GrossExclTouristTax', commissionIncludesVat: true, cleaningFlatRate: 45.5, passthroughPaymentFees: true });
  });

  it('MandateTemplate_ABlankOrInvalidPercentOrDayIsNoMandateAtAllNeverOneOfZeroPercent', () => {
    for (const mandateCommissionPercent of ['', '   ', 'abc', '101', '12,345', '-5']) {
      expect(mandateTemplateOf(values({ mandateCommissionPercent })), mandateCommissionPercent).toBeNull();
    }
    expect(mandateTemplateOf(values({ mandateCommissionPercent: '20', mandateValidFrom: '' }))).toBeNull();
    expect(mandateTemplateOf(values({ mandateCommissionPercent: '20', mandateCleaningFlatRate: 'abc' }))).toBeNull();
    expect(mandateTemplateOf(values({ mandateCommissionPercent: '0' }))).toMatchObject({ commissionPercent: 0 });
  });
});

describe('what the server refused', () => {
  it('ProblemsOf_AnInvalidFieldIsShownOnItsFieldAndANameTheFormCannotShowIsLeftOut', () => {
    const refused = problem(422, { code: 'issuer_field_invalid', field: 'postalCode', errors: [{ field: 'postalCode', code: 'issuer_field_invalid' }, { field: 'swissVatNumber', code: 'issuer_field_invalid' }, { field: 'iban', code: 'x' }] });
    expect(problemsOf(refused, 'CH').map((entry) => entry.name)).toEqual(['postalCode', 'swissVatNumber']);
    expect(problemsOf(problem(422, { code: 'issuer_field_invalid', field: 'regime' }), 'CH')[0].name).toBe('swissVatRegistered');
    expect(problemsOf(problem(422, { code: 'issuer_field_invalid', field: 'regime' }), 'IT')[0].name).toBe('regime');
    expect(problemsOf(problem(422, { code: 'billing_channels_invalid' }), 'IT')).toEqual([]);
    expect(problemsOf(problem(500, {}), 'IT')).toEqual([]);
    expect(problemsOf(new Error('x'), 'IT')).toEqual([]);
  });

  it('IsNeedsWholeOrg_OnlyThe403OfAnAccessThatReachesSomeOfThePropertiesIsOne', () => {
    expect(isNeedsWholeOrg(problem(403, { code: 'fiscal_settings_need_whole_org' }))).toBe(true);
    expect(isNeedsWholeOrg(problem(403, { code: 'forbidden' }))).toBe(false);
    expect(isNeedsWholeOrg(problem(422, { code: 'fiscal_settings_need_whole_org' }))).toBe(false);
    expect(isNeedsWholeOrg(new Error('x'))).toBe(false);
  });
});
