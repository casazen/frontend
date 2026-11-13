import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, isTransientRequestError } from '@/lib/api-errors';
import type {
  BiometricConsentResponse,
  IdentityDocumentResponse,
  IdentityOperatorResponse,
  IdentitySelfieResponse,
  IdentityVerificationState,
} from '@/types/public-checkin.types';

/**
 * The version of the text of the biometric consent the guest reads (ADR-013-R9): it is sent with a consent and kept with its time, so the text the
 * guest agreed to can be told. Change it with the text (`checkin.biometric.consent.*`), at most 50 characters.
 */
export const BIOMETRIC_CONSENT_VERSION = 'checkin-biometric-2026-11';

/**
 * The capture guidance codes of the API (`CaptureGuidanceCodes`): what to change in a photo, and the static tips of the selfie. Each has its words in
 * every language of the page (`checkin.identity.guidance.*`); a code the page does not know is shown with the generic sentence.
 */
export const GUIDANCE_CODES = [
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
] as const;

/** The key of the words of a guidance code, or of the generic sentence for a code that is not known. */
export function guidanceKey(code: string): string {
  return (GUIDANCE_CODES as readonly string[]).includes(code) ? `checkin.identity.guidance.${code}` : 'checkin.identity.guidance.other';
}

/** The codes that ask for the document to be photographed again, not the selfie. */
const DOCUMENT_GUIDANCE: ReadonlySet<string> = new Set(['upload_document_again', 'use_valid_document']);

/** What the guest takes again after a `retry`: the document when the guidance says so, otherwise the selfie. */
export function retakeTargetOf(codes: readonly string[]): 'document' | 'selfie' {
  return codes.some((code) => DOCUMENT_GUIDANCE.has(code)) ? 'document' : 'selfie';
}

/** Where the guest is in the identity step. */
export type IdentityStage = 'consent' | 'document' | 'selfie' | 'retry' | 'operator' | 'done';

/**
 * Everything the identity step knows, in memory for the life of the page and never in a storage, a cache or a log: the stage, whether a person
 * was asked, the attempts left, the guidance of the last answer and the lock code of a pass.
 */
export interface IdentityProgress {
  stage: IdentityStage;
  /** A person was asked to verify (the API said so, or the guest has just asked). */
  operatorRequested: boolean;
  /** The face check is offered for this stay: not switched off for the organization, not a minor, not refused. */
  biometricOffered: boolean;
  attemptsRemaining: number;
  /** The property keeps no document (Ticino): the photo of it comes again with the selfie. */
  documentNotArchived: boolean;
  /** What to change after the last document or selfie, as codes. */
  guidanceCodes: readonly string[];
  /** The last photo of the document could not be compared: the guest takes it again (with the guidance, when the API gave any). */
  documentRefused: boolean;
  /** The lock code, only after an `ok`; `null` for any other answer and for a property with none. */
  lockCode: string | null;
}

function stageOfState(state: IdentityVerificationState): IdentityStage {
  switch (state.step) {
    case 'done':
      return 'done';
    case 'operator':
      return 'operator';
    case 'consent':
      return 'consent';
    case 'document':
      return 'document';
    case 'selfie':
      // In Ticino nothing of the document is kept, and the page that was closed no longer has its photo: the selfie asks for it again.
      return state.documentNotArchived ? 'document' : 'selfie';
  }
}

/** Where the identity step starts: what the API says about the session (the page opened, or opened again through the same link). */
export function progressFromState(state: IdentityVerificationState): IdentityProgress {
  return {
    stage: stageOfState(state),
    operatorRequested: state.operatorRequested,
    biometricOffered: state.biometricOffered,
    attemptsRemaining: state.attemptsRemaining,
    documentNotArchived: state.documentNotArchived,
    guidanceCodes: [],
    documentRefused: false,
    lockCode: null,
  };
}

/** After the answer to the consent: a consent leads to the document, anything else is the way to a person. */
export function afterConsent(progress: IdentityProgress, response: BiometricConsentResponse): IdentityProgress {
  const { state } = response;
  if (response.result === 'consent_recorded') {
    // The photo of the document is kept only after the consent: it is taken now, whatever was read before.
    return {
      ...progress,
      stage: 'document',
      biometricOffered: state.biometricOffered,
      attemptsRemaining: state.attemptsRemaining,
      documentNotArchived: state.documentNotArchived,
      guidanceCodes: [],
      documentRefused: false,
    };
  }
  return {
    ...progress,
    stage: 'operator',
    operatorRequested: state.operatorRequested,
    biometricOffered: state.biometricOffered,
    guidanceCodes: [],
    lockCode: null,
  };
}

/** After the photo of the document: a photo that can be compared leads to the selfie, otherwise the guest takes it again with the guidance. */
export function afterDocument(progress: IdentityProgress, response: IdentityDocumentResponse): IdentityProgress {
  return {
    ...progress,
    stage: response.acceptable ? 'selfie' : 'document',
    documentNotArchived: progress.documentNotArchived || response.documentNotArchived,
    guidanceCodes: response.acceptable ? [] : response.guidanceCodes,
    documentRefused: !response.acceptable,
  };
}

/** After the selfie: the lock code comes only with an `ok`; a retry says what to change; a person verifies otherwise. */
export function afterSelfie(progress: IdentityProgress, response: IdentitySelfieResponse): IdentityProgress {
  if (response.result === 'ok') {
    const code = typeof response.lockCode === 'string' ? response.lockCode.trim() : '';
    return { ...progress, stage: 'done', attemptsRemaining: response.attemptsRemaining, guidanceCodes: [], documentRefused: false, lockCode: code === '' ? null : code };
  }
  if (response.result === 'retry') {
    return { ...progress, stage: 'retry', attemptsRemaining: response.attemptsRemaining, guidanceCodes: response.guidanceCodes, lockCode: null };
  }
  return {
    ...progress,
    stage: 'operator',
    operatorRequested: true,
    attemptsRemaining: response.attemptsRemaining,
    guidanceCodes: [],
    documentRefused: false,
    lockCode: null,
  };
}

/** After the guest asked for a person: the operators are told. A verification that had already passed stays passed. */
export function afterOperatorRequest(progress: IdentityProgress, response: IdentityOperatorResponse): IdentityProgress {
  const { state } = response;
  if (state.step === 'done') return { ...progress, stage: 'done' };
  return { ...progress, stage: 'operator', operatorRequested: true, biometricOffered: state.biometricOffered, guidanceCodes: [], documentRefused: false };
}

/** The guest takes again what the guidance asked for (the document or the selfie), from the screen of a `retry`. */
export function afterRetake(progress: IdentityProgress): IdentityProgress {
  return { ...progress, stage: retakeTargetOf(progress.guidanceCodes), guidanceCodes: [], documentRefused: false, lockCode: null };
}

/** What a refused call changes: the step the API asks for first. Anything else leaves the guest where they are, with what they have. */
export function afterProblem(progress: IdentityProgress, problem: IdentityProblem): IdentityProgress {
  if (problem === 'consent_required') return { ...progress, stage: 'consent', guidanceCodes: [], documentRefused: false };
  if (problem === 'document_required' || problem === 'document_photo') return { ...progress, stage: 'document', guidanceCodes: [], documentRefused: false };
  return progress;
}

/** The identity step is over for the guest: it passed, or a person was asked and has it. The page goes on only then (the way to a person is always open). */
export function isIdentityConcluded(progress: IdentityProgress | null): boolean {
  if (progress === null) return true;
  return progress.stage === 'done' || (progress.stage === 'operator' && progress.operatorRequested);
}

/** Why a call of the identity step failed, in the terms the page has words for (`checkin.identity.problem.*`). */
export const IDENTITY_PROBLEMS = [
  'network',
  'too_many_requests',
  'link_unavailable',
  'too_large',
  'unsupported',
  'consent_required',
  'document_required',
  'document_photo',
  'processing',
  'failed',
] as const;
export type IdentityProblem = (typeof IDENTITY_PROBLEMS)[number];

/**
 * A failure of a call reduced to the problem the guest is told about. Only the status and the code of the answer are read: nothing of the request
 * (which holds a photo) is kept, and a 404 is always «this link is no longer valid», whatever the page still has in memory.
 */
export function classifyIdentityError(error: unknown): IdentityProblem {
  const status = getHttpStatus(error);
  if (status === undefined) return isTransientRequestError(error) ? 'network' : 'failed';

  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  if (status === 404) return 'link_unavailable';
  if (status === 429) return 'too_many_requests';
  if (status === 413) return 'too_large';
  if (code === 'biometric_consent_required') return 'consent_required';
  if (code === 'document_check_required') return 'document_required';
  if (code === 'document_photo_required' || code === 'document_photo_mismatch') return 'document_photo';
  if (code === 'document_type_unsupported' || code === 'selfie_type_unsupported' || code === 'document_photo_type_unsupported') return 'unsupported';
  if (code === 'document_processing_failed' || code === 'selfie_processing_failed') return 'processing';
  return status >= 500 ? 'processing' : 'failed';
}

/** The key of the sentence that tells the guest about a problem. */
export function problemKey(problem: IdentityProblem): string {
  return `checkin.identity.problem.${problem}`;
}
