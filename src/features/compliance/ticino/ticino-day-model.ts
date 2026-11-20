import { todayInZurich } from '@/lib/stay-dates';
import type { TicinoNotificationDay, TicinoNotificationRow } from '@/types/swissCompliance.types';

/**
 * The steps of the layer of the Ticino police notification (E30/F02/US03/T02), in the order the host does them: who is notified, the file, the portal, the
 * declaration that it was uploaded and, optionally, the proof the portal gives back.
 */
export type TicinoStepId = 'guests' | 'file' | 'portal' | 'declare' | 'receipt';

export const TICINO_STEPS: readonly TicinoStepId[] = ['guests', 'file', 'portal', 'declare', 'receipt'];

/**
 * How a step stands, from what the server says (the layer keeps no progress of its own, so it can be left and come back to): `done`, `attention` (the guests
 * step while some guest misses data or none is in the file), `todo`, or `optional` (the proof, which closes nothing by itself being missing).
 */
export type TicinoStepState = 'done' | 'attention' | 'todo' | 'optional';

/** A guest of a stay of minors without an adult needs the written authorization of the parents (`TicinoWarnings.ParentalAuthorizationNeeded`). */
export const PARENTAL_AUTHORIZATION_NEEDED = 'parental_authorization_needed';

/** The sheet of a group misses the name or the nationality of a member (`TicinoWarnings.GroupSheetIncomplete`). */
export const GROUP_SHEET_INCOMPLETE = 'group_sheet_incomplete';

/** The warnings the layer has words for (`swiss.warnings.<code>`): a code of a newer server is left out, never shown as it came. */
export const KNOWN_WARNING_CODES: readonly string[] = [PARENTAL_AUTHORIZATION_NEEDED, GROUP_SHEET_INCOMPLETE];

/** The codes of what a guest misses that the layer has words for (`swiss.issues.missing.<code>`; `TicinoMissing` of the backend). */
const KNOWN_MISSING_CODES: readonly string[] = ['firstName', 'lastName', 'birthDate', 'nationality', 'documentType', 'guests'];

/** What the list of a guest's missing data says, as keys of the locale files (`swiss.issues.missing.<code>`); an unknown code is left out. */
export function missingKeysOf(codes: readonly string[]): string[] {
  return codes.filter((code) => KNOWN_MISSING_CODES.includes(code)).map((code) => `swiss.issues.missing.${code}`);
}

/** The rows that are the leader of a group of six or more: each has a sheet to download and keep five years. */
export function groupRowsOf(day: Pick<TicinoNotificationDay, 'rows'>): TicinoNotificationRow[] {
  return day.rows.filter((row) => row.kind === 'group');
}

/**
 * The minors counted on a parent in the file (the accompanying children): only the rows of guests. On the row of the leader of a group the same two counters hold
 * every other member, adults included, so they are not minors.
 */
export function minorsCountedOf(day: Pick<TicinoNotificationDay, 'rows'>): number {
  return day.rows.filter((row) => row.kind !== 'group').reduce((sum, row) => sum + row.personsOver14 + row.personsUnder14, 0);
}

/** The stays of a kind of warning, once each: the same stay can be warned of twice by a server that lists it twice. */
export function warnedStaysOf(day: Pick<TicinoNotificationDay, 'warnings'>, code: string): string[] {
  return [...new Set(day.warnings.filter((warning) => warning.code === code).map((warning) => warning.bookingId))];
}

/** The codes of the warnings of the day the layer has words for, once each. */
export function knownWarningCodesOf(day: Pick<TicinoNotificationDay, 'warnings'>): string[] {
  return KNOWN_WARNING_CODES.filter((code) => day.warnings.some((warning) => warning.code === code));
}

/**
 * A day that has not started in Switzerland yet cannot be declared uploaded: the declaration would silence the alerts of an arrival that has not happened
 * (`ticino_declaration_day_in_future` of the API). An address typed or shared can open one.
 */
export function isFutureDay(day: Pick<TicinoNotificationDay, 'day'>, now: Date = new Date()): boolean {
  return day.day > todayInZurich(now);
}

/**
 * Which of the three states a day is in, which is what the line under the title says: no arrival, closed by a person's declaration, closed by the receipt of
 * the portal alone, or still to notify.
 */
export type TicinoDayState = 'none' | 'declared' | 'receipt' | 'open';

export function dayStateOf(day: Pick<TicinoNotificationDay, 'stayCount' | 'declaredAt' | 'receiptCount' | 'alreadyDeclared'>): TicinoDayState {
  if (day.declaredAt) return 'declared';
  if (day.alreadyDeclared || day.receiptCount > 0) return 'receipt';
  return day.stayCount === 0 ? 'none' : 'open';
}

/**
 * The step the layer opens on when the person has not chosen one (so it can be left and come back to): the proof of a closed day, the guests while some miss
 * data or none is ready, the declaration once the file was written (the host is back from the portal), else the file.
 */
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
