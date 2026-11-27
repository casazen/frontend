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
  IdentityVerificationResultKind,
  IdentityVerificationState,
  IdentityVerificationStep,
  PresenceChallenge,
  PresenceMove,
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
  'document_not_recognized',
  'active_pose_retry',
  // The targeted codes of the document step of the self-hosted flow (E71/F01/US03/T01, NF-189): what is wrong with the photo of a side, one code each.
  'document_not_found',
  'document_edges_not_visible',
  'document_layout_mismatch',
  'document_orientation',
  'document_portrait_missing',
  'document_side_duplicate',
  'document_wrong_side',
  'document_format_unsupported',
  'document_glare',
  'document_blur',
  'document_unreadable',
] as const;

/**
 * The two codes after which the verification is no longer in the hands of the guest: the server has already closed it with a person (a document of a format it does not know, a side
 * refused as many times as the policy allows). Nothing is asked of the guest any more: the page shows the way of a person, not another capture.
 */
export const ASSISTED_GUIDANCE_CODES = ['document_format_unsupported', 'document_unreadable'] as const;

/** The first of the codes that end the document step with a person, or `null` when none of them is in `codes`. */
export function assistedReasonOf(codes: readonly string[]): string | null {
  return codes.find((code) => (ASSISTED_GUIDANCE_CODES as readonly string[]).includes(code)) ?? null;
}

/**
 * The codes of what to change in the sequence of the presence (E72/F02/US01/T01, NF-192): the recording was too short, its timing did not hold, its quality was not enough, it did not show one face, or the moves of the
 * challenge were not followed. They come in the `guidance` of the answer of the presence, each with its words in every language of the page (`checkin.identity.guidance.*`); a code of the family the page does not
 * know is shown with the generic sentence of the presence. Kept apart from {@link GUIDANCE_CODES}, which are the codes of the capture checks of the document and of the legacy selfie.
 */
export const PRESENCE_GUIDANCE_CODES = [
  'presence_too_short',
  'presence_timing',
  'presence_quality',
  'presence_single_face',
  'presence_challenge_not_followed',
] as const;

/** The key of the words of a code of the guidance of the presence: the code's own, the one of a capture check when the server sends one of those, and otherwise the generic sentence of the presence. */
export function presenceGuidanceKey(code: string): string {
  if ((PRESENCE_GUIDANCE_CODES as readonly string[]).includes(code)) return `checkin.identity.guidance.${code}`;
  if ((GUIDANCE_CODES as readonly string[]).includes(code)) return guidanceKey(code);
  return 'checkin.identity.guidance.presence_again';
}

/** The older code of the capture checks that says what a targeted code of the document step says (a reflection, a blurred picture): the server sends both when both checks find it. */
const OLDER_TWIN: Readonly<Record<string, string>> = { document_glare: 'avoid_glare', document_blur: 'hold_still' };

/**
 * The codes of a refusal as the page lists them: a targeted code and the older code that gives the same advice are one line, the targeted one (the server sends the targeted codes first and then the
 * codes of the capture checks of before). An older code on its own is listed as it always was, and so is every other.
 */
export function listedGuidance(codes: readonly string[]): string[] {
  return codes.filter((code) => !Object.entries(OLDER_TWIN).some(([targeted, older]) => older === code && codes.includes(targeted)));
}

/**
 * The key of the words of a guidance code, or of the generic sentence for a code that is not known. A photo that shows the other side than the one asked (`document_wrong_side`) says which side to
 * photograph when the page knows it (`asked`): «this is the back: photograph the front», or the other way round; otherwise it says it in general.
 */
export function guidanceKey(code: string, asked?: DocumentSide | null): string {
  if (code === 'document_wrong_side' && asked) return `checkin.identity.guidance.document_wrong_side_${asked}`;
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

/** The codes that ask for the document to be photographed again, not the selfie: the targeted codes of the document step (`document_*`) are all about the photo of a side. */
const DOCUMENT_GUIDANCE: ReadonlySet<string> = new Set([
  'upload_document_again',
  'use_valid_document',
  ...Object.keys(SIDE_GUIDANCE),
  ...GUIDANCE_CODES.filter((code) => code.startsWith('document_') && code !== 'document_not_recognized'),
]);

/**
 * What the guest takes again after a `retry`: the document when the guidance says so; otherwise the recording of the presence on a self-hosted verification (`selfHosted`, or when the guidance is the presence's own), where
 * the selfie does not exist; otherwise the selfie.
 */
export function retakeTargetOf(codes: readonly string[], selfHosted = false): 'document' | 'selfie' | 'presence' {
  if (codes.some((code) => DOCUMENT_GUIDANCE.has(code))) return 'document';
  return selfHosted || codes.some((code) => (PRESENCE_GUIDANCE_CODES as readonly string[]).includes(code)) ? 'presence' : 'selfie';
}

/**
 * Where the guest is in the identity step. `presence` is the recording of a self-hosted verification (E72/F02/US01/T01): the moves of a challenge, followed in front of the camera. `unsupported` is a step of the API this
 * page has no screen for (`presence` on a state that does not say `selfHosted`, or a step of the future): the page shows the way to a person instead of a blank screen.
 */
export type IdentityStage = 'consent' | 'document' | 'selfie' | 'presence' | 'retry' | 'operator' | 'done' | 'unsupported';

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
  /**
   * The session follows the self-hosted flow (E70/F03/US01/T01): the page opens the step with the text it shows, offers the two ways to be verified side by side and keeps the way to a person on every
   * step. False on the legacy path, where none of that is there and the page is the one it always was.
   */
  selfHosted: boolean;
  /** The verification was already closed when the page learnt where it stood (it was opened again, or a 409 `identity_already_closed` said so): the result says it was already over (E72/F02/US01/T02). */
  closed: boolean;
}

/** `lockCodeHeld` of the selfie answer while the organization asks for the tourist tax before the lock code and the stay still owes it (E25/F01/US01/T01). */
export const LOCK_CODE_HELD_TOURIST_TAX = 'tourist_tax_due';

/** The verification is closed (self-hosted flow): no capture is offered any more, and the guest sees where it ended. */
function isClosed(state: IdentityVerificationState): boolean {
  return state.closed === true;
}

function stageOfState(state: IdentityVerificationState): IdentityStage {
  // A closed verification is over, whatever step the state still names: an approval is a pass, anything else is a person who has it. Nothing here says «passed» without the server saying it.
  if (isClosed(state)) return state.outcome === 'ok' ? 'done' : 'operator';

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
    case 'presence':
      // The step of the self-hosted flow that takes the place of the selfie (E72/F02/US01/T01): the recording is asked for the same way, with the photo of the document again in Ticino. A state that does not say
      // `selfHosted` has no screen for it (nothing of the legacy path changes): the way to a person.
      if (state.selfHosted !== true) return 'unsupported';
      return state.documentNotArchived ? 'document' : 'presence';
    default:
      // A step the page does not know yet: not a blank screen, the way to a person.
      return 'unsupported';
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
    selfHosted: state.selfHosted === true,
    closed: isClosed(state),
    ...documentFromState(state),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resultKindOf(value: unknown): IdentityVerificationResultKind | null {
  return value === 'ok' || value === 'retry' || value === 'operator' ? value : null;
}

/**
 * The state of the verification read from a body that came off the network (the answer of the opening, the body of a 409), or `null` when it is not one (it has no `step`). Each member is read for what it is: a flag
 * that is not `true` is `false` (the prudent value: nothing offered, nothing approved), a text that is not a text is `null`, and a step the page does not know is kept as it is.
 */
export function identityStateOf(value: unknown): IdentityVerificationState | null {
  if (!isRecord(value) || typeof value.step !== 'string') return null;
  const flag = (member: string) => value[member] === true;
  const text = (member: string) => (typeof value[member] === 'string' ? (value[member] as string) : null);
  const count = (member: string) => (typeof value[member] === 'number' && Number.isFinite(value[member]) ? (value[member] as number) : 0);
  const side = value.documentSideNeeded;
  const choice = value.choice;

  return {
    step: value.step as IdentityVerificationStep,
    result: resultKindOf(value.result),
    biometricOffered: flag('biometricOffered'),
    consentRecorded: flag('consentRecorded'),
    consentRefused: flag('consentRefused'),
    documentChecked: flag('documentChecked'),
    attemptsRemaining: count('attemptsRemaining'),
    operatorRequested: flag('operatorRequested'),
    operatorPathOpen: value.operatorPathOpen !== false,
    documentNotArchived: flag('documentNotArchived'),
    verifyingGuestPosition: count('verifyingGuestPosition'),
    documentSides: Array.isArray(value.documentSides) ? value.documentSides.filter((entry): entry is string => typeof entry === 'string') : [],
    documentSideNeeded: side === 'front' || side === 'back' ? side : null,
    selfHosted: flag('selfHosted'),
    opened: flag('opened'),
    noticeVersion: text('noticeVersion'),
    choice: choice === 'automatic' || choice === 'assisted' ? choice : null,
    formatId: text('formatId'),
    guidedRetryAvailable: flag('guidedRetryAvailable'),
    closed: flag('closed'),
    outcome: resultKindOf(value.outcome),
  };
}

/** The `code` of the 409 that refuses a step because the verification is over (API `IdentityApiErrors.IdentityAlreadyClosed`). */
const IDENTITY_ALREADY_CLOSED = 'identity_already_closed';

/**
 * A verification that is closed with a person: what the page shows when the 409 of the document, the selfie, the request for a person or the opening says it is closed and carries no state it can read (those answers always carry
 * one: the page never meets this case with the server of today). It never says «passed». The calls of the presence do not use it: see {@link closedAnswerOf}.
 */
const CLOSED_WITH_A_PERSON: IdentityVerificationState = {
  step: 'operator',
  result: 'operator',
  biometricOffered: false,
  consentRecorded: false,
  consentRefused: false,
  documentChecked: false,
  attemptsRemaining: 0,
  operatorRequested: true,
  operatorPathOpen: true,
  documentNotArchived: false,
  verifyingGuestPosition: 0,
  selfHosted: true,
  closed: true,
  outcome: 'operator',
};

/**
 * The 409 `identity_already_closed`, when `error` is one: the verification is over (a document, a selfie or a presence step sent after it was closed, from another tab or after a reload). `state` is the state the body
 * carries when it carries one that says the verification is closed, and `null` when it carries none the page can read. `null` itself for any other failure.
 *
 * Not every 409 of this kind carries the state: the one of the challenge of the presence (`presence-challenge`) is the bare problem (`code` and nothing else), while the document, the selfie, the presence itself and the
 * opening send it. The page never deduces how a verification ended from a body that says only that it ended (it may have passed in another tab): the calls of the presence read the state of the link instead.
 */
export function closedAnswerOf(error: unknown): { state: IdentityVerificationState | null } | null {
  if (!isAxiosError(error) || error.response?.status !== 409) return null;
  const body: unknown = error.response.data;
  if (getProblemCode(body) !== IDENTITY_ALREADY_CLOSED) return null;

  const state = identityStateOf(isRecord(body) ? body.state : undefined);
  return { state: state !== null && state.closed === true ? state : null };
}

/**
 * The state the verification ended in, when `error` is the 409 `identity_already_closed` of a call whose answer always carries the state (the document, the selfie, the request for a person and the opening): the body carries
 * the `state`, and that is what the page shows. Where it carries none the page can read, it is taken as a verification that ended with a person, and never as a pass. `null` for any other failure. The calls of the presence
 * do not use this: the 409 of their challenge carries no state, and a verification closed with an `ok` in another tab must not be shown as one that ended with a person ({@link closedAnswerOf}).
 */
export function closedStateOf(error: unknown): IdentityVerificationState | null {
  const closed = closedAnswerOf(error);
  return closed === null ? null : (closed.state ?? CLOSED_WITH_A_PERSON);
}

/**
 * The 422 `notice_version_unknown` of the opening: the version the page named is not the text of the consent the registry serves now (a new one was published since the page read it). Nothing was recorded; the
 * page reads the texts again.
 */
export function isNoticeVersionUnknown(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 422 && getProblemCode(error.response.data) === 'notice_version_unknown';
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
  if (!response.acceptable && assistedReasonOf(codes) !== null) {
    // The server has already closed the verification with a person (a format it does not know, or a side refused as many times as the policy allows): nothing is asked of the guest any more,
    // so the page shows the way of a person, with the reason, and not another capture. The pictures this page held are let go.
    return { ...progress, stage: 'operator', operatorRequested: true, guidanceCodes: codes, documentRefused: false, documentSidesTaken: [], lockCode: null, lockCodeHeld: null };
  }

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
    // What follows a document that is complete: the selfie, or on a self-hosted verification the recording of the presence (the legacy selfie routes are refused there, and never called).
    stage: next === null ? (progress.selfHosted ? 'presence' : 'selfie') : 'document',
    documentNotArchived: notArchived,
    documentTwoSided: twoSided,
    documentSidesTaken: taken,
    documentSideNeeded: next ?? progress.documentSideNeeded,
    guidanceCodes: response.acceptable ? [] : codes,
    documentRefused: !response.acceptable && (codes.length === 0 || codes.some((code) => !(code in SIDE_GUIDANCE))),
  };
}

/**
 * The photo that was sent was the face side and it was good: it is accepted, or it is the answer that only asks for the back (`document_back_needed`, the front was fine and the card has its
 * lines of letters on the back). The step keeps what it needs of that front to warn before the back looks like it (a hint, E71/F02/US01/T02).
 */
export function frontWasTaken(response: IdentityDocumentResponse, sent: DocumentSide): boolean {
  return sent === 'front' && (response.acceptable || sideAskedBy(response.guidanceCodes) === 'back');
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

/** The moves of the challenge of the presence the page has words and a drawing for. */
const PRESENCE_MOVES: readonly PresenceMove[] = ['turn_left', 'turn_right', 'look_up', 'look_down'];

function isPresenceMove(value: unknown): value is PresenceMove {
  return typeof value === 'string' && (PRESENCE_MOVES as readonly string[]).includes(value);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * The challenge of the presence read from a body that came off the network (E72/F02/US01/T01), or `null` when it is not one the page can follow: no token, no moves, a move the page has no words for, a time or a rate
 * that is not a positive number, an expiry that is not a date. A challenge the page cannot follow is never half-used: the guest is told, and may try again or ask for a person.
 */
export function readPresenceChallenge(value: unknown): PresenceChallenge | null {
  if (!isRecord(value)) return null;
  const { challengeToken, steps, stepMs, leadInMs, expiresAt, targetFps, maxFrames, maxFrameSide } = value;
  if (typeof challengeToken !== 'string' || challengeToken.trim() === '') return null;
  if (!Array.isArray(steps) || steps.length === 0 || !steps.every(isPresenceMove)) return null;
  if (!isPositiveNumber(stepMs) || typeof leadInMs !== 'number' || !Number.isFinite(leadInMs) || leadInMs < 0) return null;
  if (!isPositiveNumber(targetFps) || !isPositiveInteger(maxFrames) || !isPositiveInteger(maxFrameSide)) return null;
  if (typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt))) return null;

  return { challengeToken, steps: [...steps], stepMs, leadInMs, expiresAt, targetFps, maxFrames, maxFrameSide };
}

/** The answer of the presence as the page reads it: the result, what to change, and the lock code when the server sends one with an `ok`. */
export interface PresenceAnswer {
  result: IdentityVerificationResultKind;
  guidance: readonly string[];
  guidedRetryAvailable: boolean;
  state: IdentityVerificationState | null;
  lockCode: string | null;
  lockCodeHeld: string | null;
}

/**
 * The answer of `POST .../presence` read from a body that came off the network, or `null` when it is not one (no `result` the page knows): an answer that cannot be read is a failure, never a pass. The codes of what to
 * change are the `guidance` of the answer (the older name `guidanceCodes` is read too), each a text; the lock code, when the server sends one with an `ok`, is a text.
 */
export function readPresenceAnswer(value: unknown): PresenceAnswer | null {
  if (!isRecord(value)) return null;
  const result = resultKindOf(value.result);
  if (result === null) return null;
  const codes = Array.isArray(value.guidance) ? value.guidance : Array.isArray(value.guidanceCodes) ? value.guidanceCodes : [];
  const text = (member: string) => (typeof value[member] === 'string' ? (value[member] as string).trim() : '');

  return {
    result,
    guidance: codes.filter((code): code is string => typeof code === 'string' && code.trim() !== ''),
    guidedRetryAvailable: value.guidedRetryAvailable === true,
    state: identityStateOf(value.state),
    lockCode: text('lockCode') === '' ? null : text('lockCode'),
    lockCodeHeld: text('lockCodeHeld') === '' ? null : text('lockCodeHeld'),
  };
}

/**
 * After the answer of the presence (E72/F02/US01/T01): `ok` is a pass (with the lock code when the server sends one, or why it is held back); `retry` says what to change and offers the recording again, with a new challenge
 * and a new key; anything else is a person who verifies. The pictures of the document a property that keeps none holds for the recording are let go by the caller, except after a `retry`. Nothing says «passed» unless the server did.
 */
export function afterPresence(progress: IdentityProgress, answer: PresenceAnswer): IdentityProgress {
  const attemptsRemaining = answer.state?.attemptsRemaining ?? progress.attemptsRemaining;
  if (answer.result === 'ok') {
    return {
      ...progress,
      stage: 'done',
      attemptsRemaining,
      guidanceCodes: [],
      documentRefused: false,
      documentSidesTaken: [],
      lockCode: answer.lockCode,
      lockCodeHeld: answer.lockCode === null ? answer.lockCodeHeld : null,
    };
  }
  if (answer.result === 'retry') {
    return { ...progress, stage: 'retry', attemptsRemaining, guidanceCodes: answer.guidance, lockCode: null, lockCodeHeld: null };
  }
  return {
    ...progress,
    stage: 'operator',
    operatorRequested: true,
    attemptsRemaining,
    guidanceCodes: [],
    documentRefused: false,
    documentSidesTaken: [],
    lockCode: null,
    lockCodeHeld: null,
  };
}

/** The `code` of the 409 that says the automatic check cannot be done for this session (API `IdentityApiErrors.PresenceChallengeUnavailable`). */
const PRESENCE_CHALLENGE_UNAVAILABLE = 'presence_challenge_unavailable';

/**
 * The state the 409 `presence_challenge_unavailable` carries (`null` when it carries none the page can read), or `null` itself for any other failure. The challenge cannot be issued for this session: the guest is
 * told, and a person verifies. The state in the body says why (a person already asked, the face check not offered, the attempts used).
 */
export function presenceUnavailableOf(error: unknown): { state: IdentityVerificationState | null } | null {
  if (!isAxiosError(error) || error.response?.status !== 409) return null;
  const body: unknown = error.response.data;
  if (getProblemCode(body) !== PRESENCE_CHALLENGE_UNAVAILABLE) return null;
  return { state: identityStateOf(isRecord(body) ? body.state : undefined) };
}

/**
 * The automatic check cannot be done: the page shows the message of the assisted path (the person verifies, and is asked for at once by the step). The state of the answer, when there is one, tells whether a person was
 * already asked and whether the face check is offered at all; a verification found closed is shown where it ended.
 */
export function afterPresenceUnavailable(progress: IdentityProgress, state: IdentityVerificationState | null): IdentityProgress {
  if (state?.closed === true) return progressFromState(state);
  return {
    ...progress,
    stage: 'operator',
    operatorRequested: state?.operatorRequested ?? progress.operatorRequested,
    biometricOffered: state?.biometricOffered ?? progress.biometricOffered,
    guidanceCodes: [],
    documentRefused: false,
    documentSidesTaken: [],
    lockCode: null,
    lockCodeHeld: null,
  };
}

/**
 * The 409 that says the challenge a recording answers is no longer one the server accepts (`presence_challenge_expired`, or `presence_challenge_required` when it has none for this attempt): nothing was decided, and
 * the guest records again with a new challenge and a new key (E72/F02/US01/T02).
 */
export function isPresenceChallengeRenewal(error: unknown): boolean {
  if (!isAxiosError(error) || error.response?.status !== 409) return false;
  const code = getProblemCode(error.response.data);
  return code === 'presence_challenge_expired' || code === 'presence_challenge_required';
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
 * The guest takes again what the guidance asked for (the document, the selfie, or on a self-hosted verification the recording of the presence), from the screen of a `retry`. The document starts again from its face
 * side; what the server already has of the other side stays with the server. The recording starts from nothing: a new challenge and a new key.
 */
export function afterRetake(progress: IdentityProgress): IdentityProgress {
  const target = retakeTargetOf(progress.guidanceCodes, progress.selfHosted);
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
  // The automatic check cannot be done for this session: the way to a person, with the message of the assisted path.
  if (problem === 'presence_unavailable') return afterPresenceUnavailable(progress, null);
  // The server wants a recording of the presence on a page that offers the selfie (a page opened before the flag was turned on): no screen of this page can answer, so the way to a person.
  if (problem === 'presence_required') return { ...progress, stage: 'unsupported', guidanceCodes: [], documentRefused: false };
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
  // The recording of the presence of a self-hosted verification (E72/F02/US01/T01): the automatic check cannot be done (a person verifies), the challenge ran out, the sequence is not valid or too large, or the page
  // is the one of the selfie while the server wants a recording.
  'presence_unavailable',
  'presence_expired',
  'presence_invalid',
  'presence_too_large',
  'presence_required',
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
  // The sequence of the presence has its own 413, before the one of the photos: it is a recording that is too large, not a photo.
  if (code === 'presence_sequence_too_large') return 'presence_too_large';
  if (status === 413) return 'too_large';
  if (code === 'presence_challenge_unavailable') return 'presence_unavailable';
  if (code === 'presence_challenge_expired' || code === 'presence_challenge_required') return 'presence_expired';
  if (code === 'presence_sequence_invalid') return 'presence_invalid';
  if (code === 'presence_sequence_required') return 'presence_required';
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
