import { billingItemTextKey, isBillingItemKey } from '@/lib/onboarding-billing';
import { addDays, romeWallTimeToUtc, todayInRome } from '@/lib/stay-dates';
import { GUEST_REGISTRATION_MISSING_CODES } from '@/types/guest-registration.types';
import {
  ONBOARDING_NEED_CODES,
  ONBOARDING_PART_KEYS,
  ONBOARDING_PART_REASONS,
  ONBOARDING_PART_STATES,
  ONBOARDING_PATH_STEP_CODES,
  type OnboardingNeedCode,
  type OnboardingPart,
  type OnboardingPartKey,
  type OnboardingPartMissing,
  type OnboardingPartReason,
  type OnboardingPartState,
  type OnboardingPath,
  type OnboardingPathStep,
  type OnboardingPathStepCode,
  type OnboardingPlan,
} from '@/types/onboarding.types';

export const ONBOARDING_PLAN_PATH = '/app/short-rent/onboarding';

export const ONBOARDING_BULK_PATH = `${ONBOARDING_PLAN_PATH}/bulk`;

export const BULK_OFFER_ABOVE = 10;

export function partPath(key: OnboardingPartKey): string {
  return `${ONBOARDING_PLAN_PATH}/parts/${key}`;
}

export type OnboardingPartIconName =
  | 'Link2'
  | 'Home'
  | 'Share2'
  | 'ListChecks'
  | 'Tag'
  | 'ShieldCheck'
  | 'IdCard'
  | 'MessageSquare'
  | 'Receipt'
  | 'Store'
  | 'Landmark'
  | 'Rocket';

export const ONBOARDING_PART_ICONS: Record<OnboardingPartKey, OnboardingPartIconName> = {
  octorateConnection: 'Link2',
  properties: 'Home',
  channels: 'Share2',
  listings: 'ListChecks',
  pricesRules: 'Tag',
  compliance: 'ShieldCheck',
  identification: 'IdCard',
  messagesAi: 'MessageSquare',
  fiscalDocuments: 'Receipt',
  partners: 'Store',
  guestRegistration: 'Landmark',
  activation: 'Rocket',
};

export const partTitleKey = (key: OnboardingPartKey) => `onboardingPlan.parts.${key}.title`;
export const partWhatKey = (key: OnboardingPartKey) => `onboardingPlan.parts.${key}.what`;
export const needKey = (code: OnboardingNeedCode) => `onboardingPlan.needs.${code}`;
export const reasonKey = (code: OnboardingPartReason) => `onboardingPlan.reasons.${code}`;
export const stateKey = (state: OnboardingPartState) => `onboardingPlan.states.${state}`;

const PART_KEYS: ReadonlySet<string> = new Set(ONBOARDING_PART_KEYS);
const PART_STATES: ReadonlySet<string> = new Set(ONBOARDING_PART_STATES);
const PART_REASONS: ReadonlySet<string> = new Set(ONBOARDING_PART_REASONS);
const NEED_CODES: ReadonlySet<string> = new Set(ONBOARDING_NEED_CODES);

export function isOnboardingPartKey(value: unknown): value is OnboardingPartKey {
  return typeof value === 'string' && PART_KEYS.has(value);
}

export function isOnboardingPartReason(value: unknown): value is OnboardingPartReason {
  return typeof value === 'string' && PART_REASONS.has(value);
}

/**
 * The key of the text that says why a part is not done, or `null` when this version has none for the reason it carries (the part then reads as a neutral line, never as the
 * code). The reason of the part «Fatturazione» is the key of an item of the billing setup, which has its own texts (`billingWizard.items.*`); any other part carries one of its
 * `OnboardingPartReasons`.
 */
export function partReasonTextKey(part: Pick<OnboardingPart, 'code' | 'reason'>): string | null {
  if (part.code === 'fiscalDocuments' && isBillingItemKey(part.reason)) return billingItemTextKey(part.reason);
  return isOnboardingPartReason(part.reason) ? reasonKey(part.reason) : null;
}

export function missingReasonKey(reason: string | null | undefined): string {
  return reason && (GUEST_REGISTRATION_MISSING_CODES as readonly string[]).includes(reason)
    ? `onboardingPlan.reasons.property.${reason}`
    : 'onboardingPlan.reasons.property.unknown';
}

export function missingItemsOf(part: Pick<OnboardingPart, 'missing'> | null | undefined): OnboardingPartMissing[] {
  const items = part?.missing;
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const known: OnboardingPartMissing[] = [];
  for (const item of items) {
    if (!item || typeof item.propertyId !== 'string' || item.propertyId === '' || seen.has(item.propertyId)) continue;
    seen.add(item.propertyId);
    known.push(item);
  }
  return known;
}

export function isOnboardingNeedCode(value: unknown): value is OnboardingNeedCode {
  return typeof value === 'string' && NEED_CODES.has(value);
}

export function normalizePartState(state: unknown): OnboardingPartState {
  return typeof state === 'string' && PART_STATES.has(state) ? (state as OnboardingPartState) : 'open';
}

export function knownParts(plan: Pick<OnboardingPlan, 'parts'> | null | undefined): OnboardingPart[] {
  const parts = plan?.parts;
  if (!Array.isArray(parts)) return [];
  const seen = new Set<string>();
  const known: OnboardingPart[] = [];
  for (const part of parts) {
    if (!part || !isOnboardingPartKey(part.code) || seen.has(part.code)) continue;
    seen.add(part.code);
    known.push(part);
  }
  return known.sort((a, b) => a.order - b.order);
}

/**
 * Whether a part is in the list the host reads. The notification of the guests in Switzerland is for an organization with an active property there: for any other it is `notAvailable`
 * with the reason `no_swiss_property`, and a row that only says «nothing to do here» would be noise on the plan of a host whose properties are all in Italy. Every other part stays in
 * the list whatever its state, as it always did; the page of the part itself (its address) is still there.
 */
export function partAppliesToOrg(part: Pick<OnboardingPart, 'code' | 'state' | 'reason'>): boolean {
  return !(part.code === 'guestRegistration' && normalizePartState(part.state) === 'notAvailable' && part.reason === 'no_swiss_property');
}

export function knownNeeds(plan: Pick<OnboardingPlan, 'needs'> | null | undefined): OnboardingNeedCode[] {
  const needs = plan?.needs;
  return Array.isArray(needs) ? needs.filter(isOnboardingNeedCode) : [];
}

export function firstOpenPart(parts: readonly OnboardingPart[]): OnboardingPart | null {
  return parts.find((part) => normalizePartState(part.state) === 'open') ?? null;
}

export function partsWaitedFor(part: OnboardingPart, parts: readonly OnboardingPart[]): OnboardingPart[] {
  const required = Array.isArray(part.requires) ? part.requires : [];
  return parts.filter((candidate) => required.includes(candidate.code) && normalizePartState(candidate.state) !== 'done');
}

export const pathStepTitleKey = (code: OnboardingPathStepCode) => `onboardingPlan.path.steps.${code}.title`;
export const nextStepWhyKey = (code: OnboardingPathStepCode) => `onboardingPlan.nextStep.why.${code}`;

const PATH_STEP_CODES: ReadonlySet<string> = new Set(ONBOARDING_PATH_STEP_CODES);

/**
 * The steps of the connected path this version of the app knows, in the order of the path (UX-10). A step it does not know has no text to
 * show, and one with no part this version knows leads nowhere: both are left out, never shown as a bare key. A step sent twice counts once.
 * The parts of a step are reduced to the ones the app knows.
 */
export function knownPathSteps(path: Pick<OnboardingPath, 'steps'> | null | undefined): OnboardingPathStep[] {
  const steps = path?.steps;
  if (!Array.isArray(steps)) return [];
  const seen = new Set<string>();
  const known: OnboardingPathStep[] = [];
  for (const step of steps) {
    if (!step || !PATH_STEP_CODES.has(step.code) || seen.has(step.code)) continue;
    const parts = Array.isArray(step.parts) ? step.parts.filter(isOnboardingPartKey) : [];
    if (parts.length === 0) continue;
    seen.add(step.code);
    known.push({ ...step, parts, state: normalizePartState(step.state) });
  }
  return known.sort((a, b) => a.order - b.order);
}

export function isPathIncomplete(steps: readonly OnboardingPathStep[]): boolean {
  return steps.some((step) => step.visible === true);
}

export function pathProgress(steps: readonly OnboardingPathStep[]): { done: number; total: number } {
  const applying = steps.filter((step) => step.state !== 'notAvailable');
  return { done: applying.filter((step) => step.state === 'done').length, total: applying.length };
}

function isProposable(step: OnboardingPathStep): boolean {
  return step.visible === true && step.state !== 'deferred' && step.state !== 'blocked';
}

export function nextPathStep(path: Pick<OnboardingPath, 'next'> | null | undefined, steps: readonly OnboardingPathStep[]): OnboardingPathStep | null {
  const named = path?.next;
  if (!named) return null;
  return steps.find((step) => step.code === named && step.visible === true) ?? (PATH_STEP_CODES.has(named) ? null : (steps.find(isProposable) ?? null));
}

/**
 * The one step to suggest at the end of the wizard of `currentPart` (UX-10, AC-NF10-2): a step that can be proposed (to do, not put off and
 * not waiting for another part), never the one the wizard belongs to (the host has just been through it), and the first one after it in the
 * path; when none comes after it, the first one that can be proposed (an earlier step the host left: a host who adds a property before the
 * connection is complete is pointed at the connection, not at the steps that wait for it). A wizard that is not a part of any step (the
 * identification, the partners) is followed by the first step to do. Null when there is nothing to suggest.
 */
export function stepAfterPart(steps: readonly OnboardingPathStep[], currentPart: OnboardingPartKey): OnboardingPathStep | null {
  const current = steps.find((step) => step.parts.includes(currentPart));
  const candidates = steps.filter((step) => step.code !== current?.code && isProposable(step));
  return candidates.find((step) => (current ? step.order > current.order : true)) ?? candidates[0] ?? null;
}

export function stepTargetPart(step: OnboardingPathStep, parts: readonly OnboardingPart[]): OnboardingPartKey | null {
  const byCode = new Map(parts.map((part) => [part.code, part] as const));
  let waiting = false;
  for (const code of step.parts) {
    const part = byCode.get(code);
    if (!part) continue;
    const state = normalizePartState(part.state);
    if (state === 'done' || state === 'notAvailable') continue;
    if (state === 'blocked') {
      waiting = true;
      continue;
    }
    return code;
  }
  return waiting ? null : step.parts[0];
}

export type DeferChoice = 'evening' | 'tomorrow' | 'nextWeek';

export interface DeferOption {
  choice: DeferChoice;
  remindAt: string;
}

const EVENING_TIME = '20:00';
const MORNING_TIME = '09:00';
const DAYS_IN_A_WEEK = 7;

export function deferOptions(now: Date = new Date()): DeferOption[] {
  const today = todayInRome(now);
  const options: DeferOption[] = [];

  const evening = romeWallTimeToUtc(today, EVENING_TIME);
  if (evening && new Date(evening).getTime() > now.getTime()) options.push({ choice: 'evening', remindAt: evening });

  const tomorrow = romeWallTimeToUtc(addDays(today, 1), MORNING_TIME);
  if (tomorrow) options.push({ choice: 'tomorrow', remindAt: tomorrow });

  const nextWeek = romeWallTimeToUtc(addDays(today, DAYS_IN_A_WEEK), MORNING_TIME);
  if (nextWeek) options.push({ choice: 'nextWeek', remindAt: nextWeek });

  return options;
}
