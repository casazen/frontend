import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { isStayDate, utcStayDate } from '@/lib/stay-dates';
import type { RentalMode } from '@/types/property.types';
import type { PropertyModeBlocker } from '@/types/property-mode.types';

export interface ModeWizardValues {
  target: RentalMode;
  date: string;
  checksOk: boolean;
}

export const MODE_WIZARD_DRAFT_EXCLUDE: readonly string[] = ['checksOk'];

const MAX_YEARS_AHEAD = 10;

export function lastPossibleDate(today: string): string {
  if (!isStayDate(today)) return '';
  const [year, month, day] = today.split('-').map(Number);
  const later = new Date(Date.UTC(year + MAX_YEARS_AHEAD, month - 1, day));
  if (later.getUTCMonth() !== month - 1) later.setUTCDate(0);
  return utcStayDate(later);
}

export interface DateBounds {
  earliest: string;
  latest: string;
}

type StepSchema = ZodType<unknown, FieldValues>;

const CHECKS_SCHEMA: StepSchema = z.object({
  checksOk: z.literal(true, 'propertyMode.errors.checksFailed'),
});

export function modeStepSchemas(bounds: DateBounds): { date: StepSchema; checks: StepSchema } {
  return {
    date: z.object({
      date: z
        .string()
        .refine((day) => isStayDate(day), 'propertyMode.errors.dateInvalid')
        .refine((day) => !isStayDate(day) || day >= bounds.earliest, 'propertyMode.errors.dateTooEarly')
        .refine((day) => !isStayDate(day) || day <= bounds.latest, 'propertyMode.errors.dateTooFar'),
    }),
    checks: CHECKS_SCHEMA,
  };
}

export function isBookingBlocker(blocker: PropertyModeBlocker): boolean {
  return blocker.kind === 'Stay' || blocker.kind === 'ImportedBlock';
}

export function lastToFree(blockers: readonly PropertyModeBlocker[]): PropertyModeBlocker | null {
  let last: PropertyModeBlocker | null = null;
  for (const blocker of blockers) {
    if (blocker.freeFrom && (!last?.freeFrom || blocker.freeFrom > last.freeFrom)) last = blocker;
  }
  return last;
}

export function draftLeases(blockers: readonly PropertyModeBlocker[]): PropertyModeBlocker[] {
  return blockers.filter((blocker) => blocker.kind === 'DraftLease');
}

export function blockerPath(blocker: PropertyModeBlocker, propertyId: string): string {
  switch (blocker.kind) {
    case 'Stay':
      return `/app/short-rent/bookings/${blocker.id}`;
    case 'ImportedBlock':
      return `/app/short-rent/properties/${propertyId}?tab=ical`;
    case 'Lease':
    case 'DraftLease':
      return `/app/long-rent/leases/${blocker.id}`;
  }
}
