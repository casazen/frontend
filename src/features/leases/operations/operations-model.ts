import { addDays, isStayDate } from '@/lib/stay-dates';
import type { LeaseLetterKind, LeaseLetterState, LeaseOperations } from '@/types';
import type { LeaseOperationId } from './operation-ids';

export function letterState(operations: LeaseOperations, kind: LeaseLetterKind): LeaseLetterState | undefined {
  return operations.letters.find((letter) => letter.kind === kind);
}

/**
 * Which operations the sheet offers now: the notice while a letter makes sense, the withdrawal while it can be recorded or once it was, the
 * renewal in the last stretch of the period and once it was recorded (the next steps), the confirmation of a transitory need while it is the
 * landlord's to confirm, the ISTAT update of the rent while the lease is not under the cedolare secca (which suspends every update), the
 * communication of the cedolare secca while it is, the minutes of the handover once the lease is ending, the statement of the return of the
 * deposit while it has one to return and once it was recorded.
 */
export function availableOperations(operations: LeaseOperations): Readonly<Record<LeaseOperationId, boolean>> {
  return {
    disdetta: operations.disdetta.available,
    recesso: operations.withdrawal.available || operations.withdrawal.recorded !== null,
    rinnovo: operations.renewal.available || operations.renewal.recorded !== null,
    'conferma-esigenza': operations.transitoryConfirmation.applies && operations.transitoryConfirmation.available,
    istat: operations.istat.available,
    cedolare: operations.cedolareNotice.available,
    riconsegna: operations.handover.available,
    cauzione: operations.deposit.available || operations.deposit.recorded !== null,
  };
}

export function parsePercent(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function formatPercent(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 4 }).format(value);
}

export function parseAmount(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const MAX_YEARS_HELD = 40;

export function yearsHeld(from: string, to: string): number[] {
  if (!isStayDate(from) || !isStayDate(to) || to <= from) return [];
  const first = Number(from.slice(0, 4));
  const last = Number(addDays(to, -1).slice(0, 4));
  const years: number[] = [];
  for (let year = first; year <= last && years.length < MAX_YEARS_HELD; year += 1) years.push(year);
  return years;
}
