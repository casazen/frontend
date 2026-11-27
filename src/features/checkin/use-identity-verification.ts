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

/**
 * What stopping the upload of the presence and asking for a person came to (E72/F02/US01/T02): `asked` (a person was asked for, and the step moved to the assisted path), `answered` (the server had answered before the upload
 * could be stopped: the step moved on by itself, and nobody is asked for), or `failed` (the request for a person did not get through: the guest is told and keeps the way to a person).
 */
export type PresenceCancelResult = 'asked' | 'answered' | 'failed';

/** What the identity step of the check-in page can do, and what it knows (E03/F04/US03/T01, E22/F02/US01/T01). */
export interface IdentityVerificationController {
  /** Where the guest is; `null` while the page has no identity step (the verification is off, or the page has not loaded). */
  progress: IdentityProgress | null;
  /**
   * One call is in flight, or the photo for one is being made ready (decoded and redrawn in the browser, seconds for a large one): every button of the step
   * stays disabled until it ends (a second tap, or a second photo, cannot start another).
   */
  busy: boolean;
  /** Why the last call failed, for the sentence under the buttons; `null` when it worked. */
  problem: IdentityProblem | null;
  /** The identity step is over (a pass, or a person asked and has it), or there is none: the page may go on. */
  concluded: boolean;
  /** The guest agrees to the face check, to the text of the consent of this `consentVersion` (the one the registry served and the guest read). */
  agree: (consentVersion: string) => Promise<void>;
  /** The guest refuses the face check: a person verifies. */
  refuse: () => Promise<void>;
  /**
   * The photo of the document as the guest chose it, of the side the step asks for (the front first, then the back when the answer says the document has two sides): it is made ready (redrawn
   * when it must be) and sent in one hold, so that the buttons are disabled from the pick. Resolves `true` when the API answered (the guest goes on or takes it again with the guidance),
   * `false` when the photo could not be made ready or the call failed (`problem` says which). The guided camera hands in the difference hash of the frame it took (`fingerprint`, E71/F02/US01/T02): when the
   * photo is the face side and it is good, the hash is kept in memory for the length of the step, so that `looksLikeTheFront` can warn before a back that looks like it is sent. A photo with no hash keeps none.
   */
  sendDocument: (file: File, fingerprint?: string | null) => Promise<boolean>;
  /**
   * The hash of the photo of the back looks like the one of the front taken before (E71/F02/US01/T02): a hint for the guest, who may take the photo again or send it anyway. `false` when the page holds no hash of a
   * front (a photo chosen from the files, the front of the data step): then only the server decides.
   */
  looksLikeTheFront: (fingerprint: string) => boolean;
  /** The selfie. Resolves `true` when the API answered, `false` when the call failed (the guest sends the same picture again). */
  sendSelfie: (selfie: Blob, pose?: SelfiePose) => Promise<boolean>;
  /**
   * The challenge of the presence of a self-hosted verification (E72/F02/US01/T01): the moves to follow and how the frames are taken. It is a call of its own, not one of the buttons of the step, so it holds none of
   * them disabled and the way to a person stays open while it is on its way. `isCurrent` says whether the screen that asked is still the one that wants the answer: when it is not, nothing is done with it (`stale`). A challenge that
   * the server cannot issue for this session (409 `presence_challenge_unavailable`) moves the step to the assisted path, with the state of the answer; a verification found closed shows where it ended; any
   * other failure is a `problem` and the guest tries again.
   */
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
  /**
   * The server does not take the text on the screen as the one in force (and reading it again did not help): the face check is not offered on this page, a person verifies. It follows the last opening: an opening
   * that is not refused turns it off again.
   */
  automaticUnavailable: boolean;
}

/** The photo could not be made ready in this browser: a type the API does not read, or a size it refuses that the browser could not reduce. */
class PhotoNotReady extends Error {
  readonly problem: IdentityProblem;

  constructor(problem: IdentityProblem) {
    super(problem);
    this.problem = problem;
  }
}

/** The pictures of the document a property that keeps none sends again with every selfie: one per side, held in a reference only. */
type HeldPictures = Record<DocumentSide, Blob | null>;

const NO_PICTURES: HeldPictures = { front: null, back: null };

/**
 * Where the opening of the identity step stands: not tried yet (or to be tried again), being tried, done (opened, found closed, or a failure that changes nothing for the guest), or refused for good for the text the page
 * showed (`refused` is its version, `null` when the registry served none).
 */
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
  // The difference hash of the front that was taken with the camera (a value derived from the document: a reference only, never state, never a storage, a request or a log).
  const frontFingerprint = useRef<string | null>(null);
  // The upload of the sequence of the presence that is on its way (E72/F02/US01/T02): what stops it, and a promise that settles once the step is free again (`true` when it ended with the answer of the server). `null` when none is.
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

  /**
   * The verification was found closed (the 409 `identity_already_closed`, or the answer of the opening): the guest sees where it ended and no capture is offered. The pictures held for the next selfie go with it,
   * and nothing is said of a failure: the step is simply over.
   */
  const showClosed = useCallback(
    (state: IdentityVerificationState) => {
      letGoOfThePictures();
      update(() => progressFromState(state));
    },
    [letGoOfThePictures, update],
  );

  /**
   * The state a verification that was found closed ended in, for the calls of the presence (E72/F02/US01/T02). The 409 `identity_already_closed` of the challenge carries no state (`known` is `null`), and the page does not
   * deduce how it ended: a verification closed with an `ok` in another tab is a verification that passed. The state of the link is read again, with the same call the page started from (the context of the link), and shown
   * as it says. When the link cannot be read, or does not say the verification is closed, no outcome is shown: `problem` is why, and the guest tries again.
   */
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

  /** One call at a time. A failure never throws out of here: it becomes a problem, and the guest stays where they are. */
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
        // The verification is over (a picture sent from another tab, or after a reload): the server answered where it ended, and that is what the guest sees; the call is answered, and it is not a failure.
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
      // One attempt at a time and one per page load, however often the screen renders, changes language or is left and come back to: the server records the opening once, and a repeat would only spend the rate limit of
      // the link. The exceptions come from the server or from the texts: a refusal reads the texts again once (below), a read that failed is followed by an attempt with the next text that settles, and a text that is
      // not the one the server refused for good gets an attempt of its own.
      const { phase, refused } = notice.current;
      if (phase === 'running' || phase === 'done' || (phase === 'refused' && refused === version)) return;
      notice.current = { phase: 'running', refused: null };

      /** `opened` (or found closed), `unknown` when the server says the version is not the one in force, `failed` for anything else: a failure that changes nothing for the guest, the consent opens the step too. */
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
        // Nothing the server refused: the text on the screen may be agreed to (this turns off what an earlier refusal of another text left on).
        notice.current = { phase: 'done', refused: null };
        setAutomaticUnavailable(false);
        return;
      }

      // The text on the screen is not the one in force: the texts are read again, once, and the opening is tried with the version the registry serves now.
      let served: string | null;
      try {
        served = await readTextsAgain();
      } catch {
        // The texts could not be read again, so nothing says which text is in force (and the older answer that is still in memory is the one that was just refused): nothing is concluded, and the opening is tried
        // again with the next text that settles.
        notice.current = NOTICE_NOT_TRIED;
        return;
      }

      const second = served === null ? 'unknown' : await open(served);
      if (second === 'unknown') {
        // Still refused (or the registry serves none): the page cannot say which text the guest agrees to. The face check is not offered, and a person verifies.
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
    // The side the step asks for: the front first (a passport is complete with it), the back when the answer said the document has two sides.
    const side: DocumentSide = progress?.documentSideNeeded ?? 'front';
    return run(
      async () => {
        // A property that keeps no document gets the pictures again with every selfie: the request of the selfie carries all of them, so each is held smaller.
        // Made ready inside the hold of the call: a large photo takes seconds to decode and redraw, and no button may be live in that time.
        const prepared = await prepareDocumentPhoto(file, { withSelfie: progress?.documentNotArchived === true });
        if (!prepared.ok) throw new PhotoNotReady(prepared.problem);

        const answer = await publicCheckinApi.postDocument(token, prepared.blob, side);
        // A property that keeps no document needs the picture again with every selfie: it stays in memory, for the step only. Any other has it on the server, and the page keeps nothing.
        if (answer.documentNotArchived || progress?.documentNotArchived) documentPictures.current = { ...documentPictures.current, [side]: prepared.blob };
        // The front that was taken keeps its hash, for the warning before a back that looks like it. A front with no hash leaves none, and a front that is taken again replaces the one before.
        if (frontWasTaken(answer, side)) frontFingerprint.current = fingerprint;
        // The server has closed the verification with a person: the pictures and the hash this page held are no longer needed.
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
    // The guest who asks for a challenge is not on a failure any more: the sentence of the last one goes.
    setProblem(null);
    try {
      const challenge = readPresenceChallenge(await publicCheckinApi.startPresenceChallenge(token));
      if (!isCurrent()) return { kind: 'stale' };
      if (challenge !== null) return { kind: 'ready', challenge };
      // A body that is not a challenge the page can follow is a failure like any other: the guest tries again, or asks for a person.
      setProblem('failed');
      return { kind: 'failed' };
    } catch (error) {
      if (!isCurrent()) return { kind: 'stale' };
      // The verification is over (another tab, a reload): the guest sees where it ended. The 409 of the challenge carries no state, so the state of the link says how it ended: nothing is deduced, and a verification
      // that passed in another tab is shown as one that passed.
      const closed = closedAnswerOf(error);
      if (closed) {
        const read = await readClosedState(closed.state);
        if (!isCurrent()) return { kind: 'stale' };
        if ('state' in read) {
          showClosed(read.state);
          return { kind: 'moved' };
        }
        // The link could not be read, or does not say it is over: no outcome is shown, the guest tries again.
        setProblem(read.problem);
        return { kind: 'failed' };
      }
      // The automatic check cannot be done for this session: the message of the assisted path, with what the state says about why.
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

    // A property that keeps no document gets the pictures again with the recording, as it does with the selfie: held in memory for the step only.
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
    // The guest may stop the upload (`cancelPresence`): the signal goes to every request of it, and `finished` settles once the step is free again, with whether the server answered.
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

      // The guest stopped the upload: the request that was on its way is given up and nothing of it is shown, no outcome and no sentence (`cancelPresence` goes on from here).
      if (outcome.kind === 'cancelled') return { kind: 'cancelled' };

      if (outcome.kind === 'answered') {
        const answer = readPresenceAnswer(outcome.answer);
        if (answer === null) {
          // An answer that is not one (a page of the server in its place) decided nothing the page can show: it is a failure, never a pass.
          setProblem('failed');
          return { kind: 'failed' };
        }
        // A pass or a person ends the step: the pictures of the document are let go. After a retry they are needed for the next recording.
        if (answer.result !== 'retry') letGoOfThePictures();
        update((current) => afterPresence(current, answer));
        answered = true;
        return { kind: 'answered' };
      }

      // The network or the server did not answer after the tries: the same recording is worth sending again with the same key.
      if (outcome.kind === 'gave-up') return { kind: 'kept', problem: getHttpStatus(outcome.error) === undefined ? 'network' : 'processing' };

      const { error } = outcome;
      // The verification is over (a recording sent from another tab, or after a reload): the server answered where it ended, and that is what the guest sees; the call is answered, and it is not a failure. An answer that
      // carries no state is not taken for a person: the state of the link is read.
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
      // Too many requests in a short time: the server did not process this one, so the same recording may be sent again with the same key.
      if (isRateLimited(error)) return { kind: 'kept', problem: 'too_many_requests' };
      // The challenge ran out before the server closed the verification: nothing was decided, and a new recording starts from a new challenge and a new key.
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

  /** The request for a person of the guest, answered or not: a person has it, or it passed (the pictures of the document are no longer needed), or the call failed (they stay, for the guest who tries again). */
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
      // The request that is on its way is cancelled with the upload, and what waits (the pause before a repeat, the connection that is not there) stops waiting.
      upload.abort.abort();
      // The step is free again once the upload has ended, and only then can a person be asked for. If the server had answered first, that answer is what the guest sees: nobody is asked for on top of it.
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
