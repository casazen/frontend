import { useCallback, useEffect, useRef, useState } from 'react';
import { publicCheckinApi } from '@/api/checkin.api';
import { prepareDocumentPhoto } from '@/lib/image-capture';
import type { IdentityVerificationState } from '@/types/public-checkin.types';
import {
  afterConsent,
  afterDocument,
  afterOperatorRequest,
  afterProblem,
  afterRetake,
  afterSelfie,
  BIOMETRIC_CONSENT_VERSION,
  classifyIdentityError,
  isIdentityConcluded,
  progressFromState,
  type IdentityProblem,
  type IdentityProgress,
} from './lib/identity-model';

/** What the identity step of the check-in page can do, and what it knows (E03/F04/US03/T01). */
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
  /** The guest agrees to the face check. */
  agree: () => Promise<void>;
  /** The guest refuses the face check: a person verifies. */
  refuse: () => Promise<void>;
  /**
   * The photo of the document as the guest chose it: it is made ready (redrawn when it must be) and sent in one hold, so that the buttons are disabled from the
   * pick. Resolves `true` when the API answered (the guest goes on or takes it again with the guidance), `false` when the photo could not be made ready or the
   * call failed (`problem` says which).
   */
  sendDocument: (file: File) => Promise<boolean>;
  /** The selfie. Resolves `true` when the API answered, `false` when the call failed (the guest sends the same picture again). */
  sendSelfie: (selfie: Blob) => Promise<boolean>;
  /** The guest asks for a person, from any screen of the step (GDPR art. 22). */
  askOperator: () => Promise<void>;
  /** The guest takes again what the guidance asked for (from the screen of a `retry`). */
  retake: () => void;
}

/** The photo could not be made ready in this browser: a type the API does not read, or a size it refuses that the browser could not reduce. */
class PhotoNotReady extends Error {
  readonly problem: IdentityProblem;

  constructor(problem: IdentityProblem) {
    super(problem);
    this.problem = problem;
  }
}

/**
 * The identity step of the guest check-in (CHK-11, NF-50, NF-51): the calls of the four endpoints and what the page knows of them. It starts from
 * what the context of the link says (`initial`) and follows the answers of the API, so a guest who opens the link again is where the server has them.
 *
 * Nothing here is kept outside this component: no mutation (a photo is in the variables of one and the lock code in its answer, and the cache keeps
 * both), no storage, no log; a failure is reduced to a problem code (the request that failed holds the photo). The photo of a document of a property
 * that archives none is held in a reference only, to be sent again with each selfie, and let go as soon as the step ends.
 */
export function useIdentityVerification(token: string, initial: IdentityVerificationState | undefined): IdentityVerificationController {
  const [local, setLocal] = useState<IdentityProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<IdentityProblem | null>(null);
  const inFlight = useRef(false);
  const documentPhoto = useRef<Blob | null>(null);

  const progress = local ?? (initial ? progressFromState(initial) : null);

  useEffect(
    () => () => {
      documentPhoto.current = null;
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
        const reason = error instanceof PhotoNotReady ? error.problem : classifyIdentityError(error);
        setProblem(reason);
        update((current) => afterProblem(current, reason));
        return false;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [update],
  );

  const agree = async () => {
    await run(() => publicCheckinApi.postBiometricConsent(token, { consentGiven: true, consentVersion: BIOMETRIC_CONSENT_VERSION }), afterConsent);
  };

  const refuse = async () => {
    documentPhoto.current = null;
    await run(() => publicCheckinApi.postBiometricConsent(token, { consentGiven: false }), afterConsent);
  };

  const sendDocument = (file: File) =>
    run(
      async () => {
        // A property that keeps no document gets the photo again with every selfie: the request of the selfie carries both pictures, so this one is held smaller.
        // Made ready inside the hold of the call: a large photo takes seconds to decode and redraw, and no button may be live in that time.
        const prepared = await prepareDocumentPhoto(file, { withSelfie: progress?.documentNotArchived === true });
        if (!prepared.ok) throw new PhotoNotReady(prepared.problem);

        const answer = await publicCheckinApi.postDocument(token, prepared.blob);
        // A property that keeps no document needs the photo again with every selfie: it stays in memory, for the step only.
        documentPhoto.current = answer.documentNotArchived || progress?.documentNotArchived ? prepared.blob : null;
        return answer;
      },
      afterDocument,
    );

  const sendSelfie = async (selfie: Blob): Promise<boolean> => {
    const needsDocument = progress?.documentNotArchived === true;
    if (needsDocument && !documentPhoto.current) {
      // The page was closed since the document was photographed: its photo is gone, and the API asks for it again.
      setProblem('document_photo');
      update((current) => afterProblem(current, 'document_photo'));
      return false;
    }

    const kept = needsDocument ? documentPhoto.current : null;
    return run(async () => {
      const answer = await publicCheckinApi.postSelfie(token, selfie, kept);
      // A pass or a person ends the step: the photo of the document is let go. After a retry it is needed for the next selfie.
      if (answer.result !== 'retry') documentPhoto.current = null;
      return answer;
    }, afterSelfie);
  };

  const askOperator = async () => {
    const asked = await run(() => publicCheckinApi.requestOperator(token), afterOperatorRequest);
    // A person has it, or it passed: the photo of the document is no longer needed. A call that failed leaves it, for the guest who tries again.
    if (asked) documentPhoto.current = null;
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
    sendSelfie,
    askOperator,
    retake,
  };
}
