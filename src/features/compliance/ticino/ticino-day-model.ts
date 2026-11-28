import { todayInZurich } from '@/lib/stay-dates';
import type { TicinoNotificationDay, TicinoNotificationRow } from '@/types/swissCompliance.types';

export type TicinoStepId = 'guests' | 'file' | 'portal' | 'declare' | 'receipt';

export const TICINO_STEPS: readonly TicinoStepId[] = ['guests', 'file', 'portal', 'declare', 'receipt'];

export type TicinoStepState = 'done' | 'attention' | 'todo' | 'optional';

export const PARENTAL_AUTHORIZATION_NEEDED = 'parental_authorization_needed';

export const GROUP_SHEET_INCOMPLETE = 'group_sheet_incomplete';

export const KNOWN_WARNING_CODES: readonly string[] = [PARENTAL_AUTHORIZATION_NEEDED, GROUP_SHEET_INCOMPLETE];

const KNOWN_MISSING_CODES: readonly string[] = ['firstName', 'lastName', 'birthDate', 'nationality', 'documentType', 'guests'];

export function missingKeysOf(codes: readonly string[]): string[] {
  return codes.filter((code) => KNOWN_MISSING_CODES.includes(code)).map((code) => `swiss.issues.missing.${code}`);
}

export function groupRowsOf(day: Pick<TicinoNotificationDay, 'rows'>): TicinoNotificationRow[] {
  return day.rows.filter((row) => row.kind === 'group');
}

export function minorsCountedOf(day: Pick<TicinoNotificationDay, 'rows'>): number {
  return day.rows.filter((row) => row.kind !== 'group').reduce((sum, row) => sum + row.personsOver14 + row.personsUnder14, 0);
}

/** The stays of a kind of warning, once each: the same stay can be warned of twice by a server that lists it twice. */
export function warnedStaysOf(day: Pick<TicinoNotificationDay, 'warnings'>, code: string): string[] {
  return [...new Set(day.warnings.filter((warning) => warning.code === code).map((warning) => warning.bookingId))];
}

export function knownWarningCodesOf(day: Pick<TicinoNotificationDay, 'warnings'>): string[] {
  return KNOWN_WARNING_CODES.filter((code) => day.warnings.some((warning) => warning.code === code));
}

export function isFutureDay(day: Pick<TicinoNotificationDay, 'day'>, now: Date = new Date()): boolean {
  return day.day > todayInZurich(now);
}

export type TicinoDayState = 'none' | 'declared' | 'receipt' | 'open';

export function dayStateOf(day: Pick<TicinoNotificationDay, 'stayCount' | 'declaredAt' | 'receiptCount' | 'alreadyDeclared'>): TicinoDayState {
  if (day.declaredAt) return 'declared';
  if (day.alreadyDeclared || day.receiptCount > 0) return 'receipt';
  return day.stayCount === 0 ? 'none' : 'open';
}

export function firstStepOf(day: Pick<TicinoNotificationDay, 'alreadyDeclared' | 'rows' | 'issues' | 'fileGeneratedCount'>): TicinoStepId {
  if (day.alreadyDeclared) return 'receipt';
  if (day.rows.length === 0 || day.issues.length > 0) return 'guests';
  return day.fileGeneratedCount > 0 ? 'declare' : 'file';
}

export function stepStateOf(
  step: TicinoStepId,
  day: Pick<TicinoNotificationDay, 'alreadyDeclared' | 'rows' | 'issues' | 'fileGeneratedCount' | 'receiptCount'>,
): TicinoStepState {
  switch (step) {
    case 'guests':
      return day.alreadyDeclared || (day.rows.length > 0 && day.issues.length === 0) ? 'done' : 'attention';
    case 'file':
      return day.alreadyDeclared || day.fileGeneratedCount > 0 ? 'done' : 'todo';
    case 'portal':
    case 'declare':
      return day.alreadyDeclared ? 'done' : 'todo';
    case 'receipt':
      return day.receiptCount > 0 ? 'done' : 'optional';
  }
}
