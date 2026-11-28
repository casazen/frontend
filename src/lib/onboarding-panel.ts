import { ONBOARDING_PLAN_PATH } from '@/lib/onboarding-parts';
import type {
  AssistOutcome,
  AssistRequest,
  AssistRequestContext,
  OnboardingNeedCode,
  OnboardingPartKey,
  PanelStep,
  PanelStepKind,
} from '@/types/onboarding.types';

export const PANEL_STEP_PATH = `${ONBOARDING_PLAN_PATH}/panel`;

export const PANEL_STEP_ROUTE = `${PANEL_STEP_PATH}/:kind`;

export const PANEL_KIND_SLUGS = ['police', 'istat', 'channel-access'] as const;
export type PanelKindSlug = (typeof PANEL_KIND_SLUGS)[number];

const KIND_BY_SLUG: Readonly<Record<PanelKindSlug, PanelStepKind>> = {
  police: 'policeConnection',
  istat: 'istatConnection',
  'channel-access': 'channelAccess',
};

const SLUG_BY_KIND: Readonly<Record<PanelStepKind, PanelKindSlug>> = {
  policeConnection: 'police',
  istatConnection: 'istat',
  channelAccess: 'channel-access',
};

export function panelKindOfSlug(slug: string | undefined): PanelStepKind | undefined {
  return slug !== undefined && Object.hasOwn(KIND_BY_SLUG, slug) ? KIND_BY_SLUG[slug as PanelKindSlug] : undefined;
}

export function isPanelStepKind(value: unknown): value is PanelStepKind {
  return typeof value === 'string' && Object.hasOwn(SLUG_BY_KIND, value);
}

export type PanelTextKind = 'police' | 'istat' | 'channelAccess';

const TEXT_KIND: Readonly<Record<PanelStepKind, PanelTextKind>> = {
  policeConnection: 'police',
  istatConnection: 'istat',
  channelAccess: 'channelAccess',
};

export const panelTextKind = (kind: PanelStepKind): PanelTextKind => TEXT_KIND[kind];

export const PANEL_INSTRUCTION_COUNTS: Readonly<Record<PanelTextKind, number>> = { police: 5, istat: 4, channelAccess: 4 };

const PART_OF_KIND: Readonly<Record<PanelStepKind, OnboardingPartKey>> = {
  policeConnection: 'compliance',
  istatConnection: 'compliance',
  channelAccess: 'channels',
};

export const panelPartOf = (kind: PanelStepKind): OnboardingPartKey => PART_OF_KIND[kind];

const NEED_OF_KIND: Readonly<Record<PanelStepKind, OnboardingNeedCode>> = {
  policeConnection: 'alloggiatiCredentials',
  istatConnection: 'istatCredentials',
  channelAccess: 'otaAccess',
};

export const panelNeedOf = (kind: PanelStepKind): OnboardingNeedCode => NEED_OF_KIND[kind];

const ASSIST_CONTEXT_OF_KIND: Readonly<Record<PanelStepKind, AssistRequestContext>> = {
  policeConnection: 'panelPolice',
  istatConnection: 'panelIstat',
  channelAccess: 'panelChannelAccess',
};

export const panelAssistContext = (kind: PanelStepKind): AssistRequestContext => ASSIST_CONTEXT_OF_KIND[kind];

export interface PanelStepTarget {
  kind: PanelStepKind;
  propertyId?: string | null;
  channelCode?: string | null;
  assist?: boolean;
}

/** The address of the page of a step, `/app/short-rent/onboarding/panel/police?propertyId=…`: the query carries ids only, never a person or a credential. */
export function panelStepPath(target: PanelStepTarget): string {
  const query = new URLSearchParams();
  if (target.propertyId) query.set('propertyId', target.propertyId);
  if (target.channelCode) query.set('channelCode', target.channelCode);
  if (target.assist) query.set('assist', '1');
  const search = query.toString();
  return `${PANEL_STEP_PATH}/${SLUG_BY_KIND[target.kind]}${search ? `?${search}` : ''}`;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isStepId = (value: string | null | undefined): value is string => typeof value === 'string' && GUID.test(value);

const STATE_MAX_LENGTH = 128;

export interface PanelStepCallback {
  stepId: string;
  state: string;
}

/**
 * What the address brings back from a panel that sends the person back (`?step=<id>&state=<state>`), or `null` when it is no callback. The state
 * is a single-use secret: the page takes it out of the address at once (it never stays in the history or in a reload) and sends it in the body.
 */
export function readPanelStepCallback(params: URLSearchParams): PanelStepCallback | null {
  const stepId = params.get('step')?.trim();
  const state = params.get('state')?.trim();
  return isStepId(stepId) && state && state.length <= STATE_MAX_LENGTH ? { stepId, state } : null;
}

export function withoutPanelStepCallback(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete('step');
  next.delete('state');
  return next;
}

export function findPanelStep(steps: readonly PanelStep[] | undefined, target: PanelStepTarget): PanelStep | undefined {
  return steps?.find(
    (step) =>
      step.kind === target.kind &&
      (step.propertyId ?? null) === (target.propertyId ?? null) &&
      (step.channelCode ?? null) === (target.channelCode ?? null),
  );
}

export function isPanelStepDone(step: Pick<PanelStep, 'status'> | null | undefined): boolean {
  return step?.status === 'verified' || step?.status === 'confirmed';
}

export function isPanelStepOpen(step: Pick<PanelStep, 'status'> | null | undefined): boolean {
  return step?.status === 'started' || step?.status === 'notValid';
}

export function isUnverifiable(step: Pick<PanelStep, 'status' | 'lastVerificationOutcome' | 'canConfirm'> | null | undefined): boolean {
  return step?.status === 'started' && step.lastVerificationOutcome === 'unverifiable' && step.canConfirm === true;
}

export type HandoffPhase = 'explain' | 'started' | 'waiting' | 'recovered' | 'unverifiable' | 'notValid' | 'assist';

export interface HandoffLocalState {
  launched: boolean;
  blocked: boolean;
  ended: boolean;
}

/**
 * The state of the screen: the server's step decides, this page only adds what it did. The person is asked to confirm only when the server says
 * it cannot tell (`unverifiable` and `canConfirm`) AND the person is back from the panel: its window closed or its tab came back to the front, or
 * this page never opened a window (it was reached again later, from the plan or from «Da fare»). A confirmation is never the default path.
 */
export function handoffPhase(step: PanelStep | null | undefined, local: HandoffLocalState): HandoffPhase {
  if (!step) return 'explain';
  if (isPanelStepDone(step)) return 'recovered';
  if (step.status === 'assistRequested') return 'assist';
  if (step.status === 'notValid') return 'notValid';
  if (isUnverifiable(step) && (local.ended || !local.launched)) return 'unverifiable';
  return local.blocked ? 'started' : 'waiting';
}

export const MIN_POLL_MS = 3_000;
export const MAX_POLL_MS = 600_000;
const DEFAULT_POLL_MS = 15_000;

/**
 * How long to wait before reading a step again, or `false` when there is nothing to wait for. The server says when its next check is due
 * (`nextCheckAt`, a wait that doubles up to ten minutes: reading the step runs the check only when it is due, so the page never burns the quota
 * of the channel manager) and the page follows it, never faster than {@link MIN_POLL_MS}. A step that is done, handed to support or found not
 * valid with no schedule is not read again by itself.
 */
export function nextPollDelayMs(step: PanelStep | null | undefined, now: number): number | false {
  if (!step || !isPanelStepOpen(step)) return false;
  const due = step.nextCheckAt ? Date.parse(step.nextCheckAt) : Number.NaN;
  if (!Number.isFinite(due)) return step.status === 'started' ? DEFAULT_POLL_MS : false;
  return Math.min(Math.max(due - now, MIN_POLL_MS), MAX_POLL_MS);
}

export function isHttpsAddress(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export const PANEL_WINDOW_NAME = 'casazen-channel-manager-panel';

/**
 * Opens the secondary window of the panel. It must run synchronously inside the click of the person (a popup blocker lets only that through):
 * the window opens blank and is sent to the address the server returns only once the step is stored (`navigatePanelWindow`). `opener` is cleared
 * so the page of the panel can never reach back to CasaZen. `null` when the browser blocked it.
 */
export function openPanelWindow(): Window | null {
  const opened = window.open('', PANEL_WINDOW_NAME);
  if (!opened) return null;
  try {
    opened.opener = null;
  } catch {
    // A window that does not let its opener go is still the one we manage.
  }
  return opened;
}

export function navigatePanelWindow(target: Window, address: string): void {
  target.location.href = address;
  try {
    target.focus();
  } catch {
    // Focusing is a courtesy.
  }
}

export function isPanelWindowOpen(target: Window | null | undefined): target is Window {
  if (!target) return false;
  try {
    return !target.closed;
  } catch {
    return false;
  }
}

export function findOpenAssist(
  requests: readonly AssistRequest[] | undefined,
  context: AssistRequestContext,
  propertyId?: string | null,
  channelCode?: string | null,
): AssistRequest | undefined {
  return requests?.find(
    (request) =>
      request.context === context &&
      (request.propertyId ?? null) === (propertyId ?? null) &&
      (request.channelCode ?? null) === (channelCode ?? null) &&
      (request.status === 'Requested' || request.status === 'InProgress'),
  );
}

function closedAt(request: Pick<AssistRequest, 'completedAt' | 'updatedAt'>): number {
  const at = Date.parse(request.completedAt ?? request.updatedAt);
  return Number.isFinite(at) ? at : 0;
}

export function findDoneAssist(
  requests: readonly AssistRequest[] | undefined,
  context: AssistRequestContext,
  propertyId?: string | null,
  channelCode?: string | null,
): AssistRequest | undefined {
  return requests
    ?.filter(
      (request) =>
        request.context === context &&
        (request.propertyId ?? null) === (propertyId ?? null) &&
        (request.channelCode ?? null) === (channelCode ?? null) &&
        request.status === 'Done',
    )
    .sort((first, second) => closedAt(second) - closedAt(first))[0];
}

/**
 * What a request that is done tells the host: `verified` only when the server says CasaZen read the connection on the panel. Anything else (`declared`, a request closed before
 * the outcome was recorded, a word this version does not know) is the support's word and is shown as that, never as a check CasaZen did: a state that is not checked is never
 * shown as checked.
 */
export function assistOutcomeOf(request: Pick<AssistRequest, 'outcome'>): AssistOutcome {
  return request.outcome === 'verified' ? 'verified' : 'declared';
}
