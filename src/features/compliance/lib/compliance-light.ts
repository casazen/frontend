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

export function lightStateOf(light: unknown): LightState {
  return typeof light === 'string' && Object.hasOwn(STATE_OF, light) ? STATE_OF[light as ComplianceLightName] : 'unknown';
}

export const LIGHT_RANK: Readonly<Record<LightState, number>> = { red: 0, yellow: 1, unknown: 2, green: 3 };

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
  'ticinoNotifications',
  'swissNotifications',
] as const satisfies readonly (keyof ComplianceSummaryResult)[];
export type SectionField = (typeof SECTION_FIELDS)[number];

type SummaryLike = Partial<ComplianceSummaryResult> | null | undefined;

export function sectionItems(summary: SummaryLike, field: SectionField): ComplianceSummaryItem[] {
  const section = summary?.[field] as ComplianceSummarySection | null | undefined;
  return Array.isArray(section?.items) ? section.items : [];
}

export function sectionCount(summary: SummaryLike, field: SectionField): number {
  const count = (summary?.[field] as ComplianceSummarySection | null | undefined)?.count;
  return typeof count === 'number' && Number.isFinite(count) ? Math.max(0, count) : 0;
}

export interface LightSummary {
  needs: number;
  red: number;
  yellow: number;
  unknown: number;
  green: number;
  unlisted: number;
  lightsOn: boolean;
}

export const NO_LIGHTS: LightSummary = { needs: 0, red: 0, yellow: 0, unknown: 0, green: 0, unlisted: 0, lightsOn: false };

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

/** `2026-09` as the host says it ("settembre 2026"), and `2026-11-19` ("19 novembre", the day of a notification of the guests); empty otherwise. */
export function periodName(period: string | null | undefined, locale: string): string {
  if (period && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(period)) return formatStayDate(period, locale, { day: 'numeric', month: 'long' });
  return period && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? formatStayDate(`${period}-01`, locale, { month: 'long', year: 'numeric' }) : '';
}

interface ReasonContext {
  t: TFunction;
  exists: (key: string) => boolean;
}

const KNOWN_REASONS: ReadonlySet<string> = new Set(COMPLIANCE_REASON_CODES);

export function reasonText(code: string | null | undefined, state: LightState, { t, exists }: ReasonContext): string | undefined {
  if (typeof code === 'string' && KNOWN_REASONS.has(code) && exists(`compliance.reason.${code}`)) return t(`compliance.reason.${code}`);
  if (state === 'unknown' && !code) return undefined;
  return t(`compliance.light.fallback.${state}`);
}
