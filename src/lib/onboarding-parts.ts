import { addDays, romeWallTimeToUtc, todayInRome } from '@/lib/stay-dates';
import {
  ONBOARDING_NEED_CODES,
  ONBOARDING_PART_KEYS,
  ONBOARDING_PART_REASONS,
  ONBOARDING_PART_STATES,
  type OnboardingNeedCode,
  type OnboardingPart,
  type OnboardingPartKey,
  type OnboardingPartReason,
  type OnboardingPartState,
  type OnboardingPlan,
} from '@/types/onboarding.types';

/**
 * The registry of the eleven parts of the plan «Inizia con CasaZen» (E10/F03): their keys in order, the page of each, an icon and the
 * keys of their texts. The plan page, the connected path and the wizards of the parts read it, so a part is named in one place.
 */

/** The plan page, `/app/short-rent/onboarding` (behind the flag `octorateOnboarding`). */
export const ONBOARDING_PLAN_PATH = '/app/short-rent/onboarding';

/** The page of one part: the launcher that opens the wizard that owns it (E10/F03/US02/T02 registers `/app/short-rent/onboarding/parts/:partKey`). */
export function partPath(key: OnboardingPartKey): string {
  return `${ONBOARDING_PLAN_PATH}/parts/${key}`;
}

/** Names of the icons of the parts, resolved to a component by the row of the plan (`lucide-react`). */
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
  | 'Rocket';

/** The icon of each part, in the order of the plan. It decorates: the title carries the meaning. */
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
  activation: 'Rocket',
};

/** The title of a part («Collega Octorate»), the line that says what it is for, and the text of one thing the host needs, one reason and one state. */
export const partTitleKey = (key: OnboardingPartKey) => `onboardingPlan.parts.${key}.title`;
export const partWhatKey = (key: OnboardingPartKey) => `onboardingPlan.parts.${key}.what`;
export const needKey = (code: OnboardingNeedCode) => `onboardingPlan.needs.${code}`;
export const reasonKey = (code: OnboardingPartReason) => `onboardingPlan.reasons.${code}`;
export const stateKey = (state: OnboardingPartState) => `onboardingPlan.states.${state}`;

const PART_KEYS: ReadonlySet<string> = new Set(ONBOARDING_PART_KEYS);
const PART_STATES: ReadonlySet<string> = new Set(ONBOARDING_PART_STATES);
const PART_REASONS: ReadonlySet<string> = new Set(ONBOARDING_PART_REASONS);
const NEED_CODES: ReadonlySet<string> = new Set(ONBOARDING_NEED_CODES);

/** True for one of the eleven part codes this version of the app knows. */
export function isOnboardingPartKey(value: unknown): value is OnboardingPartKey {
  return typeof value === 'string' && PART_KEYS.has(value);
}

/** True for a reason of a part this version has a text for. */
export function isOnboardingPartReason(value: unknown): value is OnboardingPartReason {
  return typeof value === 'string' && PART_REASONS.has(value);
}

/** True for one of the five codes of «What you need» this version has a text for. */
export function isOnboardingNeedCode(value: unknown): value is OnboardingNeedCode {
  return typeof value === 'string' && NEED_CODES.has(value);
}

/**
 * The state a part is shown in. A state this version does not know (the server is newer than the app) is shown as «da fare»: the
 * server decides what can be done, and a button that leads to a wizard is better than a bare code.
 */
export function normalizePartState(state: unknown): OnboardingPartState {
  return typeof state === 'string' && PART_STATES.has(state) ? (state as OnboardingPartState) : 'open';
}

/**
 * The parts of a plan this version of the app knows, in the order of the plan. A part it does not know has no text to show: it is left out,
 * never shown as a bare key. A part sent twice counts once (the first one).
 */
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

/** The things the host needs at hand that this version has a text for, in the order of the plan. */
export function knownNeeds(plan: Pick<OnboardingPlan, 'needs'> | null | undefined): OnboardingNeedCode[] {
  const needs = plan?.needs;
  return Array.isArray(needs) ? needs.filter(isOnboardingNeedCode) : [];
}

/** The part the host should do now, and the one «Salva ed esci» leaves a «Da fare» for: the first one that is open. */
export function firstOpenPart(parts: readonly OnboardingPart[]): OnboardingPart | null {
  return parts.find((part) => normalizePartState(part.state) === 'open') ?? null;
}

/** The parts a part waits for: the ones it requires that are not done, in the order of the plan. */
export function partsWaitedFor(part: OnboardingPart, parts: readonly OnboardingPart[]): OnboardingPart[] {
  const required = Array.isArray(part.requires) ? part.requires : [];
  return parts.filter((candidate) => required.includes(candidate.code) && normalizePartState(candidate.state) !== 'done');
}

/** When a deferral is reminded: this evening, tomorrow morning or in a week (Europe/Rome). */
export type DeferChoice = 'evening' | 'tomorrow' | 'nextWeek';

export interface DeferOption {
  choice: DeferChoice;
  /** The moment of the reminder as a UTC instant (ISO 8601), what `POST /onboarding/parts/{key}/defer` takes. */
  remindAt: string;
}

/** The hour of the reminder of this evening, and of the other two, on the clock of Rome. */
const EVENING_TIME = '20:00';
const MORNING_TIME = '09:00';
const DAYS_IN_A_WEEK = 7;

/**
 * The three moments the host can choose to be reminded of a part put off (UX-06): this evening at 20:00, tomorrow at 09:00 and in a week at
 * 09:00, all on the clock of Europe/Rome whatever the time zone of the browser. This evening is offered only while it is still to come: the
 * server refuses a reminder in the past, so after 20:00 there are two choices.
 */
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
