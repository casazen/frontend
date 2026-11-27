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

const CONSENT_VERSION = 'checkin-biometric-e2e-1';

export const LOCK_CODE = '482913';

// Short on purpose: the recordings are real and last as long as the prompts.
export const PRESENCE_PLAN = { leadInMs: 600, stepMs: 700, steps: ['turn_left', 'look_up'] } as const satisfies Pick<PresenceChallenge, 'leadInMs' | 'stepMs' | 'steps'>;

const FEATURES = {
  otaPartnerApi: false,
  checkInIdentityVerification: true,
  checkInIdentitySelfHosted: true,
  checkInIdentityAutoApproval: true,
  checkInIdentityReviewEvidence: true,
};

type PresenceStep = 'ok' | 'retry' | 'operator' | 'abort';

const TOKEN = 'identity-e2e-session';

export interface IdentityMockOptions {
  startAt?: 'consent' | 'document' | 'presence';
  presence?: PresenceStep[];
  refuseFirstDocument?: string[];
  documentDelayMs?: number;
}

export interface IdentityCall {
  endpoint: string;
  method: string;
  search: string;
  headers: Record<string, string>;
  parts: Record<string, number>;
  fields: Record<string, string>;
  json: unknown;
  picturesAreJpeg: boolean;
  framesDigest: string | null;
  outcome: 'answered' | 'aborted';
}

export interface IdentityApiMock {
  readonly link: string;
  readonly entry: string;
  calls: (endpoint?: string) => IdentityCall[];
  challenges: () => string[];
}

interface Part {
  name: string;
  filename: string | null;
  content: Buffer;
}

function boundaryOf(body: Buffer, contentType: string): string | null {
  const named = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const fromHeader = named?.[1] ?? named?.[2];
  if (fromHeader) return fromHeader;
  // The runner may not hand over the content-type header: a multipart body starts with its boundary line.
  return /^--([^\r\n]+)\r\n/.exec(body.subarray(0, 200).toString('latin1'))?.[1] ?? null;
}

function partsOf(body: Buffer, boundary: string): Part[] {
  const marker = Buffer.from(`--${boundary}`);
  const parts: Part[] = [];
  let at = body.indexOf(marker);
  while (at !== -1) {
    const start = at + marker.length;
    if (body.subarray(start, start + 2).toString('latin1') === '--') break;
    const next = body.indexOf(marker, start);
    if (next === -1) break;

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
      // A part that arrives with no bytes proves nothing: how much of a blob the runner hands over is not ours to judge.
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

// Fixture text, not a legal text: the page shows whatever the registry serves.
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

// A person who does not exist.
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
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      targetFps: 8,
      maxFrames: 40,
      // Small frames keep the multipart body of a recording small.
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
      // Written down before anything is awaited, so that calls keep their order of arrival.
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
        if (body?.consentGiven === true && body.consentVersion !== CONSENT_VERSION) return problem(422, 'biometric_consent_version_unknown');
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
          // Italian electronic identity card: the face is on the front, the lines of letters on the back, and the answer asks for the back.
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
          // The connection breaks before the server sees the recording: nothing is decided.
          call.outcome = 'aborted';
          return route.abort('failed');
        }
        if (step === 'retry') {
          // The server answers a retry with guidedRetryAvailable true (this answer offers it) while the state says the one retry is now used.
          change({ result: 'retry', guidedRetryAvailable: false });
          const answer: IdentityPresenceResponse = { result: 'retry', guidance: ['presence_challenge_not_followed'], guidedRetryAvailable: true, state: snapshot() };
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

      // Anything else (the legacy selfie routes included) is refused and recorded, so that a proof can assert there was none.
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
