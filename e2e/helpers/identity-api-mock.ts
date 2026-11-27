import { createHash } from 'node:crypto';
import type { Page, Request } from '@playwright/test';
import type {
  BiometricConsentResponse,
  CheckInDocumentReadResult,
  CheckInLegalTextsResponse,
  IdentityDocumentResponse,
  IdentityOpenResponse,
  IdentityOperatorResponse,
  IdentityPresenceResponse,
  IdentityVerificationState,
  PresenceChallenge,
  PublicCheckInContextDto,
} from '../../src/types/public-checkin.types';

/**
 * The API of the guest identity step, answered by the page itself (E74/F04/US01/T01, NF-198): a stay whose link carries the state of a self-hosted verification, the legal text of the consent, the opening of the
 * step, the consent, the two sides of a card, the reading of a photo, the challenge of the presence and the recording that answers it, and the request for a person. There is no backend, no model and no picture
 * behind it: what the server DECIDES is a script the proof gives (`presence`), and what the proof looks at is what the PAGE SENT, which is recorded call by call (method, headers, the parts of a multipart body).
 *
 * The answers follow the contract of the endpoints (E70/F02/US01/T01, E71/F01/US03/T01, E72/F01/US01/T01, E73/F01/US01/T02, repeated in E72/F02/US01/T01) as the page reads them, and the state they carry is the
 * state the server would be in: a page opened again through the same link finds the verification where it was left.
 */

/** The version of the text of the consent the registry of this mock serves: the opening of the step and the consent must name it, anything else is refused as the server refuses it. */
const CONSENT_VERSION = 'checkin-biometric-e2e-1';

/** The code of the lock an approved verification hands the guest (a fixture value, the code of no lock). */
export const LOCK_CODE = '482913';

/**
 * The moves the mock asks for and for how long, as the challenge states them: a lead-in to look at the camera, then each move. Short, so that a recording that is made for real (the frames of the fake camera, in real
 * time) lasts two seconds. The challenge outlives the recording by far.
 */
export const PRESENCE_PLAN = { leadInMs: 600, stepMs: 700, steps: ['turn_left', 'look_up'] } as const satisfies Pick<PresenceChallenge, 'leadInMs' | 'stepMs' | 'steps'>;

/** The flags the self-hosted verification needs, on: what `GET /api/public/features` answers while the whole family is switched on. */
const FEATURES = {
  otaPartnerApi: false,
  checkInIdentityVerification: true,
  checkInIdentitySelfHosted: true,
  checkInIdentityAutoApproval: true,
  checkInIdentityReviewEvidence: true,
};

/** What the server decides at each recording, in order (the last entry is what every later one gets): a pass, one more try with its guidance, a person, or a connection that breaks before the server answers. */
type PresenceStep = 'ok' | 'retry' | 'operator' | 'abort';

/** The token of the link the mock answers for. */
const TOKEN = 'identity-e2e-session';

export interface IdentityMockOptions {
  /** Where the link finds the verification: at the consent (a guest who opens it), at the document, or at the recording (a guest who comes back after the document, or who is sent there). */
  startAt?: 'consent' | 'document' | 'presence';
  /** What the server decides at each recording (`ok` for all of them when it is not given). */
  presence?: PresenceStep[];
  /** The first photo of the document cannot be compared: the codes of what to change (the following ones are read as the two sides of a card). */
  refuseFirstDocument?: string[];
  /** How long the server takes to answer a photo of the document, in milliseconds. */
  documentDelayMs?: number;
}

/** One call the page made to the link, as the mock saw it. */
export interface IdentityCall {
  /** What was asked: `context` (the link itself), `legal-texts`, `identity/open`, `biometric-consent`, `document`, `read-document`, `presence-challenge`, `presence`, `request-operator`, or whatever else the page asked for. */
  endpoint: string;
  method: string;
  /** The query string (the pictures and the data of the guest are never in it). */
  search: string;
  /** The headers of the request, names in lower case. */
  headers: Record<string, string>;
  /** How many parts of each name a multipart body has (`frames: 12`, `timestamps: 1`). */
  parts: Record<string, number>;
  /** The parts of a multipart body that are text (`side`, `challengeToken`, `timestamps`), by name. */
  fields: Record<string, string>;
  /** The JSON body, for a call that sends one. */
  json: unknown;
  /** Every picture part of the body that came with its bytes starts with the marker of a JPEG. */
  picturesAreJpeg: boolean;
  /** The SHA-256 of the `frames` parts, one after the other: two requests with the same one carry the same recording. `null` for a body with no frames. */
  framesDigest: string | null;
  /** What the mock did with it: answered it, or broke the connection before the server saw it. */
  outcome: 'answered' | 'aborted';
}

export interface IdentityApiMock {
  /** The address that opens the first step of the page (the data of the guest). */
  readonly link: string;
  /** The address that opens the identity step straight (what the QR code of the door leads to). */
  readonly entry: string;
  /** The calls of the page to the link, in the order they arrived: all of them, or those of one endpoint. */
  calls: (endpoint?: string) => IdentityCall[];
  /** The tokens of the challenges issued so far, in order. */
  challenges: () => string[];
}

interface Part {
  name: string;
  filename: string | null;
  content: Buffer;
}

/**
 * The boundary of a `multipart/form-data` body, or `null` for a body that is not one. The header names it (the browser adds it when it sends a form); a body that begins with a boundary line is one even
 * when the header is not among the ones the test runner hands over.
 */
function boundaryOf(body: Buffer, contentType: string): string | null {
  const named = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const fromHeader = named?.[1] ?? named?.[2];
  if (fromHeader) return fromHeader;
  return /^--([^\r\n]+)\r\n/.exec(body.subarray(0, 200).toString('latin1'))?.[1] ?? null;
}

/** The parts of a `multipart/form-data` body. Binary safe: the content of a part is a slice of the body. */
function partsOf(body: Buffer, boundary: string): Part[] {
  const marker = Buffer.from(`--${boundary}`);
  const parts: Part[] = [];
  let at = body.indexOf(marker);
  while (at !== -1) {
    const start = at + marker.length;
    // `--` straight after a boundary is the end of the body.
    if (body.subarray(start, start + 2).toString('latin1') === '--') break;
    const next = body.indexOf(marker, start);
    if (next === -1) break;

    // After the boundary come a line break, the headers, an empty line and the content, which ends with a line break of its own.
    const chunk = body.subarray(start + 2, next - 2);
    const headerEnd = chunk.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headers = chunk.subarray(0, headerEnd).toString('latin1');
      const partName = /\bname="([^"]*)"/i.exec(headers)?.[1];
      if (partName !== undefined) {
        parts.push({ name: partName, filename: /\bfilename="([^"]*)"/i.exec(headers)?.[1] ?? null, content: chunk.subarray(headerEnd + 4) });
      }
    }
    at = next;
  }
  return parts;
}

/** What the mock writes down of a request, the moment it arrives. */
function writeDown(request: Request, endpoint: string): IdentityCall {
  const headers = request.headers();
  const call: IdentityCall = {
    endpoint,
    method: request.method(),
    search: new URL(request.url()).search,
    headers,
    parts: {},
    fields: {},
    json: undefined,
    picturesAreJpeg: true,
    framesDigest: null,
    outcome: 'answered',
  };

  const body = request.postDataBuffer();
  if (!body) return call;

  const contentType = headers['content-type'] ?? '';
  const boundary = boundaryOf(body, contentType);
  if (boundary !== null) {
    const frames = createHash('sha256');
    let sawFrames = false;
    for (const part of partsOf(body, boundary)) {
      call.parts[part.name] = (call.parts[part.name] ?? 0) + 1;
      if (part.filename === null) {
        call.fields[part.name] = part.content.toString('utf8');
        continue;
      }
      // A picture: a JPEG begins with the bytes FF D8. A fixture file of a proof that is not a JPEG says so here. A part that comes with no bytes says nothing: how much of a blob the test runner hands over is its business.
      if (part.content.length >= 2 && (part.content[0] !== 0xff || part.content[1] !== 0xd8)) call.picturesAreJpeg = false;
      if (part.name === 'frames') {
        frames.update(part.content);
        sawFrames = true;
      }
    }
    call.framesDigest = sawFrames ? frames.digest('hex') : null;
  } else if (contentType.includes('json')) {
    try {
      call.json = JSON.parse(body.toString('utf8'));
    } catch {
      call.json = undefined;
    }
  }
  return call;
}

/** The state of the verification at a step of the flow, as the link carries it. */
function stateAt(stage: 'consent' | 'document' | 'presence'): IdentityVerificationState {
  const afterDocument = stage === 'presence';
  return {
    step: stage,
    result: null,
    biometricOffered: true,
    consentRecorded: stage !== 'consent',
    consentRefused: false,
    documentChecked: afterDocument,
    attemptsRemaining: 3,
    operatorRequested: false,
    operatorPathOpen: true,
    documentNotArchived: false,
    verifyingGuestPosition: 0,
    documentSides: afterDocument ? ['front', 'back'] : [],
    documentSideNeeded: null,
    selfHosted: true,
    opened: stage !== 'consent',
    noticeVersion: stage === 'consent' ? null : CONSENT_VERSION,
    choice: stage === 'consent' ? null : 'automatic',
    formatId: afterDocument ? 'cie' : null,
    guidedRetryAvailable: true,
    closed: false,
    outcome: null,
  };
}

/** The legal text of the consent the registry serves: a fixture, not the text of the product (the product's is the registry's, and the page has none of its own). */
const CONSENT_TEXT: CheckInLegalTextsResponse = {
  language: 'it',
  texts: [
    {
      kind: 'biometric-consent',
      version: CONSENT_VERSION,
      language: 'it',
      isDraft: false,
      contentHtml: '<h3>Testo di prova del consenso</h3><p>Questo testo esiste solo nella prova automatica: la pagina mostra quello che il registro serve.</p>',
    },
  ],
};

/** What a read of the front of a card gives, for the proof of the data step: values of a person who does not exist. */
const READING: CheckInDocumentReadResult = {
  read: true,
  side: 'front',
  guestPosition: 0,
  confirmGuest: false,
  source: 'local',
  fields: [
    { name: 'birthDate', value: '1992-05-15', side: 'front', zone: 'birthDate', confidence: 0.94, source: 'viz' },
    { name: 'documentNumber', value: 'CA00000AA', side: 'front', zone: 'documentNumber', confidence: 0.97, source: 'viz' },
    { name: 'expiryDate', value: '2032-03-11', side: 'front', zone: 'expiryDate', confidence: 0.96, source: 'viz' },
  ],
  missing: ['birthPlace', 'citizenship'],
  guest: { firstName: 'Luca', lastName: 'Rossi', dateOfBirth: '1992-05-15', documentKind: 'IdentityCard', documentNumber: 'CA00000AA', documentExpiresOn: '2032-03-11' },
};

/**
 * Answers every call of the identity step of one link, and writes each one down. Register it before the first `goto`. `GET /api/public/features` is answered with the flags on; the legacy selfie routes are
 * answered 404 (and recorded: a proof of the self-hosted path expects none).
 */
export async function mockIdentityApi(page: Page, options: IdentityMockOptions = {}): Promise<IdentityApiMock> {
  const script: PresenceStep[] = options.presence && options.presence.length > 0 ? options.presence : ['ok'];
  const base = `/api/public/checkin/${TOKEN}`;

  const calls: IdentityCall[] = [];
  const issued: string[] = [];
  let state = stateAt(options.startAt ?? 'consent');
  let presenceCalls = 0;
  let documentCalls = 0;
  let refusalPending = options.refuseFirstDocument;

  const change = (patch: Partial<IdentityVerificationState>) => {
    state = { ...state, ...patch };
  };
  const snapshot = (): IdentityVerificationState => ({ ...state });
  /** The verification ends with a person: the guest asked for one, or the server sent the case there. */
  const withAPerson = () =>
    change({ step: 'operator', result: 'operator', operatorRequested: true, biometricOffered: false, closed: true, outcome: 'operator' });

  const context = (): PublicCheckInContextDto => ({
    completed: false,
    status: 'InCompilazione',
    sessionId: '11111111-1111-4111-8111-111111111111',
    propertyName: 'Villa Demo',
    checkInDate: '2027-07-10T00:00:00Z',
    checkOutDate: '2027-07-12T00:00:00Z',
    declaredGuests: 1,
    guests: [{ type: 'SingleGuest', firstName: 'Luca', lastName: 'Rossi', birthComuneName: '', birthCountryName: '', citizenshipName: '', documentIssuePlaceName: '' }],
    availableCodeTables: [],
    privacyNoticeVersion: 'v1',
    privacyNoticeOrgSlug: 'demo',
    orgSlug: 'demo',
    marketingConsentVersion: 'v1',
    language: 'it',
    supportedLanguages: ['it', 'en', 'de', 'fr', 'es'],
    documentNotArchived: false,
    identityVerification: snapshot(),
  });

  const challenge = (): PresenceChallenge => {
    const challengeToken = `challenge-${issued.length + 1}`;
    issued.push(challengeToken);
    return {
      challengeToken,
      steps: [...PRESENCE_PLAN.steps],
      stepMs: PRESENCE_PLAN.stepMs,
      leadInMs: PRESENCE_PLAN.leadInMs,
      // Far beyond the length of the recording: the challenge never runs out under the proof.
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      targetFps: 8,
      maxFrames: 40,
      // Small frames: the proof is about the sequence and not about the pictures, and a recording of a couple of dozen of them stays a few tens of kilobytes.
      maxFrameSide: 160,
    };
  };

  await page.route('**/api/public/features', async (route) => {
    await route.fulfill({ json: FEATURES });
  });

  await page.route(
    (url) => url.pathname === base || url.pathname.startsWith(`${base}/`),
    async (route) => {
      const request = route.request();
      const endpoint = new URL(request.url()).pathname.slice(base.length).replace(/^\//, '') || 'context';
      // Written down before anything is awaited: two calls that arrive together are in the order they arrived.
      const call = writeDown(request, endpoint);
      calls.push(call);
      const method = request.method();
      const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
      const problem = (status: number, code: string, extra: object = {}) => reply({ status, code, ...extra }, status);

      if (method === 'GET' && endpoint === 'context') return reply(context());
      if (method === 'GET' && endpoint === 'legal-texts') return reply(CONSENT_TEXT);

      if (method === 'POST' && endpoint === 'identity/open') {
        const version = (call.json as { noticeVersion?: string } | undefined)?.noticeVersion;
        if (version !== CONSENT_VERSION) return problem(422, 'notice_version_unknown');
        change({ opened: true, noticeVersion: version });
        const answer: IdentityOpenResponse = { state: snapshot() };
        return reply(answer);
      }

      if (method === 'POST' && endpoint === 'biometric-consent') {
        const body = call.json as { consentGiven?: boolean; consentVersion?: string } | undefined;
        if (body?.consentGiven === true && body.consentVersion !== CONSENT_VERSION) return problem(400, 'biometric_consent_version_unknown');
        if (body?.consentGiven === true) {
          change({ step: 'document', consentRecorded: true, choice: 'automatic' });
          const answer: BiometricConsentResponse = { consentRecorded: true, result: 'consent_recorded', biometricOffered: true, operatorPathOpen: true, state: snapshot() };
          return reply(answer);
        }
        change({ consentRefused: true, choice: 'assisted' });
        withAPerson();
        const answer: BiometricConsentResponse = { consentRecorded: false, result: 'operator', biometricOffered: false, operatorPathOpen: true, state: snapshot() };
        return reply(answer);
      }

      if (method === 'POST' && endpoint === 'read-document') {
        return reply(READING);
      }

      if (method === 'POST' && endpoint === 'document') {
        documentCalls += 1;
        if (options.documentDelayMs) await new Promise((resolve) => setTimeout(resolve, options.documentDelayMs));
        const side = call.fields.side === 'back' ? 'back' : 'front';
        if (refusalPending && documentCalls === 1) {
          const guidanceCodes = refusalPending;
          refusalPending = undefined;
          const answer: IdentityDocumentResponse = { success: true, acceptable: false, guidanceCodes, documentStored: false, documentNotArchived: false, side, sides: [] };
          return reply(answer);
        }
        if (side === 'front') {
          // The Italian electronic identity card: the face is on the front, the lines of letters on the back, and the answer asks for the back.
          change({ documentSides: ['front'], documentSideNeeded: 'back', formatId: 'cie' });
          const answer: IdentityDocumentResponse = { success: true, acceptable: false, guidanceCodes: ['document_back_needed'], documentStored: true, documentNotArchived: false, side, sides: ['front'] };
          return reply(answer);
        }
        change({ step: 'presence', documentChecked: true, documentSides: ['front', 'back'], documentSideNeeded: null });
        const answer: IdentityDocumentResponse = { success: true, acceptable: true, guidanceCodes: [], documentStored: true, documentNotArchived: false, side, sides: ['front', 'back'] };
        return reply(answer);
      }

      if (method === 'POST' && endpoint === 'presence-challenge') {
        return reply(challenge());
      }

      if (method === 'POST' && endpoint === 'presence') {
        const step = script[Math.min(presenceCalls, script.length - 1)];
        presenceCalls += 1;
        if (step === 'abort') {
          // The connection breaks before the server has seen the recording: nothing was decided.
          call.outcome = 'aborted';
          return route.abort('failed');
        }
        if (step === 'retry') {
          change({ result: 'retry', guidedRetryAvailable: false });
          const answer: IdentityPresenceResponse = { result: 'retry', guidance: ['presence_challenge_not_followed'], guidedRetryAvailable: false, state: snapshot() };
          return reply(answer);
        }
        if (step === 'operator') {
          withAPerson();
          const answer: IdentityPresenceResponse = { result: 'operator', guidance: [], guidedRetryAvailable: false, state: snapshot() };
          return reply(answer);
        }
        change({ step: 'done', result: 'ok', closed: true, outcome: 'ok' });
        const answer: IdentityPresenceResponse & { lockCode: string } = { result: 'ok', guidance: [], guidedRetryAvailable: false, state: snapshot(), lockCode: LOCK_CODE };
        return reply(answer);
      }

      if (method === 'POST' && endpoint === 'request-operator') {
        withAPerson();
        const answer: IdentityOperatorResponse = { result: 'operator', operatorPathOpen: true, state: snapshot() };
        return reply(answer);
      }

      // Anything else (the selfie of the legacy path included) is a call the self-hosted flow does not make: it is written down and refused.
      return problem(404, 'not_found');
    },
  );

  return {
    link: `/checkin/${TOKEN}`,
    entry: `/checkin/${TOKEN}?step=identity`,
    calls: (endpoint) => (endpoint === undefined ? [...calls] : calls.filter((call) => call.endpoint === endpoint)),
    challenges: () => [...issued],
  };
}
