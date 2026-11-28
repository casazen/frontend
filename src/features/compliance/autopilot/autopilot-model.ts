import type { TFunction } from 'i18next';
import type { ComplianceSummaryResult, ComplianceSummarySection } from '@/types/compliance.types';
import type { AutopilotItem, AutopilotOutcome, AutopilotPlan } from '@/types/compliance-autopilot.types';

/** Where every Alloggiati Web communication is listed and prepared: the places the assistant cannot send from. */
export const AUTOPILOT_ALLOGGIATI_PATH = '/app/short-rent/alloggiati';

const STAY_SECTIONS = ['guestCheckInsIncomplete', 'checkoutsDue', 'alloggiatiManualRequired', 'alloggiatiFailures'] as const satisfies readonly (keyof ComplianceSummaryResult)[];

const countOf = (section: ComplianceSummarySection | null | undefined): number => (typeof section?.count === 'number' ? section.count : 0);

/**
 * Whether the cockpit holds something about a stay, so that «Gestisci con AI» has something to look at: the button is on the page
 * only then (a page with only houses to activate has nothing the assistant can do, and says nothing about it).
 */
export function autopilotRelevant(summary: Partial<ComplianceSummaryResult> | null | undefined): boolean {
  return STAY_SECTIONS.some((field) => countOf(summary?.[field]) > 0);
}

const NAMES_SHOWN = 3;

export function namesOf(items: readonly { guestName: string }[], t: TFunction, locale: string): string {
  const names = [...new Set(items.map((item) => item.guestName.trim()).filter((name) => name !== ''))];
  const shown = names.slice(0, NAMES_SHOWN);
  const rest = names.length - shown.length;
  const parts = rest > 0 ? [...shown, t('compliance.autopilot.names.others', { count: rest })] : shown;
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(parts);
}

const HOST_ORDER = [
  'ready_to_upload',
  'failed',
  'data_missing',
  'codes_to_complete',
  'stay_days_invalid',
  'no_contact',
  'asked_enough',
  'already_submitted',
  'arrival_not_registered',
  'departure_today',
  'no_permission',
] as const;

export interface PlanLine {
  reason: string;
  items: AutopilotItem[];
}

export interface PlanGroups {
  ask: AutopilotItem[];
  close: AutopilotItem[];
  waiting: PlanLine[];
  host: PlanLine[];
  readyKeys: string[];
}

function linesOf(items: readonly AutopilotItem[], order: readonly string[]): PlanLine[] {
  const byReason = new Map<string, AutopilotItem[]>();
  for (const item of items) byReason.set(item.reason, [...(byReason.get(item.reason) ?? []), item]);

  const rank = (reason: string) => {
    const index = order.indexOf(reason);
    return index === -1 ? order.length : index;
  };
  return [...byReason.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([reason, grouped]) => ({ reason, items: grouped }));
}

export function groupPlan(plan: Pick<AutopilotPlan, 'items'>): PlanGroups {
  const ask = plan.items.filter((item) => item.topic === 'GuestData' && item.status === 'Ready');
  const close = plan.items.filter((item) => item.topic === 'Departure' && item.status === 'Ready');
  return {
    ask,
    close,
    waiting: linesOf(plan.items.filter((item) => item.status === 'Waiting'), ['asked_recently', 'awaiting_guest_data']),
    host: linesOf(plan.items.filter((item) => item.status === 'Host'), HOST_ORDER),
    readyKeys: [...ask, ...close].map((item) => item.key),
  };
}

export function askChannels(ask: readonly AutopilotItem[]): 'email' | 'chat' | 'mixed' {
  const withEmail = ask.some((item) => item.channels.includes('email'));
  const withChat = ask.some((item) => item.channels.includes('chat'));
  if (withEmail && !withChat) return 'email';
  if (withChat && !withEmail) return 'chat';
  return 'mixed';
}

export interface OutcomeGroups {
  emailed: AutopilotOutcome[];
  chatNeeded: AutopilotOutcome[];
  chatOptional: AutopilotOutcome[];
  closed: AutopilotOutcome[];
  failed: AutopilotOutcome[];
  skipped: AutopilotOutcome[];
  aiWritten: boolean;
}

export function groupOutcomes(outcomes: readonly AutopilotOutcome[]): OutcomeGroups {
  const done = outcomes.filter((outcome) => outcome.status === 'Done');
  const emailed = done.filter((outcome) => outcome.topic === 'GuestData' && outcome.code === 'email_queued');
  const chatNeeded = done.filter((outcome) => outcome.topic === 'GuestData' && outcome.code === 'chat_ready' && outcome.chat !== null);
  return {
    emailed,
    chatNeeded,
    chatOptional: emailed.filter((outcome) => outcome.chat !== null),
    closed: done.filter((outcome) => outcome.topic === 'Departure' && outcome.code === 'departure_closed'),
    failed: outcomes.filter((outcome) => outcome.status === 'Failed'),
    skipped: outcomes.filter((outcome) => outcome.status === 'Skipped'),
    aiWritten: outcomes.some((outcome) => outcome.chat?.aiWritten === true),
  };
}

export function resultSentence(groups: OutcomeGroups, t: TFunction, locale: string): string {
  const parts = [
    groups.emailed.length > 0 ? t('compliance.autopilot.result.sentence.emailed', { count: groups.emailed.length }) : null,
    groups.closed.length > 0 ? t('compliance.autopilot.result.sentence.closed', { count: groups.closed.length }) : null,
    groups.chatNeeded.length > 0 ? t('compliance.autopilot.result.sentence.chat', { count: groups.chatNeeded.length }) : null,
  ].filter((part): part is string => part !== null);

  if (parts.length === 0) return t('compliance.autopilot.result.sentence.none');
  return t('compliance.autopilot.result.sentence.lead', { what: new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(parts) });
}

export function failureText(outcome: AutopilotOutcome, t: TFunction, exists: (key: string) => boolean): string {
  for (const code of [outcome.emailError, outcome.errorCode]) {
    const key = code ? `compliance.autopilot.failure.${code}` : null;
    if (key && exists(key)) return t(key);
  }
  return t('compliance.autopilot.failure.generic');
}
