import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import en from '@/i18n/locales/en.json';
import it_ from '@/i18n/locales/it.json';
import guestDe from '@/i18n/locales/guest-checkin.de.json';
import guestFr from '@/i18n/locales/guest-checkin.fr.json';
import guestEs from '@/i18n/locales/guest-checkin.es.json';
import type { IdentityVerificationState } from '@/types/public-checkin.types';
import {
  afterConsent,
  afterDocument,
  afterOperatorRequest,
  afterProblem,
  afterRetake,
  afterSelfie,
  classifyIdentityError,
  GUIDANCE_CODES,
  guidanceKey,
  IDENTITY_PROBLEMS,
  isIdentityConcluded,
  legalTextOf,
  problemKey,
  progressFromState,
  retakeTargetOf,
  sideAskedBy,
  type IdentityProgress,
} from '../lib/identity-model';

const state = (overrides: Partial<IdentityVerificationState> = {}): IdentityVerificationState => ({
  step: 'consent',
  result: null,
  biometricOffered: true,
  consentRecorded: false,
  consentRefused: false,
  documentChecked: false,
  attemptsRemaining: 3,
  operatorRequested: false,
  operatorPathOpen: true,
  documentNotArchived: false,
  verifyingGuestPosition: 0,
  ...overrides,
});

const start = (overrides: Partial<IdentityVerificationState> = {}): IdentityProgress => progressFromState(state(overrides));

function httpError(status?: number, data?: unknown, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const response = status === undefined ? undefined : { status, data, statusText: '', headers: {}, config };
  return new AxiosError('Request failed', code ?? AxiosError.ERR_BAD_REQUEST, config, {}, response);
}

function lookup(tree: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), tree);
}

describe('progressFromState (E03/F04/US03/T01)', () => {
  it.each([
    ['consent', 'consent'],
    ['document', 'document'],
    ['selfie', 'selfie'],
    ['done', 'done'],
    ['operator', 'operator'],
  ] as const)('progressFromState_Step_%s_StartsAt_%s', (step, stage) => {
    expect(start({ step }).stage).toBe(stage);
  });

  it('progressFromState_TicinoAtTheSelfie_StartsAtTheDocumentBecauseThePageHasNoPhotoOfItAnyMore', () => {
    expect(start({ step: 'selfie', documentNotArchived: true }).stage).toBe('document');
  });

  it('progressFromState_APassAfterAReload_HasNoLockCode', () => {
    expect(start({ step: 'done', result: 'ok' }).lockCode).toBeNull();
  });
});

describe('the answers of the API', () => {
  it('afterConsent_Recorded_GoesToTheDocument', () => {
    const next = afterConsent(start(), {
      consentRecorded: true,
      result: 'consent_recorded',
      biometricOffered: true,
      operatorPathOpen: true,
      state: state({ step: 'document', consentRecorded: true }),
    });

    expect(next.stage).toBe('document');
    expect(next.documentRefused).toBe(false);
  });

  it('afterConsent_Refused_GoesToAPersonWhoHasItAlready', () => {
    const next = afterConsent(start(), {
      consentRecorded: false,
      result: 'operator',
      biometricOffered: false,
      operatorPathOpen: true,
      state: state({ step: 'operator', consentRefused: true, operatorRequested: true, biometricOffered: false }),
    });

    expect(next.stage).toBe('operator');
    expect(next.operatorRequested).toBe(true);
    expect(isIdentityConcluded(next)).toBe(true);
  });

  it('afterConsent_NotOffered_GoesToAPersonButNothingIsConcludedUntilTheGuestAsks', () => {
    // The verification is not offered and nobody was asked: the API says `operator`, and the page waits for the guest to ask.
    const next = afterConsent(start({ step: 'operator', biometricOffered: false }), {
      consentRecorded: false,
      result: 'operator',
      biometricOffered: false,
      operatorPathOpen: true,
      state: state({ step: 'operator', biometricOffered: false, operatorRequested: false }),
    });

    expect(next.stage).toBe('operator');
    expect(next.operatorRequested).toBe(false);
    expect(isIdentityConcluded(next)).toBe(false);
  });

  it('afterDocument_NotGoodEnough_StaysAtTheDocumentWithTheGuidance', () => {
    const next = afterDocument(start({ step: 'document' }), {
      success: false,
      acceptable: false,
      guidanceCodes: ['avoid_glare', 'show_whole_document'],
      documentStored: false,
      documentNotArchived: false,
    });

    expect(next.stage).toBe('document');
    expect(next.documentRefused).toBe(true);
    expect(next.guidanceCodes).toEqual(['avoid_glare', 'show_whole_document']);
  });

  it('afterDocument_NotGoodEnoughAndNoGuidance_IsStillRefused', () => {
    const next = afterDocument(start({ step: 'document' }), { success: false, acceptable: false, guidanceCodes: [], documentStored: false, documentNotArchived: false });

    expect(next.documentRefused).toBe(true);
    expect(next.stage).toBe('document');
  });

  it('afterDocument_Acceptable_GoesToTheSelfieAndForgetsTheGuidance', () => {
    const refused = afterDocument(start({ step: 'document' }), { success: false, acceptable: false, guidanceCodes: ['hold_still'], documentStored: false, documentNotArchived: false });
    const next = afterDocument(refused, { success: true, acceptable: true, guidanceCodes: [], documentStored: true, documentNotArchived: false });

    expect(next.stage).toBe('selfie');
    expect(next.guidanceCodes).toEqual([]);
    expect(next.documentRefused).toBe(false);
  });

  it('afterDocument_TheApiSaysTheDocumentIsNotArchived_IsRemembered', () => {
    const next = afterDocument(start({ step: 'document' }), { success: true, acceptable: true, guidanceCodes: [], documentStored: false, documentNotArchived: true });

    expect(next.documentNotArchived).toBe(true);
  });

  it('afterSelfie_Ok_ShowsTheLockCode', () => {
    const next = afterSelfie(start({ step: 'selfie' }), { result: 'ok', guidanceCodes: [], attemptsRemaining: 2, operatorPathOpen: true, lockCode: ' 4821 ' });

    expect(next.stage).toBe('done');
    expect(next.lockCode).toBe('4821');
  });

  it.each([null, undefined, '', '   '])('afterSelfie_OkWithNoCode_%s_HasNoLockCode', (lockCode) => {
    const next = afterSelfie(start({ step: 'selfie' }), { result: 'ok', guidanceCodes: [], attemptsRemaining: 2, operatorPathOpen: true, lockCode });

    expect(next.stage).toBe('done');
    expect(next.lockCode).toBeNull();
  });

  it('afterSelfie_OkWithTheCodeHeldBack_KeepsWhyAndNoCode_AndACodeNeverComesWithIt', () => {
    const held = afterSelfie(start({ step: 'selfie' }), {
      result: 'ok',
      guidanceCodes: [],
      attemptsRemaining: 2,
      operatorPathOpen: true,
      lockCode: null,
      lockCodeHeld: ' tourist_tax_due ',
    });
    expect(held.stage).toBe('done');
    expect(held.lockCode).toBeNull();
    expect(held.lockCodeHeld).toBe('tourist_tax_due');

    // A code that came is what the guest sees: no «held» next to it.
    const given = afterSelfie(start({ step: 'selfie' }), { result: 'ok', guidanceCodes: [], attemptsRemaining: 2, operatorPathOpen: true, lockCode: '4821', lockCodeHeld: 'tourist_tax_due' });
    expect(given.lockCode).toBe('4821');
    expect(given.lockCodeHeld).toBeNull();

    // Neither a retry nor a person keeps it.
    const retry = afterSelfie(start({ step: 'selfie' }), { result: 'retry', guidanceCodes: ['move_closer'], attemptsRemaining: 2, operatorPathOpen: true, lockCodeHeld: 'tourist_tax_due' });
    expect(retry.lockCodeHeld).toBeNull();
  });

  it('afterSelfie_RetryThatCarriesACode_NeverKeepsTheCode', () => {
    const next = afterSelfie(start({ step: 'selfie' }), { result: 'retry', guidanceCodes: ['move_closer'], attemptsRemaining: 2, operatorPathOpen: true, lockCode: '4821' });

    expect(next.stage).toBe('retry');
    expect(next.lockCode).toBeNull();
    expect(next.attemptsRemaining).toBe(2);
    expect(next.guidanceCodes).toEqual(['move_closer']);
  });

  it('afterSelfie_OperatorThatCarriesACode_NeverKeepsTheCodeAndAPersonHasIt', () => {
    const next = afterSelfie(start({ step: 'selfie' }), { result: 'operator', guidanceCodes: [], attemptsRemaining: 0, operatorPathOpen: true, lockCode: '4821' });

    expect(next.stage).toBe('operator');
    expect(next.lockCode).toBeNull();
    expect(isIdentityConcluded(next)).toBe(true);
  });

  it('afterOperatorRequest_AskedAfterARetry_GoesToAPerson', () => {
    const retry = afterSelfie(start({ step: 'selfie' }), { result: 'retry', guidanceCodes: ['hold_still'], attemptsRemaining: 2, operatorPathOpen: true });
    const next = afterOperatorRequest(retry, { result: 'operator', operatorPathOpen: true, state: state({ step: 'operator', operatorRequested: true }) });

    expect(next.stage).toBe('operator');
    expect(next.operatorRequested).toBe(true);
    expect(next.guidanceCodes).toEqual([]);
  });

  it('afterOperatorRequest_AVerificationThatPassed_StaysPassedWithItsCode', () => {
    const passed = afterSelfie(start({ step: 'selfie' }), { result: 'ok', guidanceCodes: [], attemptsRemaining: 2, operatorPathOpen: true, lockCode: '4821' });
    const next = afterOperatorRequest(passed, { result: 'ok', operatorPathOpen: true, state: state({ step: 'done', result: 'ok' }) });

    expect(next.stage).toBe('done');
    expect(next.lockCode).toBe('4821');
  });

  it('afterRetake_GuidanceAboutTheDocument_GoesBackToTheDocument', () => {
    const retry = afterSelfie(start({ step: 'selfie' }), { result: 'retry', guidanceCodes: ['upload_document_again'], attemptsRemaining: 2, operatorPathOpen: true });

    expect(afterRetake(retry).stage).toBe('document');
  });

  it('afterRetake_GuidanceAboutTheSelfie_GoesBackToTheSelfie', () => {
    const retry = afterSelfie(start({ step: 'selfie' }), { result: 'retry', guidanceCodes: ['more_light'], attemptsRemaining: 2, operatorPathOpen: true });
    const next = afterRetake(retry);

    expect(next.stage).toBe('selfie');
    expect(next.attemptsRemaining).toBe(2);
  });

  it.each([
    [['upload_document_again'], 'document'],
    [['use_valid_document', 'hold_still'], 'document'],
    [['move_closer', 'more_light'], 'selfie'],
    [[], 'selfie'],
  ] as const)('retakeTargetOf_%j_Is_%s', (codes, target) => {
    expect(retakeTargetOf(codes)).toBe(target);
  });
});

describe('afterProblem and isIdentityConcluded', () => {
  it('afterProblem_TheApiAsksForTheConsentFirst_GoesBackToTheConsent', () => {
    expect(afterProblem(start({ step: 'selfie' }), 'consent_required').stage).toBe('consent');
  });

  it('afterProblem_TheTextOfTheConsentChanged_StaysAtTheConsentToReadItAgain', () => {
    expect(afterProblem(start({ step: 'consent' }), 'consent_text_changed').stage).toBe('consent');
  });

  it.each(['document_required', 'document_photo'] as const)('afterProblem_%s_GoesBackToTheDocument', (problem) => {
    expect(afterProblem(start({ step: 'selfie' }), problem).stage).toBe('document');
  });

  it.each(['network', 'processing', 'failed', 'too_many_requests', 'link_unavailable'] as const)('afterProblem_%s_LeavesTheGuestWhereTheyAre', (problem) => {
    const before = start({ step: 'selfie' });

    expect(afterProblem(before, problem)).toBe(before);
  });

  it('isIdentityConcluded_NoIdentityStep_IsConcluded', () => {
    expect(isIdentityConcluded(null)).toBe(true);
  });

  it.each(['consent', 'document', 'selfie'] as const)('isIdentityConcluded_%s_IsNotConcluded', (step) => {
    expect(isIdentityConcluded(start({ step }))).toBe(false);
  });

  it('isIdentityConcluded_RetryIsNotConcludedAndAPassIs', () => {
    const retry = afterSelfie(start({ step: 'selfie' }), { result: 'retry', guidanceCodes: [], attemptsRemaining: 1, operatorPathOpen: true });
    const passed = afterSelfie(start({ step: 'selfie' }), { result: 'ok', guidanceCodes: [], attemptsRemaining: 1, operatorPathOpen: true });

    expect(isIdentityConcluded(retry)).toBe(false);
    expect(isIdentityConcluded(passed)).toBe(true);
  });
});

describe('classifyIdentityError', () => {
  it('classifyIdentityError_NoAnswerFromTheServer_IsTheNetwork', () => {
    expect(classifyIdentityError(httpError(undefined, undefined, AxiosError.ERR_NETWORK))).toBe('network');
    expect(classifyIdentityError(httpError(undefined, undefined, AxiosError.ECONNABORTED))).toBe('network');
  });

  it('classifyIdentityError_A404_IsAlwaysALinkThatIsNoLongerValid', () => {
    expect(classifyIdentityError(httpError(404))).toBe('link_unavailable');
    expect(classifyIdentityError(httpError(404, { code: 'biometric_consent_required' }))).toBe('link_unavailable');
  });

  it.each([
    [409, 'biometric_consent_required', 'consent_required'],
    [422, 'biometric_consent_version_unknown', 'consent_text_changed'],
    [400, 'biometric_consent_version_required', 'consent_text_changed'],
    [409, 'document_check_required', 'document_required'],
    [400, 'document_photo_required', 'document_photo'],
    [409, 'document_photo_mismatch', 'document_photo'],
    [400, 'document_type_unsupported', 'unsupported'],
    [400, 'selfie_type_unsupported', 'unsupported'],
    [400, 'document_photo_type_unsupported', 'unsupported'],
    [500, 'document_processing_failed', 'processing'],
    [500, 'selfie_processing_failed', 'processing'],
    [429, undefined, 'too_many_requests'],
    [413, undefined, 'too_large'],
    [503, undefined, 'processing'],
    [400, 'something_new', 'failed'],
  ] as const)('classifyIdentityError_%i_%s_Is_%s', (status, code, expected) => {
    expect(classifyIdentityError(httpError(status, code ? { code } : undefined))).toBe(expected);
  });

  it('classifyIdentityError_NotAnErrorOfAxios_IsAGenericFailure', () => {
    expect(classifyIdentityError(new Error('boom'))).toBe('failed');
  });
});

describe('the words of the identity step in the five languages of the page', () => {
  const catalogues = [
    ['it', it_],
    ['en', en],
    ['de', guestDe],
    ['fr', guestFr],
    ['es', guestEs],
  ] as const;

  /** What the API sends in `CaptureGuidanceCodes` (backend `IIdentityVerificationAgent`). */
  const API_CODES = [
    'show_your_face',
    'one_face_only',
    'move_closer',
    'more_light',
    'less_light',
    'hold_still',
    'avoid_glare',
    'show_whole_document',
    'show_document_photo',
    'retake_picture',
    'use_live_camera',
    'retake_selfie',
    'upload_document_again',
    'use_valid_document',
    'tip_remove_glasses',
    'tip_remove_mask',
    // The document on two sides (E22/F01/US01/T02): which side comes next.
    'document_back_needed',
    'document_front_needed',
    'document_not_recognized',
    'active_pose_retry',
  ];

  it('guidanceCodes_AreExactlyTheOnesTheApiSends', () => {
    expect([...GUIDANCE_CODES].sort()).toEqual([...API_CODES].sort());
  });

  it('guidanceKey_ACodeThePageDoesNotKnow_IsTheGenericSentence', () => {
    expect(guidanceKey('a_code_of_the_future')).toBe('checkin.identity.guidance.other');
    expect(guidanceKey('avoid_glare')).toBe('checkin.identity.guidance.avoid_glare');
  });

  it.each(catalogues)('every_guidance_code_problem_camera_and_result_text_exists_in_%s', (_language, catalogue) => {
    const keys = [
      ...GUIDANCE_CODES.map((code) => guidanceKey(code)),
      guidanceKey('a_code_of_the_future'),
      ...IDENTITY_PROBLEMS.map((problem) => problemKey(problem)),
      ...['cameraDenied', 'cameraNotFound', 'cameraUnsupported', 'cameraUnknown', 'cameraTitle', 'noFile', 'retryCamera'].map((reason) => `checkin.biometric.capture.${reason}`),
      'checkin.stepIdentity',
      'checkin.identity.operator.ask',
      'checkin.identity.operator.requested',
      'checkin.identity.documentNotArchived',
      'checkin.identity.result.ok.title',
      'checkin.identity.result.ok.codeLabel',
      'checkin.identity.result.ok.codeEmail',
      'checkin.identity.result.retry.attempts',
      'checkin.identity.result.operator.text',
      'checkin.biometric.consent.accept',
      'checkin.biometric.consent.decline',
      // The texts of the consent come from the registry; the page keeps the words around them.
      ...['draft', 'loadFailed', 'loading', 'retry', 'servedIn', 'unavailable'].map((part) => `checkin.biometric.consent.${part}`),
      // The document on two sides, with the drawing of where the lines of letters are.
      ...['back.fileLabel', 'back.illustration', 'back.instructions', 'back.pick', 'back.pickAgain', 'frontReceived', 'sideProgress', 'instructions'].map(
        (part) => `checkin.identity.document.${part}`,
      ),
      // The door of the property.
      ...['title', 'description', 'modeLabel', 'modeCode', 'modeSurname', 'codeLabel', 'codeHint', 'surnameLabel', 'surnameHint', 'arrivalLabel', 'arrivalHint', 'submit', 'submitting'].map(
        (part) => `checkin.door.${part}`,
      ),
      ...['notFound', 'tooManyRequests', 'network', 'failed', 'codeRequired', 'codeInvalid', 'surnameRequired', 'surnameInvalid', 'arrivalRequired', 'arrivalInvalid'].map(
        (part) => `checkin.door.errors.${part}`,
      ),
    ];

    expect(keys.filter((key) => typeof lookup(catalogue, key) !== 'string' || String(lookup(catalogue, key)).trim() === '')).toEqual([]);
  });

  it('theTextsTheRegistryServes_AreNotInTheCataloguesAnyMore_TheyHaveOneSource', () => {
    // The wording of the consent is the registry's (E22/F01/US02/T02): a copy in the page would drift from the version that is recorded.
    const removed = ['description', 'documentKept', 'optional', 'optionalTitle', 'purpose', 'purposeTitle'].map((part) => `checkin.biometric.consent.${part}`);

    for (const [, catalogue] of catalogues) expect(removed.filter((key) => lookup(catalogue, key) !== undefined)).toEqual([]);
  });

  it('theItalianButtonToAskAPerson_IsTheOneOfTheBrief', () => {
    expect(lookup(it_, 'checkin.identity.operator.ask')).toBe('Chiedi la verifica di un operatore');
    expect(lookup(it_, 'checkin.identity.documentNotArchived')).toBe('Il documento non sarà archiviato.');
  });
});

describe('the document on two sides (E22/F02/US01/T01)', () => {
  const answer = (overrides: Partial<Parameters<typeof afterDocument>[1]> = {}) => ({
    success: true,
    acceptable: false,
    guidanceCodes: [] as string[],
    documentStored: true,
    documentNotArchived: false,
    ...overrides,
  });
  const backNeeded = answer({ guidanceCodes: ['document_back_needed'] });
  const complete = answer({ acceptable: true });

  it('progressFromState_NothingSentYet_AsksForTheFrontFirst', () => {
    const progress = start({ step: 'document' });

    expect(progress.documentSideNeeded).toBe('front');
    expect(progress.documentTwoSided).toBe(false);
    expect(progress.documentSidesTaken).toEqual([]);
  });

  it('progressFromState_TheServerHasTheFrontAndWantsTheBack_AsksForTheBackWithoutTheFrontAgain', () => {
    const progress = start({ step: 'document', documentSides: ['front'], documentSideNeeded: 'back' });

    expect(progress.documentSideNeeded).toBe('back');
    expect(progress.documentTwoSided).toBe(true);
    expect(progress.documentSidesTaken).toEqual(['front']);
  });

  it('progressFromState_APassportSentAsTheFront_IsOneSidedAndGoesOn', () => {
    const progress = start({ step: 'selfie', documentSides: ['front'] });

    expect(progress.documentTwoSided).toBe(false);
    expect(progress.stage).toBe('selfie');
  });

  it('afterDocument_TheFrontIsGoodAndTheBackIsNeeded_AsksForTheBackAndIsNotARefusal', () => {
    const next = afterDocument(start({ step: 'document' }), backNeeded, 'front');

    expect(next.stage).toBe('document');
    expect(next.documentSideNeeded).toBe('back');
    expect(next.documentTwoSided).toBe(true);
    expect(next.documentSidesTaken).toEqual(['front']);
    // The photo that was taken was good: the page does not say it was not.
    expect(next.documentRefused).toBe(false);
  });

  it('afterDocument_TheBackCompletesTheDocument_GoesToTheSelfie', () => {
    const afterFront = afterDocument(start({ step: 'document' }), backNeeded, 'front');
    const next = afterDocument(afterFront, complete, 'back');

    expect(next.stage).toBe('selfie');
    expect(next.documentSidesTaken).toEqual(['front', 'back']);
    expect(next.guidanceCodes).toEqual([]);
  });

  it('afterDocument_APassportAsTheFront_NeedsNoBackAndGoesToTheSelfie', () => {
    const next = afterDocument(start({ step: 'document' }), complete, 'front');

    expect(next.stage).toBe('selfie');
    expect(next.documentTwoSided).toBe(false);
  });

  it('afterDocument_TheBackIsNotGoodEnough_AsksForTheBackAgainWithTheGuidance', () => {
    const afterFront = afterDocument(start({ step: 'document' }), backNeeded, 'front');
    const next = afterDocument(afterFront, answer({ guidanceCodes: ['avoid_glare'] }), 'back');

    expect(next.stage).toBe('document');
    expect(next.documentSideNeeded).toBe('back');
    expect(next.documentRefused).toBe(true);
    expect(next.guidanceCodes).toEqual(['avoid_glare']);
  });

  it('afterDocument_TheFrontIsMissingAfterTheBack_AsksForTheFront', () => {
    const next = afterDocument(start({ step: 'document', documentSideNeeded: 'back' }), answer({ guidanceCodes: ['document_front_needed'] }), 'back');

    expect(next.documentSideNeeded).toBe('front');
    expect(next.documentRefused).toBe(false);
  });

  it('afterDocument_TicinoWithTheServerSatisfiedAfterTheFrontOnly_StillAsksForTheBackBecauseBothComeAgainWithTheSelfie', () => {
    // After a reload in Ticino the server has both sides, so it is satisfied by the front alone; the selfie of a property that keeps nothing carries both pictures.
    const reloaded = start({ step: 'selfie', documentNotArchived: true, documentSides: ['front', 'back'] });
    expect(reloaded.stage).toBe('document');
    expect(reloaded.documentTwoSided).toBe(true);

    const afterFront = afterDocument(reloaded, answer({ acceptable: true, documentNotArchived: true }), 'front');
    expect(afterFront.stage).toBe('document');
    expect(afterFront.documentSideNeeded).toBe('back');

    const afterBack = afterDocument(afterFront, answer({ acceptable: true, documentNotArchived: true }), 'back');
    expect(afterBack.stage).toBe('selfie');
    expect(afterBack.documentSidesTaken).toEqual(['front', 'back']);
  });

  it('afterRetake_TheDocumentAgain_StartsFromTheFaceSide', () => {
    const progress = afterDocument(afterDocument(start({ step: 'document' }), backNeeded, 'front'), complete, 'back');
    const retry = afterSelfie(progress, { result: 'retry', guidanceCodes: ['upload_document_again'], attemptsRemaining: 1, operatorPathOpen: true });

    expect(afterRetake(retry).documentSideNeeded).toBe('front');
    expect(afterRetake(retry).stage).toBe('document');
  });

  it('afterProblem_ThePicturesAreNotTheOnesTheServerRead_AsksForTheDocumentAgainFromTheFrontWithNothingHeld', () => {
    const progress = afterDocument(afterDocument(start({ step: 'document' }), backNeeded, 'front'), complete, 'back');
    const next = afterProblem(progress, 'document_photo');

    expect(next.stage).toBe('document');
    expect(next.documentSideNeeded).toBe('front');
    expect(next.documentSidesTaken).toEqual([]);
  });

  it('afterSelfie_APassOrAPerson_LetsGoOfTheSidesTheStepHeld', () => {
    const progress = afterDocument(afterDocument(start({ step: 'document' }), backNeeded, 'front'), complete, 'back');

    expect(afterSelfie(progress, { result: 'ok', guidanceCodes: [], attemptsRemaining: 2, operatorPathOpen: true }).documentSidesTaken).toEqual([]);
    expect(afterSelfie(progress, { result: 'operator', guidanceCodes: [], attemptsRemaining: 0, operatorPathOpen: true }).documentSidesTaken).toEqual([]);
    expect(afterSelfie(progress, { result: 'retry', guidanceCodes: ['hold_still'], attemptsRemaining: 1, operatorPathOpen: true }).documentSidesTaken).toEqual(['front', 'back']);
  });

  it.each([
    [['document_back_needed'], 'back'],
    [['avoid_glare', 'document_front_needed'], 'front'],
    [['avoid_glare'], null],
    [[], null],
  ] as const)('sideAskedBy_%j_Is_%s', (codes, side) => {
    expect(sideAskedBy(codes)).toBe(side);
  });

  it('legalTextOf_TheRegistryServedNoConsent_IsNull_AndAVersionlessTextIsNeverOne', () => {
    const texts = [
      { kind: 'ticino-notice', version: 'checkin-ticino-2026-11', language: 'it', isDraft: false, contentHtml: '<p>x</p>' },
      { kind: 'biometric-consent', version: ' ', language: 'it', isDraft: false, contentHtml: '<p>y</p>' },
    ];

    expect(legalTextOf(texts, 'biometric-consent')).toBeNull();
    expect(legalTextOf(texts, 'ticino-notice')?.version).toBe('checkin-ticino-2026-11');
    expect(legalTextOf(undefined, 'biometric-consent')).toBeNull();
  });
});
