import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { isStayDate, utcStayDate } from '@/lib/stay-dates';
import type { RentalMode } from '@/types/property.types';
import type { PropertyModeBlocker } from '@/types/property-mode.types';

/**
 * What the host answers in the wizard of the change of mode (PM-03). The wizard (`WizardShell`) holds them as the values of its
 * form, and keeps them as a draft in the session; the step is not one of them, it lives in the address (`?step=`).
 */
export interface ModeWizardValues {
  /** The mode the property goes to: the other one than it has (the mode is exclusive). */
  target: RentalMode;
  /** First day in the new mode, `yyyy-MM-dd` (Europe/Rome). */
  date: string;
  /**
   * Whether the checks of the chosen day passed. Not an answer: the "Checks" step works it out from the server and the wizard
   * does not move on while it is false. Never kept in the draft.
   */
  checksOk: boolean;
}

export const MODE_WIZARD_STEPS = ['choice', 'date', 'checks', 'confirm'] as const;
export type ModeWizardStepId = (typeof MODE_WIZARD_STEPS)[number];

/** Fields that are not worth keeping in the draft: they are worked out again when the step opens. */
export const MODE_WIZARD_DRAFT_EXCLUDE: readonly string[] = ['checksOk'];

/** Furthest day a change can be programmed for, in years from today (backend `PropertyModeRules.MaxYearsAhead`). */
const MAX_YEARS_AHEAD = 10;

/**
 * The last day a change can be programmed for: ten years from `today`, as the backend counts them (29 February goes to the
 * 28th). An empty string when `today` is not a stay date.
 */
export function lastPossibleDate(today: string): string {
  if (!isStayDate(today)) return '';
  const [year, month, day] = today.split('-').map(Number);
  const later = new Date(Date.UTC(year + MAX_YEARS_AHEAD, month - 1, day));
  if (later.getUTCMonth() !== month - 1) later.setUTCDate(0);
  return utcStayDate(later);
}

export interface DateBounds {
  /** The first day possible (the backend works it out: tomorrow, or the day after the last thing in the way). */
  earliest: string;
  /** The last day possible. */
  latest: string;
}

/**
 * The rules of each step before the next one opens (the messages are i18n keys, as in every form). The first step has none:
 * the only choice is already made. The date has to be a real day inside the bounds the server gave; the checks step only
 * opens the way once the server has said that the day is free.
 */
export function modeStepSchemas(bounds: DateBounds): Partial<Record<ModeWizardStepId, ZodType<unknown, FieldValues>>> {
  return {
    date: z.object({
      date: z
        .string()
        .refine((day) => isStayDate(day), 'propertyMode.errors.dateInvalid')
        .refine((day) => !isStayDate(day) || day >= bounds.earliest, 'propertyMode.errors.dateTooEarly')
        .refine((day) => !isStayDate(day) || day <= bounds.latest, 'propertyMode.errors.dateTooFar'),
    }),
    checks: z.object({
      checksOk: z.literal(true, 'propertyMode.errors.checksFailed'),
    }),
  };
}

/** The blockers that are stays or dates taken on a portal: what stands in the way of a change to long-term. */
export function isBookingBlocker(blocker: PropertyModeBlocker): boolean {
  return blocker.kind === 'Stay' || blocker.kind === 'ImportedBlock';
}

/** The blocker that makes the first day possible what it is: the one that frees the property last. */
export function lastToFree(blockers: readonly PropertyModeBlocker[]): PropertyModeBlocker | null {
  let last: PropertyModeBlocker | null = null;
  for (const blocker of blockers) {
    if (blocker.freeFrom && (!last?.freeFrom || blocker.freeFrom > last.freeFrom)) last = blocker;
  }
  return last;
}

/** A draft lease has no day that frees the property from it: it has to be deleted first. */
export function draftLeases(blockers: readonly PropertyModeBlocker[]): PropertyModeBlocker[] {
  return blockers.filter((blocker) => blocker.kind === 'DraftLease');
}

/** Where a blocker can be dealt with: the booking, the iCal calendars of the property, the lease. */
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
