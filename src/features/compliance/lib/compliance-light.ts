import type { TFunction } from 'i18next';
import { formatStayDate } from '@/lib/stay-dates';
import {
  COMPLIANCE_REASON_CODES,
  type ComplianceLightName,
  type ComplianceSummaryItem,
  type ComplianceSummaryResult,
  type ComplianceSummarySection,
} from '@/types/compliance.types';

/**
 * What a row shows of the traffic light (NF-52). The first three are the API's `light`, in lower case; `unknown` is "da verificare": the
 * API sent no light (an older server, or the traffic light off), or one this version does not know. The client NEVER works a light out, and
 * green least of all: green is only ever the API saying `Green`.
 */
export type LightState = 'green' | 'yellow' | 'red' | 'unknown';

const STATE_OF: Readonly<Record<ComplianceLightName, LightState>> = { Green: 'green', Yellow: 'yellow', Red: 'red' };

/** The state of an item from the `light` the API sent: anything but `Green`, `Yellow` or `Red` is "da verificare". */
export function lightStateOf(light: unknown): LightState {
  return typeof light === 'string' && Object.hasOwn(STATE_OF, light) ? STATE_OF[light as ComplianceLightName] : 'unknown';
}

/** Worst first: what the host has to do, what is in hand, what nobody could say, and last what is in order. */
export const LIGHT_RANK: Readonly<Record<LightState, number>> = { red: 0, yellow: 1, unknown: 2, green: 3 };

/** The sections of `GET api/compliance/summary`, the ones that existed before the traffic light and the ones it adds. */
export const SECTION_FIELDS = [
  'propertiesPending',
  'guestCheckInsIncomplete',
  'checkoutsDue',
  'alloggiatiFailures',
  'alloggiatiManualRequired',
  'turnoversPending',
  'identityPending',
  'receiptsToUpload',
  'manualSendsRequired',
  'connectionsToFix',
  'periodItems',
] as const satisfies readonly (keyof ComplianceSummaryResult)[];
export type SectionField = (typeof SECTION_FIELDS)[number];

type SummaryLike = Partial<ComplianceSummaryResult> | null | undefined;

/** The items a section lists: a section this version of the API does not send, or sends as something else, lists none. */
export function sectionItems(summary: SummaryLike, field: SectionField): ComplianceSummaryItem[] {
  const section = summary?.[field] as ComplianceSummarySection | null | undefined;
  return Array.isArray(section?.items) ? section.items : [];
}

/** What the server counts in a section: the items that need attention, which can be more than the ones it lists. */
export function sectionCount(summary: SummaryLike, field: SectionField): number {
  const count = (summary?.[field] as ComplianceSummarySection | null | undefined)?.count;
  return typeof count === 'number' && Number.isFinite(count) ? Math.max(0, count) : 0;
}

/** What the lights of a summary say, counted from what the API sends. */
export interface LightSummary {
  /** The items that need attention (everything that is not green): what the server counts in each section, at least the ones it lists. */
  needs: number;
  /** Listed items by their light; `unknown` are the listed ones with no light this version knows. */
  red: number;
  yellow: number;
  unknown: number;
  /** Listed items the API says are in order. */
  green: number;
  /** Items that need attention and were not listed (the server lists the first ones): their light is not told. */
  unlisted: number;
  /** At least one item carries a light this version knows: the traffic light is on on the server. */
  lightsOn: boolean;
}

export const NO_LIGHTS: LightSummary = { needs: 0, red: 0, yellow: 0, unknown: 0, green: 0, unlisted: 0, lightsOn: false };

/** The lights of every section of a summary, counted. A partial or odd payload counts what it has and never throws. */
export function summarizeLights(summary: SummaryLike): LightSummary {
  const totals: LightSummary = { ...NO_LIGHTS };
  for (const field of SECTION_FIELDS) {
    let listedNeeding = 0;
    for (const item of sectionItems(summary, field)) {
      const state = lightStateOf(item.light);
      totals[state] += 1;
      if (state !== 'unknown') totals.lightsOn = true;
      if (state !== 'green') listedNeeding += 1;
    }
    const counted = Math.max(sectionCount(summary, field), listedNeeding);
    totals.needs += counted;
    totals.unlisted += counted - listedNeeding;
  }
  return totals;
}

/** `2026-09` as the host says it ("settembre 2026"); empty when it is not a month (the API sends `yyyy-MM` and nothing else). */
export function periodName(period: string | null | undefined, locale: string): string {
  return period && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? formatStayDate(`${period}-01`, locale, { month: 'long', year: 'numeric' }) : '';
}

interface ReasonContext {
  t: TFunction;
  /** Whether a key is in the locale files (`i18n.exists`). */
  exists: (key: string) => boolean;
}

/**
 * The codes this version has words for. A code is looked up only if it is here: a text of the API is never a way into the tree of the
 * texts (`constructor` would be found by the library as a key, and `a.b` would walk it).
 */
const KNOWN_REASONS: ReadonlySet<string> = new Set(COMPLIANCE_REASON_CODES);

/**
 * The reason of a light in plain words: `compliance.reason.<code>`, or, for a code this version does not know, the generic words of the
 * light (never the raw code). `undefined` when there is nothing to say: no code and no light.
 */
export function reasonText(code: string | null | undefined, state: LightState, { t, exists }: ReasonContext): string | undefined {
  if (typeof code === 'string' && KNOWN_REASONS.has(code) && exists(`compliance.reason.${code}`)) return t(`compliance.reason.${code}`);
  if (state === 'unknown' && !code) return undefined;
  return t(`compliance.light.fallback.${state}`);
}
