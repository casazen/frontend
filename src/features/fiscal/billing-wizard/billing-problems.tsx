import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import type { FormProblem } from './billing-wizard-model';
import type { BillingWizardValues } from './billing-wizard-schema';

interface ApplyBillingProblemsProps {
  problems: readonly FormProblem[];
  onSettled: (name: string) => void;
}

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
