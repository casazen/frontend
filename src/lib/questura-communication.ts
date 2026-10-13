import type { QuesturaCommunicationStatus } from '@/types';

/**
 * Communication to the public-security authority for an extra-EU tenant (art. 7 D.Lgs. 286/1998, LT-07, A7-08):
 * - `done`: the landlord declared it (the only way to tick the checklist item, never a CasaZen reminder);
 * - `todo`: the 48 hours from the delivery have not ended yet;
 * - `dueToday`: the 48 hours end today;
 * - `overdue`: the deadline has passed without a declaration.
 */
export type QuesturaCommunicationState = 'done' | 'todo' | 'dueToday' | 'overdue';

export function getQuesturaCommunicationState(questura: QuesturaCommunicationStatus): QuesturaCommunicationState {
  if (questura.communicationDate) return 'done';
  if (questura.daysRemaining < 0) return 'overdue';
  return questura.daysRemaining === 0 ? 'dueToday' : 'todo';
}

/** Anchor of the Questura panel on the lease page: the checklist item links there while it is to do. */
export const QUESTURA_PANEL_ID = 'questura-communication';

/**
 * Official page of the Polizia di Stato on the communication for foreign guests and tenants (art. 7 D.Lgs. 286/1998),
 * the source of the rule in backend `.claude/context/regulations/fiscale.md` L13 and L15 (class U).
 */
export const QUESTURA_OFFICIAL_INFO_URL = 'https://www.poliziadistato.it/articolo/125a93e344e6c73863395263';

/** Largest receipt accepted by the API (`QuesturaCommunicationLimits.MaxReceiptBytes`). */
export const QUESTURA_MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

/** `YYYY-MM-DD` of a date-only value of the API (`2026-09-23T00:00:00Z`): the calendar date, whatever the browser zone. */
export function toDateOnly(value: string): string {
  return value.slice(0, 10);
}
