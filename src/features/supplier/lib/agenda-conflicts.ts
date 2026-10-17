import type { SupplierConflict, SupplierConflictSeverity, SupplierRequestConflicts } from '@/types/supplier';

/**
 * The words of each conflict code the server sends (SP-03b): what is wrong, and what the supplier can do about it. The server gives codes and
 * ids, never a text; a code this version does not know (`unknown`) gets a neutral one.
 */
const CONFLICT_TEXTS: Record<string, { titleKey: string; fixKey: string }> = {
  time_off: { titleKey: 'supplier.agenda.conflicts.timeOff.title', fixKey: 'supplier.agenda.conflicts.timeOff.fix' },
  overlap: { titleKey: 'supplier.agenda.conflicts.overlap.title', fixKey: 'supplier.agenda.conflicts.overlap.fix' },
  external: { titleKey: 'supplier.agenda.conflicts.external.title', fixKey: 'supplier.agenda.conflicts.external.fix' },
  block: { titleKey: 'supplier.agenda.conflicts.block.title', fixKey: 'supplier.agenda.conflicts.block.fix' },
  day_off: { titleKey: 'supplier.agenda.conflicts.dayOff.title', fixKey: 'supplier.agenda.conflicts.dayOff.fix' },
  outside_hours: { titleKey: 'supplier.agenda.conflicts.outsideHours.title', fixKey: 'supplier.agenda.conflicts.outsideHours.fix' },
  day_full: { titleKey: 'supplier.agenda.conflicts.dayFull.title', fixKey: 'supplier.agenda.conflicts.dayFull.fix' },
  buffer: { titleKey: 'supplier.agenda.conflicts.buffer.title', fixKey: 'supplier.agenda.conflicts.buffer.fix' },
  unknown: { titleKey: 'supplier.agenda.conflicts.unknown.title', fixKey: 'supplier.agenda.conflicts.unknown.fix' },
};

/** The words for a code: its own, or the neutral ones when the code is new to this version. */
export function conflictTexts(code: string): { titleKey: string; fixKey: string } {
  return Object.prototype.hasOwnProperty.call(CONFLICT_TEXTS, code) ? CONFLICT_TEXTS[code] : CONFLICT_TEXTS.unknown;
}

/** `danger` when the time cannot be kept as it is; any other value (`warning`, or one the server adds) reads as a warning. */
export function severityOf(conflict: Pick<SupplierConflict, 'severity'>): SupplierConflictSeverity {
  return conflict.severity === 'danger' ? 'danger' : 'warning';
}

/** How serious the worst of the conflicts of a job is. */
function worstSeverity(conflicts: readonly Pick<SupplierConflict, 'severity'>[]): SupplierConflictSeverity {
  return conflicts.some((conflict) => severityOf(conflict) === 'danger') ? 'danger' : 'warning';
}

/** The worst severity of each job that has conflicts, by request id: the agenda marks those jobs. */
export function conflictSeverities(items: readonly SupplierRequestConflicts[] | undefined): Map<string, SupplierConflictSeverity> {
  return new Map((items ?? []).map((item) => [item.requestId, worstSeverity(item.conflicts)]));
}
