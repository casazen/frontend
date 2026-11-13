import type { ComplianceCockpitAction, ComplianceSummaryItem, ComplianceSummaryResult } from '@/types/compliance.types';
import { LIGHT_RANK, lightStateOf, SECTION_FIELDS, sectionItems } from './compliance-light';

/**
 * One compliance item of a stay or a property, as the card "Cosa succede ora" shows it (NF-52, CHK-12 point 5): its light, the reason the API
 * gave and the item itself (for its button). Only an item the API gave a light is a line: a card never tells «da verificare» (that is the page of
 * the adempimenti) and never works a light out.
 */
export interface ComplianceLine {
  /** One per item: the action, its target and, for a month, the month. */
  id: string;
  action: ComplianceCockpitAction;
  state: 'green' | 'yellow' | 'red';
  reason: string | null;
  period: string | null;
  dueAt: string | null;
  item: ComplianceSummaryItem;
}

/** What a stay shows: its identity, the Alloggiati Web communication (to send by hand, to resolve, the receipt). Its guest data, departure and turnover have their own steps. */
const STAY_ACTIONS: readonly ComplianceCockpitAction[] = ['VerifyIdentity', 'UploadAlloggiatiReceipt', 'SendAlloggiatiManually', 'SendAlloggiati', 'ResolveAlloggiatiFailure'];

/** What a property shows: the police send and credentials, the rate of the tourist tax and its months, ISTAT. Its activation and its CIN have their own steps. */
const PROPERTY_ACTIONS: readonly ComplianceCockpitAction[] = [
  'ActivateOctorateSend',
  'RenewPoliceCredentials',
  'EnterMunicipalityTaxRate',
  'UploadIstatProof',
  'DeclareTouristTax',
];

const dueTime = (dueAt: string | null): number => {
  const time = dueAt ? new Date(dueAt).getTime() : Number.NaN;
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

/** The worst light first, then the nearest deadline, then the order the card knows its actions in. */
function byUrgency(a: ComplianceLine, b: ComplianceLine, actions: readonly ComplianceCockpitAction[]): number {
  return LIGHT_RANK[a.state] - LIGHT_RANK[b.state] || dueTime(a.dueAt) - dueTime(b.dueAt) || actions.indexOf(a.action) - actions.indexOf(b.action);
}

function linesOf(
  summary: Partial<ComplianceSummaryResult> | null | undefined,
  actions: readonly ComplianceCockpitAction[],
  belongs: (item: ComplianceSummaryItem) => boolean,
): ComplianceLine[] {
  const seen = new Set<string>();
  const lines: ComplianceLine[] = [];
  for (const field of SECTION_FIELDS) {
    for (const item of sectionItems(summary, field)) {
      const state = lightStateOf(item.light);
      if (state === 'unknown' || !actions.includes(item.action) || !belongs(item)) continue;
      const id = `${item.action}-${item.id}${item.period ? `-${item.period}` : ''}`;
      if (seen.has(id)) continue;
      seen.add(id);
      lines.push({ id, action: item.action, state, reason: item.reason ?? null, period: item.period ?? null, dueAt: item.dueAt ?? null, item });
    }
  }
  return lines.sort((a, b) => byUrgency(a, b, actions));
}

/** The compliance lines of one stay, worst first. Empty when the summary lists none (an older API, the traffic light off, or an item past what the server lists). */
export function stayLinesOf(summary: Partial<ComplianceSummaryResult> | null | undefined, bookingId: string): ComplianceLine[] {
  return bookingId ? linesOf(summary, STAY_ACTIONS, (item) => item.bookingId === bookingId) : [];
}

/** The compliance lines of one property, worst first. */
export function propertyLinesOf(summary: Partial<ComplianceSummaryResult> | null | undefined, propertyId: string): ComplianceLine[] {
  return propertyId ? linesOf(summary, PROPERTY_ACTIONS, (item) => item.propertyId === propertyId) : [];
}

/** The lines that still ask something or are in hand: everything but what the API says is in order. */
export const pendingLines = (lines: readonly ComplianceLine[]): ComplianceLine[] => lines.filter((line) => line.state !== 'green');

/** What a card lists of its lines. */
export interface LinesView {
  /** The lines that still ask something or are in hand, the worst first, without the one the block already says: at most `max`. */
  shown: ComplianceLine[];
  /** How many of those were left out. */
  hidden: number;
  /** The lines in order: listed only when nothing at all is left to do (next to something to do they are noise). */
  inOrder: ComplianceLine[];
}

/** What a card lists of the lines of its stay or property: the few that still ask something, or, when nothing does, what is in order. */
export function viewOfLines(lines: readonly ComplianceLine[], { skip, max = 3 }: { skip?: string; max?: number } = {}): LinesView {
  const pending = pendingLines(lines);
  const listed = pending.filter((line) => line.id !== skip);
  const shown = listed.slice(0, max);
  return { shown, hidden: listed.length - shown.length, inOrder: pending.length === 0 ? lines.filter((line) => line.state === 'green') : [] };
}

/** Whether a card has anything to say of its lines. */
export const hasLinesToShow = (view: LinesView): boolean => view.shown.length > 0 || view.inOrder.length > 0;
