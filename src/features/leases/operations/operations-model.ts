import type { LeaseLetterKind, LeaseLetterState, LeaseOperations } from '@/types';
import type { LeaseOperationId } from './operation-ids';

/** What the server says of a letter kind; `undefined` for a kind this version of the server does not send. */
export function letterState(operations: LeaseOperations, kind: LeaseLetterKind): LeaseLetterState | undefined {
  return operations.letters.find((letter) => letter.kind === kind);
}

/**
 * Which operations the sheet offers now: the notice while a letter makes sense, the withdrawal while it can be recorded or once it was, the
 * renewal in the last stretch of the period and once it was recorded (the next steps), the confirmation of a transitory need while it is the
 * landlord's to confirm, the ISTAT update of the rent while the lease is not under the cedolare secca (which suspends every update), the
 * communication of the cedolare secca while it is.
 */
export function availableOperations(operations: LeaseOperations): Readonly<Record<LeaseOperationId, boolean>> {
  return {
    disdetta: operations.disdetta.available,
    recesso: operations.withdrawal.available || operations.withdrawal.recorded !== null,
    rinnovo: operations.renewal.available || operations.renewal.recorded !== null,
    'conferma-esigenza': operations.transitoryConfirmation.applies && operations.transitoryConfirmation.available,
    istat: operations.istat.available,
    cedolare: operations.cedolareNotice.available,
  };
}

/**
 * A percentage as the person types it («3,2» or «3.2»): a number above zero, or `null` when it is not one. Whether it is enough (the most a
 * share can be, two decimals at most) is for the server to say.
 */
export function parsePercent(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** A percentage the server worked out, as a person reads it in the language of the interface: «2,4», «75». */
export function formatPercent(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 4 }).format(value);
}
