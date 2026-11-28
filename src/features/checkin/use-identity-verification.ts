import { useCallback, useEffect, useRef, useState } from 'react';
import { publicCheckinApi, type SelfiePose } from '@/api/checkin.api';
import { getHttpStatus } from '@/lib/api-errors';
import { prepareDocumentPhoto } from '@/lib/image-capture';
import type { DocumentSide, IdentityVerificationState, PresenceChallenge, PresenceSequence } from '@/types/public-checkin.types';
import { looksLikeTheSameSide } from './lib/document-fingerprint';
import {
  afterConsent,
  afterDocument,
  afterOperatorRequest,
  afterPresence,
  afterPresenceUnavailable,
  afterProblem,
  afterRetake,
  afterSelfie,
  assistedReasonOf,
  classifyIdentityError,
  closedAnswerOf,
  closedStateOf,
  frontWasTaken,
  identityStateOf,
  isIdentityConcluded,
  isNoticeVersionUnknown,
  isPresenceChallengeRenewal,
  presenceUnavailableOf,
  progressFromState,
  readPresenceAnswer,
  readPresenceChallenge,
  type IdentityProblem,
  type IdentityProgress,
} from './lib/identity-model';
import { isRateLimited, uploadPresence } from './lib/presence-upload';

/**
 * What asking for the challenge of the presence came to (E72/F02/US01/T01): the challenge; a failure the guest may try again (`problem` says which); the step moved on by itself, because the automatic check cannot
 * be done for this session (the assisted path takes over) or the verification was found closed; or the screen that asked is already gone, and the answer is not for it.
 */
export type PresenceChallengeResult = { kind: 'ready'; challenge: PresenceChallenge } | { kind: 'failed' } | { kind: 'moved' } | { kind: 'stale' };

/**
 * What sending the sequence of the presence came to (E72/F02/US01/T02): the server answered (the step moved on: a pass, a retry with its guidance, a person, or a verification found closed); the upload did not get
 * through (the network, the server, too many requests) and the same recording may be sent again with the same key (`problem` says which); the challenge ran out and nothing was decided (a new challenge, a new
 * key, a new recording); the server refused for good (`problem` says why, and the recording starts again); another call of the step is in flight and nothing was sent; or the guest stopped the upload
 * (`cancelled`, see `cancelPresence`: the request that was on its way was given up, and the recording is not kept).
 */
export type PresenceSendResult =
  | { kind: 'answered' }
  | { kind: 'kept'; problem: IdentityProblem }
  | { kind: 'renew' }
  | { kind: 'failed' }
  | { kind: 'busy' }
  | { kind: 'cancelled' };

export type PresenceCancelResult = 'asked' | 'answered' | 'failed';

export interface IdentityVerificationController {
  progress: IdentityProgress | null;
  busy: boolean;
  problem: IdentityProblem | null;
  concluded: boolean;
  agree: (consentVersion: string) => Promise<void>;
  refuse: () => Promise<void>;
  /**
   * The photo of the document as the guest chose it, of the side the step asks for (the front first, then the back when the answer says the document has two sides): it is made ready (redrawn
   * when it must be) and sent in one hold, so that the buttons are disabled from the pick. Resolves `true` when the API answered (the guest goes on or takes it again with the guidance),
   * `false` when the photo could not be made ready or the call failed (`problem` says which). The guided camera hands in the difference hash of the frame it took (`fingerprint`, E71/F02/US01/T02): when the
   * photo is the face side and it is good, the hash is kept in memory for the length of the step, so that `looksLikeTheFront` can warn before a back that looks like it is sent. A photo with no hash keeps none.
   */
  sendDocument: (file: File, fingerprint?: string | null) => Promise<boolean>;
  looksLikeTheFront: (fingerprint: string) => boolean;
  sendSelfie: (selfie: Blob, pose?: SelfiePose) => Promise<boolean>;
  startPresence: (isCurrent?: () => boolean) => Promise<PresenceChallengeResult>;
  /**
   * The sequence of the presence (E72/F02/US01/T02): sent with `idempotencyKey`, which belongs to the recording and is the same for every repeat of it. A network that drops, a timeout and a 5xx are repeated with the
   * same frames and the same key (so a request that did reach the server comes back as its stored answer); a 4xx is not. The pictures of the document a property that keeps none holds for the recording go with it.
   * One call at a time (`busy` while it lasts): a second one is not sent. The sequence is not kept here: the caller owns its frames and lets them go.
   */
  sendPresence: (sequence: PresenceSequence, idempotencyKey: string) => Promise<PresenceSendResult>;
  /**
   * The guest stops the upload of the sequence and asks for a person (E72/F02/US01/T02): the way to a person is disabled while a call of the step is in flight, and a recording on a slow network may take minutes, so this is
   * the one way to a person that is open while the upload is on its way. The request that is on its way is cancelled (`AbortController`: nothing is repeated and nothing waits for the connection any more), the recording is not
   * kept, and when the upload has ended a person is asked for, as `askOperator` does. If the server had answered before the upload could be stopped, that answer is what the guest sees and nobody is asked for (`answered`).
   * The timeouts of the tries are not shortened: a slow network is given its whole time unless the guest stops it.
   */
  cancelPresence: () => Promise<PresenceCancelResult>;
  /** The guest asks for a person, from any screen of the step (GDPR art. 22). */
  askOperator: () => Promise<void>;
  /** The guest takes again what the guidance asked for (from the screen of a `retry`). */
  retake: () => void;
  /**
   * The identity step of a self-hosted verification is opened with the version of the text of the consent the guest is shown (E70/F03/US01/T01, NF-188): once per page load, whatever the screen does with its
   * renders and its steps (the server records the opening once, and every later call changes nothing). Nothing waits for it and no button depends on it: the answer to the consent opens the step too, so a call that
   * fails changes nothing for the guest. When the server says that version is not the one in force (422), `readTextsAgain` reads the texts once more and resolves with the version of the consent the registry serves
   * now (`null` when it serves none), or REJECTS when they could not be read (a read that failed leaves the older answer in memory, and that is the version just refused: it is no answer). The opening is tried again
   * with the version it resolved with, and when that is refused too the page cannot say which text the guest agrees to, so `automaticUnavailable` turns on. After a read that failed nothing is concluded: the opening
   * is tried again with the next text that settles. A text that is not the one refused for good gets an attempt of its own.
   */
  openNotice: (version: string, readTextsAgain: () => Promise<string | null>) => Promise<void>;
  automaticUnavailable: boolean;
}

class PhotoNotReady extends Error {
  readonly problem: IdentityProblem;

  constructor(problem: IdentityProblem) {
    super(problem);
    this.problem = problem;
  }
}

type HeldPictures = Record<DocumentSide, Blob | null>;

const NO_PICTURES: HeldPictures = { front: null, back: null };

interface NoticeOpening {
  phase: 'idle' | 'running' | 'done' | 'refused';
  refused: string | null;
}

const NOTICE_NOT_TRIED: NoticeOpening = { phase: 'idle', refused: null };

/**
 * The identity step of the guest check-in (CHK-11, NF-50, NF-51): the calls of the four endpoints and what the page knows of them. It starts from
 * what the context of the link says (`initial`) and follows the answers of the API, so a guest who opens the link again is where the server has them.
 *
 * Nothing here is kept outside this component: no mutation (a photo is in the variables of one and the lock code in its answer, and the cache keeps
 * both), no storage, no log; a failure is reduced to a problem code (the request that failed holds the photo). A property that archives no document
 * gets the pictures again with each selfie, so the page holds them (one per side of the document) in a reference only, never in state, and lets
 * them go as soon as the step ends; every other property keeps them on the server and the page holds none.
 */
export function useIdentityVerification(token: string, initial: IdentityVerificationState | undefined): IdentityVerificationController {
  const [local, setLocal] = useState<IdentityProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<IdentityProblem | null>(null);
  const [automaticUnavailable, setAutomaticUnavailable] = useState(false);
  const inFlight = useRef(false);
  const notice = useRef<NoticeOpening>(NOTICE_NOT_TRIED);
  const documentPictures = useRef<HeldPictures>(NO_PICTURES);
  const frontFingerprint = useRef<string | null>(null);
  const presenceUpload = useRef<{ abort: AbortController; finished: Promise<boolean> } | null>(null);

  const progress = local ?? (initial ? progressFromState(initial) : null);

  useEffect(
    () => () => {
      documentPictures.current = NO_PICTURES;
      frontFingerprint.current = null;
    },
    [],
  );

  const update = useCallback(
    (change: (current: IdentityProgress) => IdentityProgress) => {
      setLocal((previous) => {
        const base = previous ?? (initial ? progressFromState(initial) : null);
        return base ? change(base) : previous;
      });
    },
    [initial],
  );

  const letGoOfThePictures = useCallback(() => {
    documentPictures.current = NO_PICTURES;
    frontFingerprint.current = null;
  }, []);

  const showClosed = useCallback(
    (state: IdentityVerificationState) => {
      letGoOfThePictures();
      update(() => progressFromState(state));
    },
    [letGoOfThePictures, update],
  );

  const readClosedState = useCallback(
    async (known: IdentityVerificationState | null): Promise<{ state: IdentityVerificationState } | { problem: IdentityProblem }> => {
      if (known) return { state: known };
      try {
        const state = identityStateOf((await publicCheckinApi.getContext(token))?.identityVerification);
        return state !== null && state.closed === true ? { state } : { problem: 'failed' };
      } catch (error) {
        return { problem: classifyIdentityError(error) };
      }
    },
    [token],
  );

  const run = useCallback(
    async <T,>(call: () => Promise<T>, apply: (current: IdentityProgress, answer: T) => IdentityProgress): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setBusy(true);
      setProblem(null);
      try {
        const answer = await call();
        update((current) => apply(current, answer));
        return true;
      } catch (error) {
        const closed = closedStateOf(error);
        if (closed) {
          showClosed(closed);
          return true;
        }

        const reason = error instanceof PhotoNotReady ? error.problem : classifyIdentityError(error);
        setProblem(reason);
        update((current) => afterProblem(current, reason));
        return false;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [showClosed, update],
  );

  const openNotice = useCallback(
    async (version: string, readTextsAgain: () => Promise<string | null>) => {
      const { phase, refused } = notice.current;
      if (phase === 'running' || phase === 'done' || (phase === 'refused' && refused === version)) return;
      notice.current = { phase: 'running', refused: null };

      const open = async (shown: string): Promise<'opened' | 'unknown' | 'failed'> => {
        try {
          const state = identityStateOf((await publicCheckinApi.openIdentity(token, shown))?.state);
          if (state?.closed === true) showClosed(state);
          return 'opened';
        } catch (error) {
          const closed = closedStateOf(error);
          if (closed) {
            showClosed(closed);
            return 'opened';
          }
          return isNoticeVersionUnknown(error) ? 'unknown' : 'failed';
        }
      };

      const first = await open(version);
      if (first !== 'unknown') {
        notice.current = { phase: 'done', refused: null };
        setAutomaticUnavailable(false);
        return;
      }

      let served: string | null;
      try {
        served = await readTextsAgain();
      } catch {
        notice.current = NOTICE_NOT_TRIED;
        return;
      }

      const second = served === null ? 'unknown' : await open(served);
      if (second === 'unknown') {
        notice.current = { phase: 'refused', refused: served };
        setAutomaticUnavailable(true);
        return;
      }

      notice.current = { phase: 'done', refused: null };
      setAutomaticUnavailable(false);
    },
    [showClosed, token],
  );

  const agree = async (consentVersion: string) => {
    await run(() => publicCheckinApi.postBiometricConsent(token, { consentGiven: true, consentVersion }), afterConsent);
  };

  const refuse = async () => {
    letGoOfThePictures();
    await run(() => publicCheckinApi.postBiometricConsent(token, { consentGiven: false }), afterConsent);
  };

  const sendDocument = (file: File, fingerprint: string | null = null) => {
    const side: DocumentSide = progress?.documentSideNeeded ?? 'front';
    return run(
      async () => {
        const prepared = await prepareDocumentPhoto(file, { withSelfie: progress?.documentNotArchived === true });
        if (!prepared.ok) throw new PhotoNotReady(prepared.problem);

        const answer = await publicCheckinApi.postDocument(token, prepared.blob, side);
        if (answer.documentNotArchived || progress?.documentNotArchived) documentPictures.current = { ...documentPictures.current, [side]: prepared.blob };
        // The front that was taken keeps its hash, for the warning before a back that looks like it. A front with no hash leaves none, and a front that is taken again replaces the one before.
        if (frontWasTaken(answer, side)) frontFingerprint.current = fingerprint;
        if (!answer.acceptable && assistedReasonOf(answer.guidanceCodes) !== null) letGoOfThePictures();
        return answer;
      },
      (current, answer) => afterDocument(current, answer, side),
    );
  };

  const looksLikeTheFront = (fingerprint: string) => frontFingerprint.current !== null && looksLikeTheSameSide(frontFingerprint.current, fingerprint);

  const sendSelfie = async (selfie: Blob, pose?: SelfiePose): Promise<boolean> => {
    const needsDocument = progress?.documentNotArchived === true;
    const needsBack = needsDocument && progress?.documentTwoSided === true;
    const held = documentPictures.current;
    if (needsDocument && (!held.front || (needsBack && !held.back))) {
      // The page was closed since the document was photographed: its pictures are gone, and the API asks for them again.
      setProblem('document_photo');
      update((current) => afterProblem(current, 'document_photo'));
      return false;
    }

    const front = needsDocument ? held.front : null;
    const back = needsBack ? held.back : null;
    return run(async () => {
      const answer = await publicCheckinApi.postSelfie(token, selfie, front, back, pose);
      // A pass or a person ends the step: the pictures of the document are let go. After a retry they are needed for the next selfie.
      if (answer.result !== 'retry') letGoOfThePictures();
      return answer;
    }, afterSelfie);
  };

  const startPresence = async (isCurrent: () => boolean = () => true): Promise<PresenceChallengeResult> => {
    setProblem(null);
    try {
      const challenge = readPresenceChallenge(await publicCheckinApi.startPresenceChallenge(token));
      if (!isCurrent()) return { kind: 'stale' };
      if (challenge !== null) return { kind: 'ready', challenge };
      setProblem('failed');
      return { kind: 'failed' };
    } catch (error) {
      if (!isCurrent()) return { kind: 'stale' };
      const closed = closedAnswerOf(error);
      if (closed) {
        const read = await readClosedState(closed.state);
        if (!isCurrent()) return { kind: 'stale' };
        if ('state' in read) {
          showClosed(read.state);
          return { kind: 'moved' };
        }
        setProblem(read.problem);
        return { kind: 'failed' };
      }
      const unavailable = presenceUnavailableOf(error);
      if (unavailable) {
        letGoOfThePictures();
        update((current) => afterPresenceUnavailable(current, unavailable.state));
        return { kind: 'moved' };
      }

      const reason = classifyIdentityError(error);
      setProblem(reason);
      update((current) => afterProblem(current, reason));
      return { kind: 'failed' };
    }
  };

  const sendPresence = async (sequence: PresenceSequence, idempotencyKey: string): Promise<PresenceSendResult> => {
    if (inFlight.current) return { kind: 'busy' };

    const needsDocument = progress?.documentNotArchived === true;
    const needsBack = needsDocument && progress?.documentTwoSided === true;
    const held = documentPictures.current;
    if (needsDocument && (!held.front || (needsBack && !held.back))) {
      // The page was closed since the document was photographed: its pictures are gone, and the API asks for them again.
      setProblem('document_photo');
      update((current) => afterProblem(current, 'document_photo'));
      return { kind: 'failed' };
    }

    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    const abort = new AbortController();
    let settle: (answered: boolean) => void = () => undefined;
    const finished = new Promise<boolean>((resolve) => {
      settle = resolve;
    });
    presenceUpload.current = { abort, finished };
    let answered = false;
    try {
      const body: PresenceSequence = { ...sequence, documentPhoto: needsDocument ? held.front : null, documentPhotoBack: needsBack ? held.back : null };
      const outcome = await uploadPresence((key) => publicCheckinApi.postPresence(token, body, key, abort.signal), idempotencyKey, undefined, abort.signal);

      if (outcome.kind === 'cancelled') return { kind: 'cancelled' };

      if (outcome.kind === 'answered') {
        const answer = readPresenceAnswer(outcome.answer);
        if (answer === null) {
          setProblem('failed');
          return { kind: 'failed' };
        }
        // A pass or a person ends the step: the pictures of the document are let go. After a retry they are needed for the next recording.
        if (answer.result !== 'retry') letGoOfThePictures();
        update((current) => afterPresence(current, answer));
        answered = true;
        return { kind: 'answered' };
      }

      if (outcome.kind === 'gave-up') return { kind: 'kept', problem: getHttpStatus(outcome.error) === undefined ? 'network' : 'processing' };

      const { error } = outcome;
      const closed = closedAnswerOf(error);
      if (closed) {
        const read = await readClosedState(closed.state);
        if ('state' in read) {
          showClosed(read.state);
          answered = true;
          return { kind: 'answered' };
        }
        setProblem(read.problem);
        return { kind: 'failed' };
      }
      if (isRateLimited(error)) return { kind: 'kept', problem: 'too_many_requests' };
      if (isPresenceChallengeRenewal(error)) return { kind: 'renew' };

      const reason = classifyIdentityError(error);
      setProblem(reason);
      update((current) => afterProblem(current, reason));
      return { kind: 'failed' };
    } finally {
      presenceUpload.current = null;
      inFlight.current = false;
      setBusy(false);
      settle(answered);
    }
  };

  const requestOperator = async (): Promise<boolean> => {
    const asked = await run(() => publicCheckinApi.requestOperator(token), afterOperatorRequest);
    if (asked) letGoOfThePictures();
    return asked;
  };

  const askOperator = async () => {
    await requestOperator();
  };

  const cancelPresence = async (): Promise<PresenceCancelResult> => {
    const upload = presenceUpload.current;
    if (upload) {
      upload.abort.abort();
      if (await upload.finished) return 'answered';
    }
    return (await requestOperator()) ? 'asked' : 'failed';
  };

  const retake = () => {
    setProblem(null);
    update(afterRetake);
  };

  return {
    progress,
    busy,
    problem,
    concluded: isIdentityConcluded(progress),
    agree,
    refuse,
    sendDocument,
    looksLikeTheFront,
    sendSelfie,
    startPresence,
    sendPresence,
    cancelPresence,
    askOperator,
    retake,
    openNotice,
    automaticUnavailable,
  };
}
