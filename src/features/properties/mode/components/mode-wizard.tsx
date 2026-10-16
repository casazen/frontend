import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { addDays, todayInRome } from '@/lib/stay-dates';
import { useSchedulePropertyModeChange } from '@/queries/use-property-mode';
import type { RentalMode } from '@/types/property.types';
import type { PropertyModeChange, PropertyModePreview } from '@/types/property-mode.types';
import {
  MODE_WIZARD_DRAFT_EXCLUDE,
  lastPossibleDate,
  modeStepSchemas,
  type ModeWizardValues,
} from '../mode-wizard-model';
import { exitPathFor, oppositeMode, propertyDetailPath, type ModeArea, type ModeEntry } from '../paths';
import { useModeName } from '../use-mode-labels';
import { ModeDone } from './mode-done';
import { ChecksStep, ChoiceStep, ConfirmStep, DateStep } from './mode-wizard-steps';

interface ModeWizardProps {
  propertyId: string;
  propertyName: string;
  /** The section the property is in, which is also the section of the page. */
  area: ModeArea;
  entry: ModeEntry;
  currentMode: RentalMode;
  /** What the server found for tomorrow (the first day possible and why). Without it (the last screen opened again) the bounds are worked out here. */
  firstPreview: PropertyModePreview | undefined;
  /** The change the server already has waiting: the last screen shows it when the page is opened again on it. */
  waiting: PropertyModeChange | null;
  /** The change was programmed: the page must not swap this wizard for the "already programmed" screen when it refreshes. */
  onScheduled: () => void;
}

/**
 * The wizard of the change of mode (PM-03): choice, day, checks, confirmation, then "What happens now". It is a `WizardShell`:
 * the step is in the address (`?step=`), each step is checked before the next one opens, and the answers are kept as a draft in
 * the session. The checks step does not let go until the server says that the day is free; the last button programs the change.
 */
export function ModeWizard({ propertyId, propertyName, area, entry, currentMode, firstPreview, waiting, onScheduled }: ModeWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const schedule = useSchedulePropertyModeChange(propertyId);

  const target = oppositeMode(currentMode);
  const toLong = target === 'Long';
  const today = firstPreview?.today ?? todayInRome();
  const bounds = { earliest: firstPreview?.earliestDate ?? addDays(today, 1), latest: lastPossibleDate(today) };
  const schemas = modeStepSchemas(bounds);
  const currentName = useModeName()(currentMode);

  const steps: WizardStep<ModeWizardValues>[] = [
    {
      id: 'choice',
      label: t('propertyMode.steps.choice.label'),
      title: t('propertyMode.steps.choice.title'),
      purpose: t('propertyMode.steps.choice.purpose', { name: propertyName, area: currentName }),
      nextLabel: t('propertyMode.steps.choice.next'),
      render: () => <ChoiceStep target={target} />,
    },
    {
      id: 'date',
      label: t('propertyMode.steps.date.label'),
      title: t('propertyMode.steps.date.title'),
      purpose: t('propertyMode.steps.date.purpose'),
      schema: schemas.date,
      nextLabel: t('propertyMode.steps.date.next'),
      render: () => <DateStep target={target} bounds={bounds} firstPreview={firstPreview} />,
    },
    {
      id: 'checks',
      label: t('propertyMode.steps.checks.label'),
      title: t('propertyMode.steps.checks.title'),
      purpose: t('propertyMode.steps.checks.purpose'),
      schema: schemas.checks,
      nextLabel: t('propertyMode.steps.checks.next'),
      render: () => <ChecksStep propertyId={propertyId} target={target} />,
    },
    {
      id: 'confirm',
      label: t('propertyMode.steps.confirm.label'),
      title: t('propertyMode.steps.confirm.title'),
      purpose: t('propertyMode.steps.confirm.purpose'),
      render: () => <ConfirmStep propertyName={propertyName} currentMode={currentMode} target={target} />,
    },
  ];

  return (
    <WizardShell<ModeWizardValues, PropertyModeChange>
      id={`property-mode-${propertyId}`}
      steps={steps}
      defaultValues={{ target, date: bounds.earliest, checksOk: false }}
      finishLabel={t(toLong ? 'propertyMode.finish.toLong' : 'propertyMode.finish.toShort')}
      finishFailedMessage={t('propertyMode.errors.scheduleFailed')}
      onFinish={async (values) => {
        const change = await schedule.mutateAsync({ to: target, effectiveDate: values.date });
        onScheduled();
        return change;
      }}
      // A draft of another direction (the property changed mode since) is not this wizard's: it would offer a change that makes no
      // sense. One whose day is no longer possible (it was kept overnight) would start the person on a day the server refuses.
      draft={{
        exclude: MODE_WIZARD_DRAFT_EXCLUDE,
        accept: (saved) =>
          saved.values.target === target && !(typeof saved.values.date === 'string' && saved.values.date < bounds.earliest),
      }}
      onExit={() => navigate(exitPathFor(area, propertyId, entry))}
      // Opened again on the last screen (a reload): it shows the change that waits; with none there is nothing to confirm.
      renderDone={({ result }) => {
        const change = result ?? waiting;
        return change ? (
          <ModeDone propertyId={propertyId} propertyName={propertyName} area={area} entry={entry} change={change} />
        ) : (
          <Navigate to={propertyDetailPath(area, propertyId)} replace />
        );
      }}
      testIds={{
        root: 'property-mode-wizard',
        back: 'property-mode-back',
        next: 'property-mode-next',
        finish: 'property-mode-finish',
        exit: 'property-mode-exit',
        finishError: 'property-mode-finish-error',
      }}
    />
  );
}
