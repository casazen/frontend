import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CircleCheck, Info } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { knownBlockers, openReminders, REMINDER_STEP_IDS } from '@/features/compliance/activation-wizard-model';
import { useStepTexts } from '@/features/compliance/use-activation-step-texts';
import type { Property } from '@/types';
import type { ActivationBlocker, ComplianceWizardStep } from '@/types/compliance.types';
import { fixTargetFor, missingLines, type FinishSection } from './finish-model';

interface MissingSectionProps {
  /** The steps of the activation, as the server answers them; `undefined` while they are being read. */
  steps: ComplianceWizardStep[] | undefined;
  failed: boolean;
  onRetry: () => void;
  property: Pick<Property, 'name' | 'address' | 'city' | 'maxGuests'> | undefined;
  /** The blockers of the 409 of the last attempt to activate, which the screen could not know. */
  refused: readonly ActivationBlocker[] | null;
}

/** Puts the focus where a missing item is fixed, in this same step. */
function goToSection(section: FinishSection): void {
  const id = section === 'cin' ? 'property-wizard-cin' : `property-wizard-section-${section}`;
  const target = document.getElementById(id);
  // The calendars are a disclosure: it opens, and the focus goes to its title.
  if (target instanceof HTMLDetailsElement) target.open = true;
  target?.scrollIntoView({ block: 'center' });
  (target instanceof HTMLDetailsElement ? target.querySelector('summary') : target)?.focus();
}

function FixButton({ stepId, property, label }: { stepId: string; property: MissingSectionProps['property']; label: string }) {
  const [searchParams] = useSearchParams();
  const target = property ? fixTargetFor(stepId, property) : null;
  if (!target) return null;

  if (target.kind === 'section') {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => goToSection(target.section)} data-testid={`property-wizard-fix-${stepId}`}>
        {label}
      </Button>
    );
  }
  const next = new URLSearchParams(searchParams);
  next.set('step', target.step);
  return (
    <Button asChild variant="ghost" size="sm">
      <Link to={{ search: next.toString() }} data-testid={`property-wizard-fix-${stepId}`}>
        {label}
      </Link>
    </Button>
  );
}

/**
 * «Cosa manca» (SR-07c): the blocking steps of the activation as the server lists them, each with «Correggi», and the advice that
 * does not block. **Nothing is worked out here**: the list is the answer of `compliance/activation`, read again after every save.
 * When the last attempt to activate was refused (409) the blockers the server sent are shown as well.
 */
export function MissingSection({ steps, failed, onRetry, property, refused }: MissingSectionProps) {
  const { t } = useTranslation();
  const texts = useStepTexts(steps ?? []);
  const blockers = steps ? knownBlockers(steps) : [];
  // The documents and the safety sheet (PO decision 2026-11-01): the host's obligations, listed apart, never in the way of the activation.
  const reminders = openReminders(steps ?? []);
  const advice = (steps ?? []).filter((step) => !step.blocker && step.status !== 'complete' && !REMINDER_STEP_IDS.includes(step.id));
  const warnings = (steps ?? []).flatMap((step) => step.warnings ?? []);
  const fix = t('propertyWizard.last.missing.fix');

  return (
    <section aria-labelledby="property-wizard-missing-title" className="min-w-0 space-y-3" data-testid="property-wizard-missing">
      <h3 id="property-wizard-missing-title" className="text-base font-semibold">
        {t('propertyWizard.last.missing.title')}
      </h3>

      {failed && !steps ? (
        <Alert
          variant="danger"
          action={
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              {t('propertyWizard.page.retry')}
            </Button>
          }
        >
          {t('propertyWizard.last.missing.failed')}
        </Alert>
      ) : !steps ? (
        <p className="text-sm text-foreground/70" role="status">
          {t('propertyWizard.last.missing.loading')}
        </p>
      ) : blockers.length === 0 ? (
        <p className="flex items-start gap-2 text-sm" data-testid="property-wizard-missing-none">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-foreground" />
          {t('propertyWizard.last.missing.none')}
        </p>
      ) : (
        <>
          <p className="text-sm text-foreground/70">{t('propertyWizard.last.missing.lead')}</p>
          <ul className="space-y-1" data-testid="property-wizard-missing-list">
            {missingLines(blockers).map((line, index) =>
              line.kind === 'safety' ? (
                <li key={`safety-${index}`} data-code="safety_sheet" className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
                  <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-danger-foreground" />
                  <span className="min-w-0 flex-1 break-words">{t('propertyWizard.last.missing.safety', { count: line.count })}</span>
                  <FixButton stepId="safety" property={property} label={fix} />
                </li>
              ) : (
                <li
                  key={`${line.blocker.step}-${line.blocker.code}-${index}`}
                  data-code={line.blocker.code}
                  className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm"
                >
                  <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-danger-foreground" />
                  <span className="min-w-0 flex-1 break-words">{texts.blocker(line.blocker)}</span>
                  <FixButton stepId={line.blocker.step} property={property} label={fix} />
                </li>
              ),
            )}
          </ul>
        </>
      )}

      {reminders.length > 0 ? (
        <div className="space-y-1" data-testid="property-wizard-reminders">
          <p className="text-sm font-medium">{t('propertyWizard.last.missing.reminders')}</p>
          <ul className="space-y-1">
            {reminders.map((step) => (
              <li key={step.id} data-step={step.id} className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
                <Info aria-hidden="true" className="size-4 shrink-0 text-warning-foreground" />
                <span className="min-w-0 flex-1 break-words">
                  {step.id === 'safety'
                    ? t('propertyWizard.last.missing.safety', { count: Math.max(1, step.blockers?.length ?? 0) })
                    : (step.message ?? texts.title(step.id))}
                </span>
                <FixButton stepId={step.id} property={property} label={fix} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {refused && refused.length > 0 ? (
        <Alert variant="danger" title={t('propertyWizard.last.missing.refused')} data-testid="property-wizard-refused">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {refused.map((blocker, index) => (
              <li key={`${blocker.step}-${blocker.code}-${index}`}>{texts.blocker(blocker)}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {advice.length > 0 || warnings.length > 0 ? (
        <div className="space-y-1" data-testid="property-wizard-advice">
          <p className="text-sm font-medium">{t('propertyWizard.last.missing.advice')}</p>
          <ul className="space-y-1">
            {advice.map((step) => (
              <li key={step.id} className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-foreground/80">
                <Info aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 break-words">
                  {step.id === 'ical'
                    ? t('compliance.activation.stepHint.ical')
                    : step.id === 'tourist-tax'
                      ? t('propertyWizard.prices.touristTax.notYet', { city: step.touristTax?.city || property?.city || '' })
                      : (step.message ?? texts.title(step.id))}
                </span>
                <FixButton stepId={step.id} property={property} label={fix} />
              </li>
            ))}
            {warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`} className="flex min-w-0 items-start gap-2 text-sm text-foreground/80">
                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 break-words">{warning.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
