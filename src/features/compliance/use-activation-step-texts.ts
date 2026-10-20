import { useTranslation } from 'react-i18next';
import { blockerText, stepTitle } from '@/features/compliance/activation-wizard-model';
import type { ActivationBlocker, ComplianceWizardStep } from '@/types/compliance.types';

export function useStepTexts(steps: ComplianceWizardStep[]) {
  const { t, i18n } = useTranslation();
  const exists = (key: string) => i18n.exists(key);
  return {
    title: (stepId: string) => stepTitle(stepId, steps, t, exists),
    blocker: (blocker: ActivationBlocker) => blockerText(blocker, steps, t, exists),
  };
}
