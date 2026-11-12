import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import { writeWizardDraft } from '@/lib/wizard-draft';
import { effectsOf, MODE_LABEL_KEYS, REGIME_LABEL_KEYS } from '../issuer-copy';
import {
  availabilityOf,
  formFieldOfIssue,
  identityOnRecord,
  initialModeOf,
  isChannelManagerRecommended,
  isDraftCurrent,
  issuerDefaults,
  issueOfFormField,
  issuesOf,
  modeFromValues,
  proposedRegimeCode,
  regimeCodeFollowing,
  stepIdsFor,
  taxProfileAddition,
  toSaveRequest,
} from '../issuer-wizard-model';
import {
  ISSUER_DRAFT_VERSION,
  ISSUER_ERROR_KEYS,
  ISSUER_WIZARD_ID,
  STEP_OF_FIELD,
  addressStepSchema,
  issuerStepSchema,
  regimeOfAnswers,
  regimeStepSchema,
  whoIssuesSchema,
  type IssuerWizardValues,
} from '../issuer-wizard-schema';
import { FISCAL_ISSUER_FIELDS } from '@/types';
import { ORG_NAME, SCOPE, completedSetting, problem, settings } from './issuer-fixtures';

/** The answers a person gives to become a business that CasaZen issues for. */
function casazenValues(overrides: Partial<IssuerWizardValues> = {}): IssuerWizardValues {
  return {
    ...issuerDefaults(settings(), ORG_NAME),
    mode: 'CasaZenDirectOnly',
    hasVatNumber: 'yes',
    vatRegime: 'flatRate',
    vatNumber: '12345678901',
    addressStreet: 'Via Roma',
    addressCivic: '12',
    postalCode: '20121',
    city: 'Milano',
    province: 'MI',
    ...overrides,
  };
}

/** The messages of the issues a schema finds, by field. */
function messagesOf(schema: ReturnType<typeof whoIssuesSchema>, values: object): Record<string, string> {
  const result = schema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

describe('the steps and the regime the answers lead to', () => {
  it('IssuerWizardModel_StepIdsFor_TheDataAndAddressStepsExistOnlyWhenCasazenIssues', () => {
    expect(stepIdsFor('CasaZenDirectOnly')).toEqual(['who', 'regime', 'issuer', 'address', 'summary']);
    expect(stepIdsFor('Octorate')).toEqual(['who', 'regime', 'summary']);
    expect(stepIdsFor('Accountant')).toEqual(['who', 'regime', 'summary']);
    expect(stepIdsFor(null)).toEqual(['who', 'regime', 'summary']);
  });

  it('IssuerWizardModel_RegimeOfAnswers_TwoQuestionsLeadToOneOfThreeRegimes', () => {
    expect(regimeOfAnswers({ hasVatNumber: 'no', vatRegime: null })).toBe('PrivatePerson');
    // The second question is not asked of a private person: whatever it holds does not change the regime.
    expect(regimeOfAnswers({ hasVatNumber: 'no', vatRegime: 'flatRate' })).toBe('PrivatePerson');
    expect(regimeOfAnswers({ hasVatNumber: 'yes', vatRegime: 'ordinary' })).toBe('VatOrdinary');
    expect(regimeOfAnswers({ hasVatNumber: 'yes', vatRegime: 'flatRate' })).toBe('VatFlatRate');
    expect(regimeOfAnswers({ hasVatNumber: 'yes', vatRegime: null })).toBeNull();
    expect(regimeOfAnswers({ hasVatNumber: null, vatRegime: null })).toBeNull();
  });

  it('IssuerWizardModel_ModeFromValues_OnlyOneOfTheThreeChoicesCounts', () => {
    expect(modeFromValues({ mode: 'Octorate' })).toBe('Octorate');
    expect(modeFromValues({ mode: null })).toBeNull();
    expect(modeFromValues({ mode: 'Nobody' as never })).toBeNull();
  });

  it('IssuerWizardModel_ProposedRegimeCode_IsTheOneOfTheRegime', () => {
    expect(proposedRegimeCode('VatOrdinary')).toBe('RF01');
    expect(proposedRegimeCode('VatFlatRate')).toBe('RF19');
  });
});

describe('what the wizard starts from', () => {
  it('IssuerWizardModel_Defaults_FirstTimeStartsFromTheNameOfTheOrganization', () => {
    const values = issuerDefaults(settings(), ORG_NAME);

    expect(values.mode).toBeNull();
    expect(values.legalName).toBe(ORG_NAME);
    expect(values.hasVatNumber).toBeNull();
    expect(values.countryCode).toBe('IT');
  });

  it('IssuerWizardModel_Defaults_ASavedSettingIsPrefilledAndAVatNumberOnRecordAnswersTheFirstQuestion', () => {
    const saved = completedSetting({
      regime: undefined,
      issuer: { ...completedSetting().issuer, vatNumber: '12345678901', fiscalCode: undefined },
    });
    const values = issuerDefaults(saved, ORG_NAME);

    expect(values.mode).toBe('CasaZenDirectOnly');
    expect(values.legalName).toBe('Mario Rossi');
    expect(values.addressStreet).toBe('Via Roma');
    expect(values.postalCode).toBe('20121');
    expect(values.vatNumber).toBe('12345678901');
    expect(values.hasVatNumber).toBe('yes');
    expect(issuerDefaults(completedSetting({ regime: 'VatOrdinary' }), ORG_NAME)).toMatchObject({ hasVatNumber: 'yes', vatRegime: 'ordinary' });
    expect(issuerDefaults(completedSetting({ regime: 'PrivatePerson' }), ORG_NAME)).toMatchObject({ hasVatNumber: 'no', vatRegime: null });
  });

  it('IssuerWizardModel_Availability_SaysWhatTheEnvironmentAndTheOrganizationCanDo', () => {
    expect(availabilityOf(settings({ casazenIssuanceEnabled: false, octorateConnected: true }))).toEqual({
      casazenIssuanceEnabled: false,
      octorateConnected: true,
    });
    expect(identityOnRecord(completedSetting())).toEqual({ vatNumber: false, fiscalCode: true });
  });

  it('IssuerWizardModel_ChannelManagerRecommended_OnlyWhenItIssuesEveryBookingAndIsConnected', () => {
    expect(isChannelManagerRecommended({ octorateIssuesAllBookings: true, octorateConnected: true })).toBe(true);
    expect(isChannelManagerRecommended({ octorateIssuesAllBookings: true, octorateConnected: false })).toBe(false);
    expect(isChannelManagerRecommended({ octorateIssuesAllBookings: false, octorateConnected: true })).toBe(false);
  });
});

describe('the draft of the wizard', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('IssuerWizardModel_DraftCurrent_OnlyWhileItIsNewerThanTheLastConfirmation', () => {
    const confirmedAt = '2026-11-01T10:00:00Z';
    const confirmedMs = Date.parse(confirmedAt);

    expect(isDraftCurrent({ savedAt: confirmedMs + 1 }, { confirmedAt })).toBe(true);
    expect(isDraftCurrent({ savedAt: confirmedMs - 1 }, { confirmedAt })).toBe(false);
    expect(isDraftCurrent({ savedAt: 1 }, { confirmedAt: undefined })).toBe(true);
  });

  it('IssuerWizardModel_InitialMode_IsTheOneOfTheDraftTheFormWillBeGiven', () => {
    const saved = settings({ mode: 'Accountant' });
    writeWizardDraft(ISSUER_WIZARD_ID, SCOPE, { step: 'regime', values: { mode: 'CasaZenDirectOnly' } }, { version: ISSUER_DRAFT_VERSION });

    expect(initialModeOf(saved, SCOPE)).toBe('CasaZenDirectOnly');
    // Nobody signed in: no draft is read, the setting of the server is what there is.
    expect(initialModeOf(saved, null)).toBe('Accountant');
  });

  it('IssuerWizardModel_InitialMode_ADraftOlderThanTheConfirmationOrOfAnotherShapeIsNotUsed', () => {
    const confirmedAt = '2099-01-01T00:00:00Z';
    const saved = settings({ mode: 'Octorate', confirmedAt });
    writeWizardDraft(ISSUER_WIZARD_ID, SCOPE, { step: 'regime', values: { mode: 'CasaZenDirectOnly' } }, { version: ISSUER_DRAFT_VERSION });
    expect(initialModeOf(saved, SCOPE)).toBe('Octorate');

    sessionStorage.clear();
    writeWizardDraft(ISSUER_WIZARD_ID, SCOPE, { step: 'regime', values: { mode: 'CasaZenDirectOnly' } }, { version: ISSUER_DRAFT_VERSION + 1 });
    expect(initialModeOf(settings({ mode: 'Octorate' }), SCOPE)).toBe('Octorate');
  });

  it('IssuerWizardModel_InitialMode_ADraftWithNoChoiceMeansNoChoice', () => {
    writeWizardDraft(ISSUER_WIZARD_ID, SCOPE, { step: 'who', values: { mode: null } }, { version: ISSUER_DRAFT_VERSION });

    expect(initialModeOf(settings({ mode: 'Accountant' }), SCOPE)).toBeNull();
  });
});

describe('what the last button sends', () => {
  it('IssuerWizardModel_SaveRequest_CasazenSendsTheIssuerDataWrittenAsTheServerStoresIt', () => {
    const values = casazenValues({
      legalName: '  Casa Rossi Srl ',
      province: 'mi',
      postalCode: '20 121',
      fatturaPaRegimeCode: 'rf19',
      issuerSdiRecipientCode: 'abc1234',
      issuerPec: 'Rossi@PEC.it',
      defaultSeries: '   ',
    });

    expect(toSaveRequest(values, settings())).toEqual({
      mode: 'CasaZenDirectOnly',
      regime: 'VatFlatRate',
      confirmed: true,
      issuer: {
        legalName: 'Casa Rossi Srl',
        addressStreet: 'Via Roma',
        addressCivic: '12',
        postalCode: '20121',
        city: 'Milano',
        province: 'MI',
        countryCode: 'IT',
        fatturaPaRegimeCode: 'RF19',
        issuerSdiRecipientCode: 'ABC1234',
        issuerPec: 'rossi@pec.it',
        defaultSeries: undefined,
      },
    });
  });

  it('IssuerWizardModel_SaveRequest_AnotherIssuerLeavesTheDataOfTheIssuerAsTheServerHasIt', () => {
    const saved = completedSetting({ regime: 'VatOrdinary', issuer: { ...completedSetting().issuer, fatturaPaRegimeCode: 'RF05' } });
    // What is in the form is not sent: a save replaces the setting as a whole, and the data would be cleared.
    const values = casazenValues({ mode: 'Accountant', legalName: 'Another name', hasVatNumber: 'yes', vatRegime: 'ordinary' });
    const request = toSaveRequest(values, saved);

    expect(request).toMatchObject({ mode: 'Accountant', regime: 'VatOrdinary', confirmed: true });
    expect(request?.issuer).toMatchObject({ legalName: 'Mario Rossi', addressStreet: 'Via Roma', postalCode: '20121', fatturaPaRegimeCode: 'RF05' });
  });

  it('IssuerWizardModel_SaveRequest_AnOverrideOfTheRegimeCodeGoesWhenTheRegimeChanges', () => {
    const saved = completedSetting({ regime: 'VatOrdinary', issuer: { ...completedSetting().issuer, fatturaPaRegimeCode: 'RF05' } });
    const values = casazenValues({ mode: 'Octorate', hasVatNumber: 'yes', vatRegime: 'flatRate' });

    expect(toSaveRequest(values, saved)?.issuer?.fatturaPaRegimeCode).toBeUndefined();
  });

  it('IssuerWizardModel_SaveRequest_NoChoiceIsNoRequest', () => {
    expect(toSaveRequest(casazenValues({ mode: null }), settings())).toBeNull();
  });
});

describe('the regime code follows the regime', () => {
  // An accountant chose RF05 for the ordinary regime: the field of the options starts from it.
  const saved = completedSetting({ regime: 'VatOrdinary', issuer: { ...completedSetting().issuer, fatturaPaRegimeCode: 'RF05' } });

  it('IssuerWizardModel_RegimeCode_TheSavedCodeIsEmptiedWhenTheAnswersLeadToAnotherRegime', () => {
    expect(regimeCodeFollowing('RF05', 'VatFlatRate', saved)).toBe('');
    expect(regimeCodeFollowing(' rf05 ', 'PrivatePerson', saved)).toBe('');
    // Between the two questions the answers lead to no regime yet: the code is not carried over to whatever comes next either.
    expect(regimeCodeFollowing('RF05', null, saved)).toBe('');
  });

  it('IssuerWizardModel_RegimeCode_TheSavedCodeComesBackWithItsRegimeAndACodeTheyWroteIsNeverTouched', () => {
    expect(regimeCodeFollowing('', 'VatOrdinary', saved)).toBe('RF05');
    // Already there, or a code of their own: nothing to do, in either direction.
    expect(regimeCodeFollowing('RF05', 'VatOrdinary', saved)).toBeNull();
    expect(regimeCodeFollowing('RF02', 'VatOrdinary', saved)).toBeNull();
    expect(regimeCodeFollowing('RF02', 'VatFlatRate', saved)).toBeNull();
  });

  it('IssuerWizardModel_RegimeCode_WithNoSavedCodeThereIsNothingToFollow', () => {
    const none = completedSetting({ regime: 'VatOrdinary' });

    expect(regimeCodeFollowing('', 'VatFlatRate', none)).toBeNull();
    expect(regimeCodeFollowing('', 'VatOrdinary', none)).toBeNull();
  });
});

describe('what goes to the tax profile', () => {
  it('IssuerWizardModel_TaxProfileAddition_AVatNumberTheProfileDoesNotHaveIsAddedNeverChanged', () => {
    const values = casazenValues({ vatNumber: '123 456 789 01' });

    expect(taxProfileAddition(values, settings())).toEqual({ hasPartitaIva: true, partitaIvaNumber: '12345678901' });
    // One that is on record is read, never rewritten by the wizard.
    const onRecord = settings({ issuer: { countryCode: 'IT', vatNumber: '99999999999' } });
    expect(taxProfileAddition(values, onRecord)).toBeNull();
  });

  it('IssuerWizardModel_TaxProfileAddition_APrivatePersonAddsTheFiscalCodeInCapitals', () => {
    const values = casazenValues({ hasVatNumber: 'no', vatRegime: null, fiscalCode: 'rssmra80a01h501u', vatNumber: '12345678901' });

    expect(taxProfileAddition(values, settings())).toEqual({ fiscalCode: 'RSSMRA80A01H501U' });
  });

  it('IssuerWizardModel_TaxProfileAddition_NothingForAnotherIssuer', () => {
    expect(taxProfileAddition(casazenValues({ mode: 'Accountant' }), settings())).toBeNull();
    expect(taxProfileAddition(casazenValues({ mode: 'Octorate' }), settings())).toBeNull();
  });
});

describe('what a refused save names', () => {
  it('IssuerWizardModel_IssuesOf_ProfileIncompleteListsTheMissingFields', () => {
    const error = problem(422, { code: 'issuer_profile_incomplete', fields: ['legalName', 'postalCode', 'vatNumber', 'unknownField'] });

    expect(issuesOf(error)).toEqual(['legalName', 'postalCode', 'vatNumber']);
  });

  it('IssuerWizardModel_IssuesOf_FieldInvalidListsTheValuesThatAreNotValid', () => {
    const error = problem(422, {
      code: 'issuer_field_invalid',
      field: 'issuerPec',
      errors: [
        { field: 'issuerPec', code: 'issuer_field_invalid' },
        { field: 'defaultSeries', code: 'issuer_field_invalid' },
        { field: 'countryCode', code: 'issuer_field_invalid' },
      ],
    });

    // The country is not asked: there is no field to put a message on.
    expect(issuesOf(error)).toEqual(['issuerPec', 'defaultSeries']);
    expect(issuesOf(problem(422, { code: 'issuer_field_invalid', field: 'province' }))).toEqual(['province']);
  });

  it('IssuerWizardModel_IssuesOf_AnyOtherAnswerNamesNothing', () => {
    expect(issuesOf(problem(422, { code: 'document_issuance_not_available' }))).toEqual([]);
    expect(issuesOf(problem(403, { code: 'fiscal_settings_need_whole_org' }))).toEqual([]);
    expect(issuesOf(problem(500, { code: 'issuer_profile_incomplete', fields: ['legalName'] }))).toEqual([]);
    expect(issuesOf(new Error('boom'))).toEqual([]);
  });

  it('IssuerWizardModel_Issues_EveryFieldIsOnAStepAndTheRegimeIsShownOnItsFirstQuestion', () => {
    for (const field of FISCAL_ISSUER_FIELDS) expect(STEP_OF_FIELD[field]).toBeDefined();
    expect(formFieldOfIssue('regime')).toBe('hasVatNumber');
    expect(formFieldOfIssue('legalName')).toBe('legalName');
    expect(formFieldOfIssue('countryCode')).toBeNull();
    // Editing either question of the regime settles the problem of the regime.
    expect(issueOfFormField('hasVatNumber')).toBe('regime');
    expect(issueOfFormField('vatRegime')).toBe('regime');
    expect(issueOfFormField('postalCode')).toBe('postalCode');
    expect(issueOfFormField('countryCode')).toBeNull();
    expect(issueOfFormField('something')).toBeNull();
  });
});

describe('the checks of the steps', () => {
  it('IssuerWizardSchema_Who_ACasazenChoiceNeedsIssuingToBeOnAndAChannelManagerNeedsTheConnection', () => {
    const off = whoIssuesSchema({ casazenIssuanceEnabled: false, octorateConnected: false });
    const on = whoIssuesSchema({ casazenIssuanceEnabled: true, octorateConnected: true });

    expect(messagesOf(off, { mode: 'CasaZenDirectOnly' })).toEqual({ mode: ISSUER_ERROR_KEYS.casazenUnavailable });
    expect(messagesOf(off, { mode: 'Octorate' })).toEqual({ mode: ISSUER_ERROR_KEYS.octorateUnavailable });
    expect(messagesOf(off, { mode: 'Accountant' })).toEqual({});
    expect(messagesOf(off, { mode: null })).toEqual({ mode: ISSUER_ERROR_KEYS.modeRequired });
    expect(messagesOf(on, { mode: 'CasaZenDirectOnly' })).toEqual({});
    expect(messagesOf(on, { mode: 'Octorate' })).toEqual({});
  });

  it('IssuerWizardSchema_Regime_OnlyWhoHasAVatNumberIsAskedWhichRegime', () => {
    expect(messagesOf(regimeStepSchema, { hasVatNumber: null, vatRegime: null })).toEqual({ hasVatNumber: ISSUER_ERROR_KEYS.hasVatNumber });
    expect(messagesOf(regimeStepSchema, { hasVatNumber: 'yes', vatRegime: null })).toEqual({ vatRegime: ISSUER_ERROR_KEYS.vatRegime });
    expect(messagesOf(regimeStepSchema, { hasVatNumber: 'yes', vatRegime: 'flatRate' })).toEqual({});
    expect(messagesOf(regimeStepSchema, { hasVatNumber: 'no', vatRegime: null })).toEqual({});
  });

  it('IssuerWizardSchema_Issuer_AllTheProblemsOfTheStepComeTogether', () => {
    const schema = issuerStepSchema({ vatNumber: false, fiscalCode: false });
    const values = casazenValues({
      legalName: '   ',
      vatNumber: '1234',
      fatturaPaRegimeCode: 'RF0123',
      issuerSdiRecipientCode: 'ABC',
      issuerPec: 'not an address',
      defaultSeries: 'no spaces here',
    });

    expect(messagesOf(schema, values)).toEqual({
      legalName: ISSUER_ERROR_KEYS.legalName,
      vatNumber: ISSUER_ERROR_KEYS.vatNumber,
      fatturaPaRegimeCode: ISSUER_ERROR_KEYS.fatturaPaRegimeCode,
      issuerSdiRecipientCode: ISSUER_ERROR_KEYS.issuerSdiRecipientCode,
      issuerPec: ISSUER_ERROR_KEYS.issuerPec,
      defaultSeries: ISSUER_ERROR_KEYS.defaultSeries,
    });
  });

  it('IssuerWizardSchema_Issuer_TheOptionsMayBeEmptyAndTheIdentityOnRecordIsNotAskedAgain', () => {
    const asked = issuerStepSchema({ vatNumber: false, fiscalCode: false });
    const known = issuerStepSchema({ vatNumber: true, fiscalCode: true });
    const empty = casazenValues({ vatNumber: '', fiscalCode: '' });

    expect(messagesOf(asked, empty)).toEqual({ vatNumber: ISSUER_ERROR_KEYS.vatNumber });
    expect(messagesOf(asked, casazenValues({ hasVatNumber: 'no', vatRegime: null, vatNumber: '', fiscalCode: '' }))).toEqual({
      fiscalCode: ISSUER_ERROR_KEYS.fiscalCode,
    });
    expect(messagesOf(known, empty)).toEqual({});
    expect(messagesOf(asked, casazenValues({ hasVatNumber: 'no', vatRegime: null, fiscalCode: 'RSSMRA80A01H501U' }))).toEqual({});
  });

  it('IssuerWizardSchema_Address_ItalianPostalCodeAndProvinceHaveTheirShape', () => {
    const values = (overrides: Partial<IssuerWizardValues>) => casazenValues(overrides);

    expect(messagesOf(addressStepSchema, values({}))).toEqual({});
    expect(messagesOf(addressStepSchema, values({ postalCode: '2012', province: 'Milano', addressStreet: ' ', city: '' }))).toEqual({
      addressStreet: ISSUER_ERROR_KEYS.addressStreet,
      city: ISSUER_ERROR_KEYS.city,
      postalCode: ISSUER_ERROR_KEYS.postalCode,
      province: ISSUER_ERROR_KEYS.province,
    });
    // An issuer abroad keeps the country the server has: the code and the province are looser.
    expect(messagesOf(addressStepSchema, values({ countryCode: 'CH', postalCode: '6900 Lugano', province: '' }))).toEqual({});
  });
});

describe('the words', () => {
  it('IssuerWizardCopy_Labels_EveryLabelAndEveryMessageOfACheckExistsInBothLanguages', () => {
    const keys = [...Object.values(MODE_LABEL_KEYS), ...Object.values(REGIME_LABEL_KEYS), ...Object.values(ISSUER_ERROR_KEYS)];

    for (const lng of ['it', 'en']) {
      for (const key of keys) expect(i18n.exists(key, { lng }), `${key} (${lng})`).toBe(true);
    }
  });

  it('IssuerWizardCopy_Effects_CasazenSaysTheSdiIsNotThereYetAndThatNothingIsIssuedUntilTheRuleIsConfirmed', () => {
    const t = i18n.getFixedT('it');

    const lines = effectsOf(t, { mode: 'CasaZenDirectOnly', regime: 'PrivatePerson', settings: settings({ sdi: { providerConfigured: false } }) });

    expect(lines).toContain(t('fiscalDocuments.issuer.effects.sdi.notAvailable'));
    expect(lines).toContain(t('fiscalDocuments.issuer.effects.casazen.ruleUnconfirmed'));
    expect(lines).toContain(t('fiscalDocuments.issuer.effects.casazen.portals'));
    expect(lines.join(' ')).not.toMatch(/octorate/i);
  });

  it('IssuerWizardCopy_Effects_WithAChannelAndAConfirmedRuleThoseTwoSentencesGo', () => {
    const t = i18n.getFixedT('it');
    const configured = settings({
      regime: 'VatOrdinary',
      sdi: { providerConfigured: true },
      rule: { documentKind: 'Invoice', configured: true, invoiceTypeCode: 'TD01', creditNoteTypeCode: 'TD04', seriesPattern: '{year}' },
    });

    const lines = effectsOf(t, { mode: 'CasaZenDirectOnly', regime: 'VatOrdinary', settings: configured });

    expect(lines).toContain(t('fiscalDocuments.issuer.effects.sdi.available'));
    expect(lines).not.toContain(t('fiscalDocuments.issuer.effects.sdi.notAvailable'));
    expect(lines).not.toContain(t('fiscalDocuments.issuer.effects.casazen.ruleUnconfirmed'));
    // The rule is the one of the regime the server has: for another regime it is not known, and the sentence stays.
    expect(effectsOf(t, { mode: 'CasaZenDirectOnly', regime: 'PrivatePerson', settings: configured })).toContain(
      t('fiscalDocuments.issuer.effects.casazen.ruleUnconfirmed'),
    );
  });

  it('IssuerWizardCopy_Effects_AnotherIssuerNeverPromisesWhatCasazenDoesNotDo', () => {
    const t = i18n.getFixedT('en');
    const channel = effectsOf(t, { mode: 'Octorate', regime: 'PrivatePerson', settings: settings() }).join(' ');
    const accountant = effectsOf(t, { mode: 'Accountant', regime: 'PrivatePerson', settings: settings() }).join(' ');

    expect(channel).toMatch(/only one issuer/i);
    expect(channel).not.toMatch(/octorate/i);
    expect(accountant).toMatch(/accountant/i);
    expect(`${channel} ${accountant}`).not.toMatch(/you download the XML/i);
  });
});
