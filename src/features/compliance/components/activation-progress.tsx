import { stepHref } from '../activation-wizard-model';
import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Info } from 'lucide-react';
import { REVIEW_STEP_ID } from '@/features/compliance/activation-wizard-model';
import type { ActivationBlocker, ComplianceStepStatus, ComplianceWizardStep } from '@/types/compliance.types';
import { useStepTexts } from '../use-activation-step-texts';
const STEP_ICON_COLOR = {
  complete: 'text-green-600',
  warning: 'text-amber-500',
  current: 'text-primary',
  pending: 'text-muted-foreground',
} as const;


/** Link to a step of the wizard (`?step=`): a real link, so it can be opened, shared and followed with "back". */


export function StepStatusIcon({ status, current }: { status: ComplianceStepStatus; current: boolean }) {
  const Icon = status === 'complete' ? CheckCircle2 : status === 'warning' ? AlertTriangle : Circle;
  const color =
    status === 'complete'
      ? STEP_ICON_COLOR.complete
      : status === 'warning'
        ? STEP_ICON_COLOR.warning
        : current
          ? STEP_ICON_COLOR.current
          : STEP_ICON_COLOR.pending;
  return <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} aria-hidden="true" />;
}


/** Status of a step of the wizard: from the server, or of the summary (complete when nothing blocks). */
function stepStatus(stepId: string, steps: ComplianceWizardStep[], reviewStatus: ComplianceStepStatus): ComplianceStepStatus {
  if (stepId === REVIEW_STEP_ID) return reviewStatus;
  return steps.find((s) => s.id === stepId)?.status ?? 'pending';
}


/** Progress bar: every step is clickable and shows whether it is complete (A5-18 d). */
export function StepIndicator({
  stepIds,
  steps,
  currentStepId,
  reviewStatus,
  onSelect,
}: {
  stepIds: string[];
  steps: ComplianceWizardStep[];
  currentStepId: string;
  reviewStatus: ComplianceStepStatus;
  onSelect: (stepId: string) => void;
}) {
  const { t } = useTranslation();
  const texts = useStepTexts(steps);
  const required = steps.filter((s) => s.blocker);
  const done = required.filter((s) => s.status === 'complete').length;

  return (
    <nav className="space-y-2" aria-label={t('compliance.activation.progress', { done, total: required.length })}>
      <p className="text-sm text-muted-foreground" data-testid="activation-wizard-progress-text">
        {t('compliance.activation.progress', { done, total: required.length })}
      </p>
      <ol className="flex flex-wrap gap-2" data-testid="activation-wizard-progress">
        {stepIds.map((stepId) => {
          const status = stepStatus(stepId, steps, reviewStatus);
          const isCurrent = stepId === currentStepId;
          return (
            <li key={stepId}>
              <button
                type="button"
                data-testid={`activation-step-${stepId}`}
                data-status={status}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onSelect(stepId)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted ${
                  isCurrent ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <StepStatusIcon status={status} current={isCurrent} />
                <span>{texts.title(stepId)}</span>
                <span className="sr-only">{`(${t(`compliance.activation.stepStatus.${status}`)})`}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}


/** Blockers translated by code, each with a link to the step that fixes it. */
export function BlockerList({
  blockers,
  steps,
  stepIds,
  onNavigate,
}: {
  blockers: ActivationBlocker[];
  steps: ComplianceWizardStep[];
  stepIds: string[];
  onNavigate: (stepId: string) => void;
}) {
  const { t } = useTranslation();
  const texts = useStepTexts(steps);
  return (
    <ul className="mt-2 space-y-2" data-testid="activation-blocker-list">
      {blockers.map((blocker, index) => (
        <li key={`${blocker.step}-${blocker.code}-${index}`} data-code={blocker.code} className="flex flex-col gap-0.5">
          <span>{texts.blocker(blocker)}</span>
          {stepIds.includes(blocker.step) && blocker.step !== REVIEW_STEP_ID && (
            <Link
              to={stepHref(blocker.step)}
              onClick={() => onNavigate(blocker.step)}
              className="inline-flex items-center gap-1 text-primary hover:underline"
              data-testid={`activation-blocker-link-${blocker.step}`}
            >
              {t('compliance.activation.goToStep', { step: texts.title(blocker.step) })}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}


/** Notes that never block (SU-04), shown whether the step is complete or not: the message is localized by the API. */
export function StepWarnings({ step }: { step: ComplianceWizardStep }) {
  if (!step.warnings || step.warnings.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm text-muted-foreground" data-testid={`activation-step-warnings-${step.id}`}>
      {step.warnings.map((warning, index) => (
        <li key={`${warning.code}-${index}`} className="flex items-start gap-2" data-code={warning.code}>
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{warning.message}</span>
        </li>
      ))}
    </ul>
  );
}


/** What keeps a step incomplete, translated by code (the safety step shows its own list in the form). */
export function StepBlockers({ step }: { step: ComplianceWizardStep }) {
  const { t } = useTranslation();
  const texts = useStepTexts([step]);
  if (step.status === 'complete') return null;
  if (step.blockers && step.blockers.length > 0) {
    return (
      <ul className="space-y-1 text-sm text-amber-800" data-testid={`activation-step-blockers-${step.id}`}>
        {step.blockers.map((b, index) => (
          <li key={`${b.code}-${index}`} className="flex items-start gap-2" data-code={b.code}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            <span>{texts.blocker(b)}</span>
          </li>
        ))}
      </ul>
    );
  }
  // Only the iCal step warns without blockers; a step unknown here shows the text of the server.
  const hint = step.id === 'ical' ? t('compliance.activation.stepHint.ical') : step.message;
  if (!hint) return null;
  return (
    <p className="flex items-start gap-2 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
      <span>{hint}</span>
    </p>
  );
}


/** A step kept mounted while hidden: what the host typed survives going back and forth (A5-18). */
export function StepPanel({ active, stepId, children }: { active: boolean; stepId: string; children: ReactNode }) {
  return (
    <div hidden={!active} data-testid={`activation-panel-${stepId}`}>
      {children}
    </div>
  );
}
