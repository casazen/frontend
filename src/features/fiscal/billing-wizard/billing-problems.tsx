import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import type { FormProblem } from './billing-wizard-model';
import type { BillingWizardValues } from './billing-wizard-schema';

interface ApplyBillingProblemsProps {
  /** What the server refused at the last save: the fields of the form, with the words that say what each wants. */
  problems: readonly FormProblem[];
  /** The person edited a field a problem was on: the problem is settled, and the server checks again at the next save. */
  onSettled: (name: string) => void;
}

/**
 * Puts the problems the server named on the fields of the form (`issuer_field_invalid` lists the values that are not valid). It renders nothing; it lives in the form of the
 * wizard, which is where the fields are.
 *
 * The shell clears the errors of the form each time the step changes, in the same pass as this effect: so the problems are put on the fields once that pass is over, and again
 * at every change of step. A field that is edited is no longer a problem: its message goes with the next check of the step.
 */
export function ApplyBillingProblems({ problems, onSettled }: ApplyBillingProblemsProps) {
  const { setError, watch } = useFormContext<BillingWizardValues>();
  const stepId = useOptionalWizard()?.stepId;

  useEffect(() => {
    if (problems.length === 0) return undefined;
    let current = true;
    queueMicrotask(() => {
      if (!current) return;
      for (const problem of problems) setError(problem.name as keyof BillingWizardValues, { type: 'server', message: problem.messageKey });
    });
    return () => {
      current = false;
    };
  }, [problems, setError, stepId]);

  useEffect(() => {
    const subscription = watch((_values, { name }) => {
      if (name) onSettled(name);
    });
    return () => subscription.unsubscribe();
  }, [watch, onSettled]);

  return null;
}
