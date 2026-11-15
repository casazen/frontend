import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, isTransientRequestError } from '@/lib/api-errors';
import type {
  BiometricConsentResponse,
  CheckInLegalText,
  CheckInLegalTextKind,
  DocumentSide,
  IdentityDocumentResponse,
  IdentityOperatorResponse,
  IdentitySelfieResponse,
  IdentityVerificationState,
} from '@/types/public-checkin.types';

/**
 * The kinds of legal text the registry of the identity step serves (API `CheckInLegalTextKinds`): the consent to the face check, whose `version` the consent posts back, and
 * the notice of a property that keeps no document (Ticino). The text of each is the registry's, never the page's (E22/F01/US02/T02).
 */
export const BIOMETRIC_CONSENT_KIND: CheckInLegalTextKind = 'biometric-consent';
export const TICINO_NOTICE_KIND: CheckInLegalTextKind = 'ticino-notice';

/** The text of `kind` among the ones the registry served, or `null` when it served none (in production, a text that is not approved yet is not served). */
export function legalTextOf(texts: readonly CheckInLegalText[] | undefined, kind: CheckInLegalTextKind): CheckInLegalText | null {
  return texts?.find((text) => text.kind === kind && text.version.trim() !== '') ?? null;
}

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
  'document_back_needed',
  'document_front_needed',
] as const;

/** The key of the words of a guidance code, or of the generic sentence for a code that is not known. */
export function guidanceKey(code: string): string {
  return (GUIDANCE_CODES as readonly string[]).includes(code) ? `checkin.identity.guidance.${code}` : 'checkin.identity.guidance.other';
}

/**
 * The codes that only say which side of the document comes next: the picture before it was good, the document has two sides (the Italian electronic identity card has the face on the
 * front and the lines of letters on the back). They are not a refusal of the photo that was taken.
 */
const SIDE_GUIDANCE: Readonly<Record<string, DocumentSide>> = { document_back_needed: 'back', document_front_needed: 'front' };

/** The side a guidance asks for next, or `null` when it asks for none. */
export function sideAskedBy(codes: readonly string[]): DocumentSide | null {
  for (const code of codes) {
    const side = SIDE_GUIDANCE[code];
    if (side) return side;
  }
  return null;
}

/** The codes that ask for the document to be photographed again, not the selfie. */
const DOCUMENT_GUIDANCE: ReadonlySet<string> = new Set(['upload_document_again', 'use_valid_document', ...Object.keys(SIDE_GUIDANCE)]);

/** What the guest takes again after a `retry`: the document when the guidance says so, otherwise the selfie. */
export function retakeTargetOf(codes: readonly string[]): 'document' | 'selfie' {
  return codes.some((code) => DOCUMENT_GUIDANCE.has(code)) ? 'document' : 'selfie';
}

/** Where the guest is in the identity step. */
export type IdentityStage = 'consent' | 'document' | 'selfie' | 'retry' | 'operator' | 'done';

/**
 * Everything the identity step knows, in memory for the life of the page and never in a storage, a cache or a log: the stage, whether a person
 * was asked, the attempts left, the guidance of the last answer and the lock code of a pass. Never a picture: only which sides of the document were sent.
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
  /** The side of the document the next photo is of: the front first; the back when the answer said the document has two sides and the front was good. */
  documentSideNeeded: DocumentSide;
  /** The document has two sides (a card with the face on the front and the lines of letters on the back): the API said so, or the page was opened again with both on file. */
  documentTwoSided: boolean;
  /** The sides sent from this page since the step began (a property that keeps no document gets them again with the selfie, so the page holds those pictures; the list says which, it is no picture). */
  documentSidesTaken: readonly DocumentSide[];
  /** The lock code, only after an `ok`; `null` for any other answer and for a property with none. */
  lockCode: string | null;
  /** Why an `ok` came with no lock code although the property has one (`LOCK_CODE_HELD_TOURIST_TAX`): the code is held back until the tourist tax is paid. */
  lockCodeHeld?: string | null;
}

/** `lockCodeHeld` of the selfie answer while the organization asks for the tourist tax before the lock code and the stay still owes it (E25/F01/US01/T01). */
export const LOCK_CODE_HELD_TOURIST_TAX = 'tourist_tax_due';

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

/** The sides of the document the server holds a read of, without the `single` of a document of one picture. */
function sidesOnFile(state: IdentityVerificationState): DocumentSide[] {
  const sides = state.documentSides ?? [];
  return (['front', 'back'] as const).filter((side) => sides.includes(side));
}

/** The document has two sides: a picture of the back is on file, or the server says a side is still missing (only a document of two sides misses one). */
function isTwoSided(state: IdentityVerificationState): boolean {
  return sidesOnFile(state).includes('back') || (state.documentSideNeeded ?? null) !== null;
}

/** What the document step starts from, given what the server says: the side it still wants (the front, when it says none), and the sides it has. */
function documentFromState(state: IdentityVerificationState): Pick<IdentityProgress, 'documentSideNeeded' | 'documentTwoSided' | 'documentSidesTaken'> {
  return {
    documentSideNeeded: state.documentSideNeeded ?? 'front',
    documentTwoSided: isTwoSided(state),
    // A property that keeps no document has nothing of it on file, and the page that was closed holds no picture: both sides come again.
    documentSidesTaken: state.documentNotArchived ? [] : sidesOnFile(state),
  };
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
    ...documentFromState(state),
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
      ...documentFromState(state),
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

/** `sides` with `side` in it, once, in the order front then back. */
function withSide(sides: readonly DocumentSide[], side: DocumentSide): DocumentSide[] {
  return (['front', 'back'] as const).filter((candidate) => candidate === side || sides.includes(candidate));
}

/**
 * After the photo of one side of the document (`sent`, the front when the page does not know better): a photo that can be compared leads to the selfie, otherwise the guest takes
 * it again with the guidance, or the other side when the answer asks for it (`document_back_needed`: the front was good and the card has its lines of letters on the back, so that is
 * not a refusal of the photo that was taken). A property that keeps no document gets the pictures again with the selfie, so the selfie waits until the page holds every side of the document.
 */
export function afterDocument(progress: IdentityProgress, response: IdentityDocumentResponse, sent: DocumentSide = progress.documentSideNeeded): IdentityProgress {
  const codes = response.guidanceCodes;
  const asked = sideAskedBy(codes);
  const twoSided = progress.documentTwoSided || asked !== null;
  const taken = withSide(progress.documentSidesTaken, sent);
  const notArchived = progress.documentNotArchived || response.documentNotArchived;

  let next: DocumentSide | null = null;
  if (!response.acceptable) {
    next = asked ?? sent;
  } else if (notArchived && twoSided) {
    next = (['front', 'back'] as const).find((side) => !taken.includes(side)) ?? null;
  }

  return {
    ...progress,
    stage: next === null ? 'selfie' : 'document',
    documentNotArchived: notArchived,
    documentTwoSided: twoSided,
    documentSidesTaken: taken,
    documentSideNeeded: next ?? progress.documentSideNeeded,
    guidanceCodes: response.acceptable ? [] : codes,
    documentRefused: !response.acceptable && (codes.length === 0 || codes.some((code) => !(code in SIDE_GUIDANCE))),
  };
}

/** After the selfie: the lock code comes only with an `ok` (or why it is held back); a retry says what to change; a person verifies otherwise. */
export function afterSelfie(progress: IdentityProgress, response: IdentitySelfieResponse): IdentityProgress {
  if (response.result === 'ok') {
    const code = typeof response.lockCode === 'string' ? response.lockCode.trim() : '';
    const held = typeof response.lockCodeHeld === 'string' ? response.lockCodeHeld.trim() : '';
    return {
      ...progress,
      stage: 'done',
      attemptsRemaining: response.attemptsRemaining,
      guidanceCodes: [],
      documentRefused: false,
      documentSidesTaken: [],
      lockCode: code === '' ? null : code,
      lockCodeHeld: code === '' && held !== '' ? held : null,
    };
  }
  if (response.result === 'retry') {
    return { ...progress, stage: 'retry', attemptsRemaining: response.attemptsRemaining, guidanceCodes: response.guidanceCodes, lockCode: null, lockCodeHeld: null };
  }
  return {
    ...progress,
    stage: 'operator',
    operatorRequested: true,
    attemptsRemaining: response.attemptsRemaining,
    guidanceCodes: [],
    documentRefused: false,
    documentSidesTaken: [],
    lockCode: null,
    lockCodeHeld: null,
  };
}

/** After the guest asked for a person: the operators are told. A verification that had already passed stays passed. */
export function afterOperatorRequest(progress: IdentityProgress, response: IdentityOperatorResponse): IdentityProgress {
  const { state } = response;
  if (state.step === 'done') return { ...progress, stage: 'done' };
  return {
    ...progress,
    stage: 'operator',
    operatorRequested: true,
    biometricOffered: state.biometricOffered,
    guidanceCodes: [],
    documentRefused: false,
    documentSidesTaken: [],
  };
}

/**
 * The guest takes again what the guidance asked for (the document or the selfie), from the screen of a `retry`. The document starts again from its face side; what the server already
 * has of the other side stays with the server.
 */
export function afterRetake(progress: IdentityProgress): IdentityProgress {
  const target = retakeTargetOf(progress.guidanceCodes);
  return {
    ...progress,
    stage: target,
    guidanceCodes: [],
    documentRefused: false,
    lockCode: null,
    lockCodeHeld: null,
    ...(target === 'document' ? { documentSideNeeded: 'front' as const } : {}),
  };
}

/** What a refused call changes: the step the API asks for first. Anything else leaves the guest where they are, with what they have. */
export function afterProblem(progress: IdentityProgress, problem: IdentityProblem): IdentityProgress {
  if (problem === 'consent_required' || problem === 'consent_text_changed') return { ...progress, stage: 'consent', guidanceCodes: [], documentRefused: false };
  if (problem === 'document_required' || problem === 'document_photo') {
    // The pictures the page held are no longer the ones the server has read (or it has none): the document comes again from its face side.
    return { ...progress, stage: 'document', guidanceCodes: [], documentRefused: false, documentSideNeeded: 'front', documentSidesTaken: [] };
  }
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
  'consent_text_changed',
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
  // The text the guest read is no longer the one the registry serves (a new version was published), or none was sent: the guest reads it again before answering.
  if (code === 'biometric_consent_version_unknown' || code === 'biometric_consent_version_required') return 'consent_text_changed';
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
