import type { FieldPath, UseFormSetError } from 'react-hook-form';
import { guestFormPathOf, type StayGuestFormValues } from '@/features/checkin/schemas/checkin.schema';
import { getServerFieldErrorsByPath } from '@/lib/server-validation-errors';
import type { CheckInWizardValues } from './checkin-wizard-model';

/** A field of the guests form that the server refused, with its message. */
export interface GuestFieldProblem {
  guestIndex: number;
  field: keyof StayGuestFormValues;
  message: string;
}

/**
 * The field errors of a refused save (400 keyed `Guests[i].Field`) that the form has a field for. A server error on a field the form does
 * not have is not in the list: the caller shows the message of the problem for it.
 */
export function guestFieldProblemsOf(error: unknown, guestCount: number, unreadableValueMessage: string): GuestFieldProblem[] {
  const problems: GuestFieldProblem[] = [];
  for (const [path, message] of Object.entries(getServerFieldErrorsByPath(error, unreadableValueMessage))) {
    const formPath = guestFormPathOf(path, guestCount);
    if (!formPath) continue;
    const [, index, field] = formPath.split('.');
    problems.push({ guestIndex: Number(index), field: field as keyof StayGuestFormValues, message });
  }
  return problems;
}

/** Puts the problems on the fields of the form. */
export function applyGuestFieldProblems(problems: readonly GuestFieldProblem[], setError: UseFormSetError<CheckInWizardValues>): void {
  for (const { guestIndex, field, message } of problems) {
    setError(`guests.${guestIndex}.${field}` as FieldPath<CheckInWizardValues>, { type: 'server', message });
  }
}
