import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import type { PropertySender, SenderConnectionTest } from '@/types';
import type { PanelStep } from '@/types/onboarding.types';
import {
  SENDER_STEP,
  SENDER_WIZARD_DEFAULTS,
  confirmationOf,
  consentGiven,
  defaultSenderChoice,
  delegationSettled,
  delegationTextKey,
  fixStepOf,
  outcomeOfSender,
  outcomeOfTest,
  outcomeToShow,
  propertyOfAddress,
  senderOptions,
  senderPanelResume,
  senderResumePath,
  senderStepIds,
  senderWizardHref,
  switchKind,
  switchProblemOf,
  toSwitchRequest,
  type SenderWizardValues,
} from '../sender-wizard-model';

const PROPERTY_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const VERSION = '2026-11-v1';

function sender(change: Partial<PropertySender> = {}): PropertySender {
  return {
    propertyId: PROPERTY_ID,
    sender: 'Manual',
    istatSender: 'Manual',
    source: 'DefaultNotConnected',
    applies: true,
    state: 'NotConfigured',
    verification: 'NotApplicable',
    reason: null,
    guidance: null,
    policeAccountValid: null,
    policeAutorun: null,
    policeLastCron: null,
    questuraCredentialsConfigured: false,
    channelManagerAvailable: true,
    availableSenders: ['ChannelManager', 'Manual'],
    delegationAccepted: false,
    delegationTextVersion: VERSION,
    declaredAt: null,
    lastChangedAt: null,
    ...change,
  };
}

const values = (change: Partial<SenderWizardValues> = {}): SenderWizardValues => ({ ...SENDER_WIZARD_DEFAULTS, ...change });

function test(change: Partial<SenderConnectionTest> = {}): SenderConnectionTest {
  return { sender: 'ChannelManager', outcome: 'Verified', reason: null, guidance: null, policeAccountValid: true, policeAutorun: true, policeLastCron: null, checkedAt: '2026-11-13T10:00:00Z', ...change };
}

function problem(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

describe('the steps and the ways to send', () => {
  it('senderStepIds_EachSender_HasOnlyTheStepsItNeeds', () => {
    expect(senderStepIds('ChannelManager')).toEqual(['choice', 'summary', 'credentials', 'panel', 'test']);
    // CasaZen has no panel to pass through; the host's own send ends at the summary, and so does a wizard with no answer yet.
    expect(senderStepIds('CasaZen')).toEqual(['choice', 'summary', 'credentials', 'test']);
    expect(senderStepIds('Manual')).toEqual(['choice', 'summary']);
    expect(senderStepIds('')).toEqual(['choice', 'summary']);
  });

  it('senderOptions_PropertyWithoutAChannelManager_HidesItAndOnlyOffersTheOtherWays', () => {
    const options = senderOptions(sender({ channelManagerAvailable: false, availableSenders: ['Manual'] }));

    expect(options.map((option) => option.sender)).toEqual(['CasaZen', 'Manual']);
  });

  it('senderOptions_CasaZenWhileTheServerDoesNotOfferIt_IsShownButCannotBeChosen', () => {
    const options = senderOptions(sender());

    expect(options).toEqual([
      { sender: 'ChannelManager', available: true },
      { sender: 'CasaZen', available: false },
      { sender: 'Manual', available: true },
    ]);
  });

  it('defaultSenderChoice_ConnectedProperty_StartsFromTheChannelManagerAndAnOtherwiseFirstWayOffered', () => {
    expect(defaultSenderChoice(sender({ sender: 'ChannelManager' }))).toBe('ChannelManager');
    // The sender in effect cannot be chosen now (the connector went off): the choice starts from the first way that can.
    expect(defaultSenderChoice(sender({ sender: 'ChannelManager', channelManagerAvailable: false, availableSenders: ['Manual'] }))).toBe('Manual');
    expect(defaultSenderChoice(sender({ availableSenders: [] }))).toBe('');
  });
});

describe('the delegation of the transmission', () => {
  it('delegationTextKey_VersionOfThisBuild_HasItsTextAndAnotherVersionHasNone', () => {
    expect(delegationTextKey(VERSION)).toBe('compliance.sender.delegation.text');
    expect(delegationTextKey('2099-01-v9')).toBeNull();
    expect(delegationTextKey('toString')).toBeNull();
  });

  it('consentGiven_OnlyForTheTextInForceThatThisPageCanShow', () => {
    expect(consentGiven(values({ delegationConsentVersion: VERSION }), sender())).toBe(true);
    expect(consentGiven(values({ delegationConsentVersion: '' }), sender())).toBe(false);
    // A consent given to an older text does not count for the one in force.
    expect(consentGiven(values({ delegationConsentVersion: '2026-10-v0' }), sender())).toBe(false);
    // A text this page cannot show is never consented to, even by a draft that names its version.
    expect(consentGiven(values({ delegationConsentVersion: '2099-01-v9' }), sender({ delegationTextVersion: '2099-01-v9' }))).toBe(false);
  });

  it('delegationSettled_AutomaticSenderWithoutConsent_IsNotSettledAndTheOthersAre', () => {
    expect(delegationSettled(values({ sender: 'ChannelManager' }), sender())).toBe(false);
    expect(delegationSettled(values({ sender: 'ChannelManager', delegationConsentVersion: VERSION }), sender())).toBe(true);
    // Accepted by the organization already: nothing is asked again. The host's own send needs no delegation.
    expect(delegationSettled(values({ sender: 'ChannelManager' }), sender({ delegationAccepted: true }))).toBe(true);
    expect(delegationSettled(values({ sender: 'Manual' }), sender())).toBe(true);
  });
});

describe('the request that changes the sender', () => {
  const change = confirmationOf('Manual', 'ChannelManager');

  it('toSwitchRequest_ConsentAndConfirmationGiven_CarriesTheVersionOfTheTextTheHostRead', () => {
    const request = toSwitchRequest(values({ sender: 'ChannelManager', delegationConsentVersion: VERSION, switchConfirmed: change }), sender());

    expect(request).toEqual({ sender: 'ChannelManager', confirmed: true, delegationConsent: true, delegationTextVersion: VERSION });
  });

  it('toSwitchRequest_NothingConfirmed_SendsNeitherTheConfirmationNorTheConsent', () => {
    const request = toSwitchRequest(values({ sender: 'ChannelManager' }), sender());

    expect(request).toEqual({ sender: 'ChannelManager', confirmed: false, delegationConsent: false });
    expect('delegationTextVersion' in request).toBe(false);
  });

  it('toSwitchRequest_ConfirmationOfAnotherChange_IsNotAConfirmationOfThisOne', () => {
    // The host confirmed «from CasaZen to manual»; the sender in effect is now the channel manager: that confirmation says nothing about this change.
    const stale = values({ sender: 'Manual', switchConfirmed: confirmationOf('CasaZen', 'Manual') });

    expect(toSwitchRequest(stale, sender({ sender: 'ChannelManager' })).confirmed).toBe(false);
  });

  it('toSwitchRequest_DelegationAlreadyAcceptedByTheOrganization_SendsNoConsentAgain', () => {
    const request = toSwitchRequest(values({ sender: 'ChannelManager', delegationConsentVersion: VERSION, switchConfirmed: change }), sender({ delegationAccepted: true }));

    expect(request.delegationConsent).toBe(false);
    expect('delegationTextVersion' in request).toBe(false);
  });

  it('toSwitchRequest_SameSenderAsInEffect_NeedsNoConfirmation', () => {
    expect(switchKind('Manual', 'Manual')).toBe('same');
    expect(toSwitchRequest(values({ sender: 'Manual' }), sender()).confirmed).toBe(false);
  });

  it.each([
    ['CasaZen', 'ChannelManager', 'automaticToAutomatic'],
    ['Manual', 'ChannelManager', 'manualToAutomatic'],
    ['ChannelManager', 'Manual', 'toManual'],
  ] as const)('switchKind_From%sTo%s_Is%s', (current, chosen, kind) => {
    expect(switchKind(current, chosen)).toBe(kind);
  });

  it.each([
    ['sender_switch_confirmation_required', 'confirmationRequired'],
    ['alloggiati_delegation_required', 'delegationRequired'],
    ['alloggiati_delegation_text_outdated', 'delegationOutdated'],
    ['alloggiati_delegation_text_version_required', 'delegationRequired'],
    ['sender_casazen_not_available', 'casaZenNotAvailable'],
    ['sender_channel_manager_not_available', 'channelManagerNotAvailable'],
    ['sender_not_applicable', 'notApplicable'],
    ['sender_changed_concurrently', 'changedConcurrently'],
  ])('switchProblemOf_Code%s_Is%s', (code, kind) => {
    expect(switchProblemOf(problem(409, { code }))).toBe(kind);
  });

  it('switchProblemOf_AnyOtherFailure_IsNotARefusalWithWordsOfItsOwn', () => {
    expect(switchProblemOf(problem(500, {}))).toBeNull();
    expect(switchProblemOf(problem(422, { code: 'something_else' }))).toBeNull();
    expect(switchProblemOf(new Error('boom'))).toBeNull();
  });
});

describe('what is shown as «Attivo»', () => {
  it('outcomeOfSender_OnlyAVerifiedActiveSender_IsActive', () => {
    expect(outcomeOfSender(sender({ sender: 'ChannelManager', state: 'Active', verification: 'Verified' }))).toBe('active');
    // `Active` without the verification of the server is not shown as working.
    expect(outcomeOfSender(sender({ sender: 'ChannelManager', state: 'Active', verification: 'Unverifiable' }))).toBe('unverified');
    expect(outcomeOfSender(sender({ sender: 'ChannelManager', state: 'Declared', verification: 'UserDeclared' }))).toBe('declared');
    expect(outcomeOfSender(sender({ sender: 'ChannelManager', state: 'Unverified', verification: 'Unverifiable' }))).toBe('unverified');
    expect(outcomeOfSender(sender({ sender: 'ChannelManager', state: 'Inactive', verification: 'Verified' }))).toBe('inactive');
    expect(outcomeOfSender(sender({ sender: 'Manual', state: 'NotConfigured' }))).toBe('manual');
    expect(outcomeOfSender(sender({ sender: 'CasaZen', state: 'Inactive' }))).toBe('notAvailable');
  });

  it.each([
    ['Verified', 'active'],
    ['Inactive', 'inactive'],
    ['Unverifiable', 'unverified'],
    ['NotApplicable', 'manual'],
    ['NotAvailable', 'notAvailable'],
  ] as const)('outcomeOfTest_%s_Is%s', (outcome, shown) => {
    expect(outcomeOfTest(test({ outcome }))).toBe(shown);
  });

  it('outcomeToShow_TestThatCannotTellAfterTheHostDeclared_IsDeclaredAndNeverActive', () => {
    const declared = sender({ sender: 'ChannelManager', state: 'Declared', verification: 'UserDeclared' });

    expect(outcomeToShow(declared, undefined)).toBe('declared');
    expect(outcomeToShow(declared, test({ outcome: 'Unverifiable' }))).toBe('declared');
    // A test that says it does not send wins over an older declaration; one that proves it is the only way to «attivo».
    expect(outcomeToShow(declared, test({ outcome: 'Inactive' }))).toBe('inactive');
    expect(outcomeToShow(declared, test({ outcome: 'Verified' }))).toBe('active');
    expect(outcomeToShow(sender({ sender: 'ChannelManager', state: 'Unverified', verification: 'Unverifiable' }), undefined)).toBe('unverified');
  });

  it.each([
    ['octorate_police_account_invalid', SENDER_STEP.panel],
    ['octorate_police_autorun_off', SENDER_STEP.panel],
    ['octorate_not_connected', SENDER_STEP.choice],
    ['sender_casazen_not_available', SENDER_STEP.choice],
    ['octorate_unavailable', null],
    ['octorate_police_not_exposed', null],
    [null, null],
  ])('fixStepOf_%s_Is%s', (reason, step) => {
    expect(fixStepOf(reason)).toBe(step);
  });
});

describe('the address and the way back from the panel', () => {
  it('senderWizardHref_Property_CarriesOnlyTheIdAndTheStep', () => {
    expect(senderWizardHref(PROPERTY_ID)).toBe(`/app/short-rent/compliance/sender?property=${PROPERTY_ID}`);
    expect(senderWizardHref(PROPERTY_ID, SENDER_STEP.panel)).toBe(`/app/short-rent/compliance/sender?property=${PROPERTY_ID}&step=panel`);
  });

  it.each([`?property=${PROPERTY_ID}`, `?property=${PROPERTY_ID.toUpperCase()}`])('propertyOfAddress_%s_IsTheId', (search) => {
    expect(propertyOfAddress(new URLSearchParams(search))).toBe(new URLSearchParams(search).get('property'));
  });

  it.each(['', '?property=', '?property=../../x', '?property=1', `?property=${PROPERTY_ID}/../x`, '?propertyId=3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'])(
    'propertyOfAddress_%s_IsNoProperty',
    (search) => {
      // The id ends up in the path of requests: only an id goes through.
      expect(propertyOfAddress(new URLSearchParams(search))).toBe('');
    },
  );

  it('senderPanelResume_NamesTheWizardTheDraftAndTheStepAndCarriesNothingElse', () => {
    expect(senderPanelResume(PROPERTY_ID)).toEqual({ resumeWizardType: 'ComplianceSender', resumeDraftEntityId: PROPERTY_ID, resumeStepCode: 'panel' });
  });

  const stepOf = (change: Partial<PanelStep['resume']>, propertyId: string | null = PROPERTY_ID): Pick<PanelStep, 'propertyId' | 'resume'> => ({
    propertyId,
    resume: { wizardType: 'ComplianceSender', draftEntityId: PROPERTY_ID, stepCode: 'panel', ...change },
  });

  it('senderResumePath_StepStartedByTheWizard_ReturnsToTheSameStepOfTheSameProperty', () => {
    expect(senderResumePath(stepOf({}))).toBe(`/app/short-rent/compliance/sender?property=${PROPERTY_ID}&step=panel`);
    // A step this version does not know leads to the wizard all the same, at its first step.
    expect(senderResumePath(stepOf({ stepCode: 'something-new' }))).toBe(`/app/short-rent/compliance/sender?property=${PROPERTY_ID}`);
  });

  it('senderResumePath_StepOfAnotherWizardOrWithoutAProperty_IsNotOursToLeadBack', () => {
    expect(senderResumePath(stepOf({ wizardType: 'OnboardingActivation' }))).toBeNull();
    expect(senderResumePath(stepOf({ wizardType: null }))).toBeNull();
    expect(senderResumePath(stepOf({}, null))).toBeNull();
    expect(senderResumePath(undefined)).toBeNull();
  });
});
