import { ONBOARDING_PLAN_PATH } from '@/lib/onboarding-parts';
import type {
  AssistRequest,
  AssistRequestContext,
  OnboardingNeedCode,
  OnboardingPartKey,
  PanelStep,
  PanelStepKind,
} from '@/types/onboarding.types';

/**
 * The guided steps of the panel of the channel manager (E10/F03/US02/T01, NF-107): the kinds of step in the address of the page, what each one
 * belongs to, the window CasaZen opens for it and the rhythm at which it reads the result. The screens (`OctoratePanelStep`, the channel access of
 * the import wizard) read it, so a step is named in one place.
 */

/** The page of a guided step: `/app/short-rent/onboarding/panel/:kind` (behind the flag `octorateOnboarding`). */
export const PANEL_STEP_PATH = `${ONBOARDING_PLAN_PATH}/panel`;

/** The route pattern the manifest registers (the `:kind` is one of {@link PANEL_KIND_SLUGS}). */
export const PANEL_STEP_ROUTE = `${PANEL_STEP_PATH}/:kind`;

/** The kinds of step as the address spells them. */
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

/** The kind an address names, or `undefined` for anything else (an unknown word is no kind: the page leads back to the plan). */
export function panelKindOfSlug(slug: string | undefined): PanelStepKind | undefined {
  return slug !== undefined && Object.hasOwn(KIND_BY_SLUG, slug) ? KIND_BY_SLUG[slug as PanelKindSlug] : undefined;
}

/** The kind a guided step the server stores has, when this version of the app knows it. */
export function isPanelStepKind(value: unknown): value is PanelStepKind {
  return typeof value === 'string' && Object.hasOwn(SLUG_BY_KIND, value);
}

/** The name the texts of a kind are under (`onboardingPlan.panel.<kind>.*`) and the key of its images. */
export type PanelTextKind = 'police' | 'istat' | 'channelAccess';

const TEXT_KIND: Readonly<Record<PanelStepKind, PanelTextKind>> = {
  policeConnection: 'police',
  istatConnection: 'istat',
  channelAccess: 'channelAccess',
};

export const panelTextKind = (kind: PanelStepKind): PanelTextKind => TEXT_KIND[kind];

/** How many numbered instructions each kind has: `onboardingPlan.panel.<kind>.steps.1` to `.steps.<n>` and the same for the `alts`. */
export const PANEL_INSTRUCTION_COUNTS: Readonly<Record<PanelTextKind, number>> = { police: 5, istat: 4, channelAccess: 4 };

/** The part of the plan a kind belongs to (the same the backend gives it): where the person goes once the step is done. */
const PART_OF_KIND: Readonly<Record<PanelStepKind, OnboardingPartKey>> = {
  policeConnection: 'compliance',
  istatConnection: 'compliance',
  channelAccess: 'channels',
};

export const panelPartOf = (kind: PanelStepKind): OnboardingPartKey => PART_OF_KIND[kind];

/** What the person should have at hand for a kind: one of the five things «What you need» of the plan lists. */
const NEED_OF_KIND: Readonly<Record<PanelStepKind, OnboardingNeedCode>> = {
  policeConnection: 'alloggiatiCredentials',
  istatConnection: 'istatCredentials',
  channelAccess: 'otaAccess',
};

export const panelNeedOf = (kind: PanelStepKind): OnboardingNeedCode => NEED_OF_KIND[kind];

/** The context of the «Do it for me» request that stands for a kind (what the backend calls `instructionsKey` too). */
const ASSIST_CONTEXT_OF_KIND: Readonly<Record<PanelStepKind, AssistRequestContext>> = {
  policeConnection: 'panelPolice',
  istatConnection: 'panelIstat',
  channelAccess: 'panelChannelAccess',
};

export const panelAssistContext = (kind: PanelStepKind): AssistRequestContext => ASSIST_CONTEXT_OF_KIND[kind];

/** What the address of the page says about the step: the property and the channel it is about. */
export interface PanelStepTarget {
  kind: PanelStepKind;
  propertyId?: string | null;
  channelCode?: string | null;
}

/** The address of the page of a step, `/app/short-rent/onboarding/panel/police?propertyId=…`: the query carries ids only, never a person or a credential. */
export function panelStepPath(target: PanelStepTarget): string {
  const query = new URLSearchParams();
  if (target.propertyId) query.set('propertyId', target.propertyId);
  if (target.channelCode) query.set('channelCode', target.channelCode);
  const search = query.toString();
  return `${PANEL_STEP_PATH}/${SLUG_BY_KIND[target.kind]}${search ? `?${search}` : ''}`;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for the id of a step as the server writes it. */
export const isStepId = (value: string | null | undefined): value is string => typeof value === 'string' && GUID.test(value);

/** The longest `state` the server compares: a longer one is refused without being read. */
const STATE_MAX_LENGTH = 128;

/** What the panel brings back when it sends the person to CasaZen (`redirectCallback`): the step and the single-use state of the hand-over. */
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

/** The query of the page without the callback: a copy, the one it was given is not changed. */
export function withoutPanelStepCallback(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete('step');
  next.delete('state');
  return next;
}

/** The step the server stores for this target, if any: one row for each kind, property and channel. */
export function findPanelStep(steps: readonly PanelStep[] | undefined, target: PanelStepTarget): PanelStep | undefined {
  return steps?.find(
    (step) =>
      step.kind === target.kind &&
      (step.propertyId ?? null) === (target.propertyId ?? null) &&
      (step.channelCode ?? null) === (target.channelCode ?? null),
  );
}

/** A step that is done: seen by CasaZen (`verified`) or confirmed by the person after CasaZen could not tell. */
export function isPanelStepDone(step: Pick<PanelStep, 'status'> | null | undefined): boolean {
  return step?.status === 'verified' || step?.status === 'confirmed';
}

/** A step CasaZen still follows: started (the person is on the panel) or found not valid (the person has to do it again). */
export function isPanelStepOpen(step: Pick<PanelStep, 'status'> | null | undefined): boolean {
  return step?.status === 'started' || step?.status === 'notValid';
}

/** The result CasaZen cannot tell by itself: the only case in which the person is asked whether it is done. */
export function isUnverifiable(step: Pick<PanelStep, 'status' | 'lastVerificationOutcome' | 'canConfirm'> | null | undefined): boolean {
  return step?.status === 'started' && step.lastVerificationOutcome === 'unverifiable' && step.canConfirm === true;
}

/**
 * The five durable states of a guided step on one screen (UX-02 point 3), plus the two the server can put it in: the person has not opened the panel
 * yet (`explain`), the panel could not be opened (`started`: stored, waiting for the browser to allow it), CasaZen follows the step on the panel
 * (`waiting`), the step is done (`recovered`), CasaZen cannot tell and asks (`unverifiable`), the check found it not valid (`notValid`) and support is
 * doing it (`assist`).
 */
export type HandoffPhase = 'explain' | 'started' | 'waiting' | 'recovered' | 'unverifiable' | 'notValid' | 'assist';

/** What only this page knows: whether it opened the window, whether the browser blocked it, whether the person left the panel. */
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

/** The least and the most the page waits before it reads the step again; without a schedule from the server it reads every 15 seconds. */
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

/** An address the panel is opened at: https only, whatever the answer says. */
export function isHttpsAddress(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** The name of the window CasaZen opens for the panel: one window, found again by its name when the person asks to open it once more. */
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

/**
 * Sends the window to the address the server returned, exactly as it came (nothing is appended: no organization, property or person), and
 * brings it to the front. The page of another origin is never read: only the address is written and `closed` is asked.
 */
export function navigatePanelWindow(target: Window, address: string): void {
  target.location.href = address;
  try {
    target.focus();
  } catch {
    // Focusing is a courtesy.
  }
}

/** True while the window opened for the panel is still open (`closed` is readable across origins). */
export function isPanelWindowOpen(target: Window | null | undefined): target is Window {
  if (!target) return false;
  try {
    return !target.closed;
  } catch {
    return false;
  }
}

/** The request of the «Do it for me» for a step that is still open (`Requested` or `InProgress`), if the host has one. */
export function findOpenAssist(
  requests: readonly AssistRequest[] | undefined,
  context: AssistRequestContext,
  propertyId?: string | null,
): AssistRequest | undefined {
  return requests?.find(
    (request) =>
      request.context === context &&
      (request.propertyId ?? null) === (propertyId ?? null) &&
      (request.status === 'Requested' || request.status === 'InProgress'),
  );
}
