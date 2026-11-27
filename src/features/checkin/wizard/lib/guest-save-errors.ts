import type { FieldPath, UseFormSetError } from 'react-hook-form';
import { guestFormPathOf, type StayGuestFormValues } from '@/features/checkin/schemas/checkin.schema';
import { getServerFieldErrorsByPath } from '@/lib/server-validation-errors';
import type { CheckInWizardValues } from './checkin-wizard-model';

export interface GuestFieldProblem {
  guestIndex: number;
  field: keyof StayGuestFormValues;
  message: string;
}

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

export function applyGuestFieldProblems(problems: readonly GuestFieldProblem[], setError: UseFormSetError<CheckInWizardValues>): void {
  for (const { guestIndex, field, message } of problems) {
    setError(`guests.${guestIndex}.${field}` as FieldPath<CheckInWizardValues>, { type: 'server', message });
  }
}
