import type { LeaseLetterKind, LeaseLetterState, LeaseOperations } from '@/types';
import type { LeaseOperationId } from './operation-ids';

/** What the server says of a letter kind; `undefined` for a kind this version of the server does not send. */
export function letterState(operations: LeaseOperations, kind: LeaseLetterKind): LeaseLetterState | undefined {
  return operations.letters.find((letter) => letter.kind === kind);
}

/** Which operations the sheet offers now: the notice while a letter makes sense, the withdrawal while it can be recorded or once it was. */
export function availableOperations(operations: LeaseOperations): Readonly<Record<LeaseOperationId, boolean>> {
  return {
    disdetta: operations.disdetta.available,
    recesso: operations.withdrawal.available || operations.withdrawal.recorded !== null,
  };
}
