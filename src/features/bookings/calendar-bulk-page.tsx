import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { Button } from '@/components/ui/button';
import { useApplyCalendarChange, usePreviewCalendarChange } from '@/queries/use-calendar-changes';
import type { CalendarChange } from '@/types/calendar-changes.types';
import { BulkChangeDone } from './components/bulk-change-done';
import { ChangesStep, PeriodStep, PropertiesStep, SummaryStep } from './components/bulk-change-steps';
import {
  BULK_CHANGE_STEP,
  changedDaysOf,
  changesStepSchema,
  emptyBulkChange,
  firstInvalidStep,
  periodStepSchema,
  propertiesStepSchema,
  toChangeRequest,
  type BulkChangeValues,
} from './lib/bulk-change-model';

const CALENDAR_PATH = '/app/short-rent/bookings/calendar';

const BULK_DRAFT_ID = 'calendar-bulk';
const BULK_DRAFT_VERSION = 1;

const previewReady = (preview: { isSuccess: boolean }, values: BulkChangeValues): boolean => firstInvalidStep(values) === null && preview.isSuccess;

type BulkChangeResult = CalendarChange;

function BulkChangeWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const apply = useApplyCalendarChange();
  const preview = usePreviewCalendarChange();
  const [defaults] = useState(() => emptyBulkChange());

  const stepsFor = (values: BulkChangeValues): WizardStep<BulkChangeValues>[] => [
    {
      id: BULK_CHANGE_STEP.properties,
      label: t('booking.calendar.bulk.steps.properties.label'),
      title: t('booking.calendar.bulk.steps.properties.title'),
      purpose: t('booking.calendar.bulk.steps.properties.purpose'),
      schema: propertiesStepSchema,
      render: () => <PropertiesStep />,
    },
    {
      id: BULK_CHANGE_STEP.period,
      label: t('booking.calendar.bulk.steps.period.label'),
      title: t('booking.calendar.bulk.steps.period.title'),
      purpose: t('booking.calendar.bulk.steps.period.purpose'),
      schema: periodStepSchema,
      render: () => <PeriodStep />,
    },
    {
      id: BULK_CHANGE_STEP.changes,
      label: t('booking.calendar.bulk.steps.changes.label'),
      title: t('booking.calendar.bulk.steps.changes.title'),
      purpose: t('booking.calendar.bulk.steps.changes.purpose'),
      schema: changesStepSchema,
      render: () => <ChangesStep />,
    },
    {
      id: BULK_CHANGE_STEP.summary,
      label: t('booking.calendar.bulk.steps.summary.label'),
      title: t('booking.calendar.bulk.steps.summary.title'),
      purpose: t('booking.calendar.bulk.steps.summary.purpose'),
      nextDisabled: !previewReady(preview, values) || apply.isPending,
      render: () => <SummaryStep preview={preview} />,
    },
  ];

  return (
    <WizardShell<BulkChangeValues, BulkChangeResult>
      id={BULK_DRAFT_ID}
      steps={stepsFor(defaults)}
      stepsFor={stepsFor}
      defaultValues={defaults}
      finishLabel={t('booking.calendar.bulk.apply')}
      finishFailedMessage={t('booking.calendar.bulk.applyFailed')}
      onFinish={(values) => apply.mutateAsync(toChangeRequest(values))}
      draft={{ version: BULK_DRAFT_VERSION, accept: (saved) => Array.isArray((saved.values as Partial<BulkChangeValues>).propertyIds) }}
      renderDone={({ result, values }) =>
        result ? <BulkChangeDone change={result} values={values} changedDays={preview.data ? changedDaysOf(preview.data) : undefined} /> : <ReloadedDone />
      }
      aboveFooter={
        <Button type="button" variant="ghost" className="min-h-11" disabled={apply.isPending} onClick={() => navigate(CALENDAR_PATH)} data-testid="bulk-save-and-exit">
          {t('booking.calendar.bulk.saveAndExit')}
        </Button>
      }
      testIds={{ root: 'bulk-wizard', next: 'bulk-wizard-next', back: 'bulk-wizard-back', finish: 'bulk-wizard-apply', finishError: 'bulk-wizard-error' }}
    />
  );
}

function ReloadedDone() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-xl space-y-4 text-center" data-testid="bulk-reloaded">
      <p>{t('booking.calendar.bulk.reloaded')}</p>
      <Button type="button" onClick={() => navigate(CALENDAR_PATH)} data-testid="bulk-reloaded-exit">
        {t('booking.calendar.bulk.saveAndExit')}
      </Button>
    </div>
  );
}

export function CalendarBulkPage() {
  const { t } = useTranslation();

  return (
    <AppShell>
      <div className="min-w-0 space-y-6" data-testid="calendar-bulk-page">
        <PageHeader title={t('booking.calendar.bulk.title')} description={t('booking.calendar.bulk.description')} crumbs="auto" />
        <div className={FOCUS_COLUMN}>
          <BulkChangeWizard />
        </div>
      </div>
    </AppShell>
  );
}
