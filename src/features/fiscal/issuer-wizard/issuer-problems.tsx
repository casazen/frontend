import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import type { FiscalIssuerField } from '@/types';
import { formFieldOfIssue, issueOfFormField } from './issuer-wizard-model';
import { SERVER_FIELD_MESSAGES, type IssuerWizardValues } from './issuer-wizard-schema';

interface ApplyIssuerProblemsProps {
  /** What the server refused or said is missing at the last button. */
  problems: readonly FiscalIssuerField[];
  /** The person edited a field a problem was on: the problem is settled, and the server checks again at the next confirmation. */
  onSettled: (field: FiscalIssuerField) => void;
}

/**
 * Puts the problems the server named on the fields of the form, on the right step (`issuer_profile_incomplete` lists what is missing,
 * `issuer_field_invalid` what is not valid). It renders nothing; it lives in the form of the wizard, which is where the fields are.
 *
 * The shell clears the errors of the form each time the step changes, in the same pass as this effect: so the problems are put on the fields
 * once that pass is over, and again at every change of step. A field that is edited is no longer a problem: its message goes with the next
 * check of the step, and the problem leaves the list of the summary.
 */
export function ApplyIssuerProblems({ problems, onSettled }: ApplyIssuerProblemsProps) {
  const { setError, watch } = useFormContext<IssuerWizardValues>();
  const stepId = useOptionalWizard()?.stepId;

  useEffect(() => {
    if (problems.length === 0) return undefined;
    let current = true;
    queueMicrotask(() => {
      if (!current) return;
      for (const field of problems) {
        const name = formFieldOfIssue(field);
        const message = SERVER_FIELD_MESSAGES[field];
        if (name && message) setError(name, { type: 'server', message });
      }
    });
    return () => {
      current = false;
    };
  }, [problems, setError, stepId]);

  useEffect(() => {
    const subscription = watch((_values, { name }) => {
      const field = name ? issueOfFormField(name) : null;
      if (field) onSettled(field);
    });
    return () => subscription.unsubscribe();
  }, [watch, onSettled]);

  return null;
}
