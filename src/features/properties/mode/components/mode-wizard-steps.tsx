import { useLayoutEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Check, FileText, TriangleAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import { WizardSummary } from '@/components/shared/wizard/wizard-summary';
import { getProblemMessage, translateErrorCode } from '@/lib/api-errors';
import { isStayDate } from '@/lib/stay-dates';
import { usePropertyModePreview } from '@/queries/use-property-mode';
import type { RentalMode } from '@/types/property.types';
import type { PropertyModeBlocker, PropertyModePreview } from '@/types/property-mode.types';
import {
  draftLeases,
  isBookingBlocker,
  lastToFree,
  type DateBounds,
  type ModeWizardValues,
} from '../mode-wizard-model';
import { useDayLabel, useModeName } from '../use-mode-labels';
import { BlockerList } from './blocker-list';

/**
 * Step 1, "What do you want to do?": the one thing a property can do, the other mode (the mode is exclusive). It is a choice
 * card, so the step reads like the others and the answer is part of the form, but there is nothing to pick: it is already chosen.
 */
export function ChoiceStep({ target }: { target: RentalMode }) {
  const { t } = useTranslation();
  const { register } = useFormContext<ModeWizardValues>();
  const toLong = target === 'Long';

  return (
    <ChoiceGroup legend={t('propertyMode.choice.legend')} minCardWidth={16}>
      <ChoiceCard
        {...register('target')}
        value={target}
        icon={toLong ? FileText : CalendarDays}
        title={t(toLong ? 'propertyMode.choice.toLong.title' : 'propertyMode.choice.toShort.title')}
        description={t(toLong ? 'propertyMode.choice.toLong.description' : 'propertyMode.choice.toShort.description')}
        data-testid="property-mode-choice"
      />
    </ChoiceGroup>
  );
}

interface DateStepProps {
  target: RentalMode;
  bounds: DateBounds;
  /** What the server found for tomorrow: what stands in the way of the first days, which is why the first day possible is what it is. */
  firstPreview: PropertyModePreview | undefined;
}

/**
 * Why the first day possible is not tomorrow: the stay, the dates of a portal or the lease that frees the property last. A draft
 * lease frees nothing (no day does: it is deleted), so it is named on its own, and "nothing stands in the way" is said only
 * when there is neither.
 */
function DateReason({ target, bounds, blockers }: { target: RentalMode; bounds: DateBounds; blockers: readonly PropertyModeBlocker[] }) {
  const { t } = useTranslation();
  const dayLabel = useDayLabel();
  const last = lastToFree(blockers);
  const drafts = draftLeases(blockers);

  const reason = last
    ? t(`propertyMode.date.reason.last.${last.kind}`, { date: dayLabel(last.end), earliest: dayLabel(bounds.earliest) })
    : drafts.length > 0
      ? null
      : t(target === 'Long' ? 'propertyMode.date.reason.freeToLong' : 'propertyMode.date.reason.freeToShort');

  return (
    <div className="space-y-1 text-sm text-muted-foreground" data-testid="property-mode-date-reason">
      {reason && <p>{reason}</p>}
      {drafts.length > 0 && <p>{t('propertyMode.date.reason.draft')}</p>}
    </div>
  );
}

/**
 * Step 2, "From when?": a day, from the first possible (worked out by the server, with the reason why) to ten years ahead. The
 * button puts the first possible day in the field and checks it, so an error the field already showed goes away. Changing the
 * day throws away the result of the checks: they were of another day.
 */
export function DateStep({ target, bounds, firstPreview }: DateStepProps) {
  const { t } = useTranslation();
  const dayLabel = useDayLabel();
  const { register, setValue, setFocus, control, formState } = useFormContext<ModeWizardValues>();
  const date = useWatch({ control, name: 'date' });
  const toLong = target === 'Long';

  const pickEarliest = () => {
    setValue('date', bounds.earliest, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    setValue('checksOk', false);
    // The button goes away with the click (the field has the day now): the focus goes to the field, not to the top of the page.
    setFocus('date');
  };

  return (
    <div className="space-y-4">
      <Field
        label={t(toLong ? 'propertyMode.date.labelToLong' : 'propertyMode.date.labelToShort')}
        hint={t('propertyMode.date.hint', { earliest: dayLabel(bounds.earliest), latest: dayLabel(bounds.latest) })}
        error={formState.errors.date}
      >
        <Input
          type="date"
          min={bounds.earliest}
          max={bounds.latest}
          // 44 px on a phone, like every control the thumb has to hit.
          className="max-md:min-h-11 pointer-coarse:min-h-11"
          data-testid="property-mode-date"
          {...register('date', { onChange: () => setValue('checksOk', false) })}
        />
      </Field>

      <DateReason target={target} bounds={bounds} blockers={firstPreview?.blockers ?? []} />

      {date !== bounds.earliest && (
        <Button type="button" variant="outline" size="sm" className="min-h-11" data-testid="property-mode-use-earliest" onClick={pickEarliest}>
          {t('propertyMode.date.useEarliest', { date: dayLabel(bounds.earliest) })}
        </Button>
      )}
    </div>
  );
}

interface ChecksStepProps {
  propertyId: string;
  target: RentalMode;
}

/** One line of the checks that passed, with its tick. */
function Passed({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm" data-testid="property-mode-check-passed">
      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-foreground" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

/** What was found, by what it is about, for the day asked. */
function ChecksResult({ preview, propertyId, target, onPick }: { preview: PropertyModePreview; propertyId: string; target: RentalMode; onPick: (date: string) => void }) {
  const { t } = useTranslation();
  const dayLabel = useDayLabel();
  const date = dayLabel(preview.date);
  const bookings = preview.blockers.filter(isBookingBlocker);
  const leases = preview.blockers.filter((blocker) => blocker.kind === 'Lease');
  const drafts = draftLeases(preview.blockers);
  const blockedByDate = bookings.length > 0 || leases.length > 0;
  const issueTexts = preview.issues
    .filter((issue) => issue === 'property_mode_change_exists' || issue === 'property_mode_date_too_early' || issue === 'property_mode_date_too_far')
    .map((issue) => translateErrorCode(issue, t))
    .filter((text): text is string => Boolean(text));

  return (
    <div className="space-y-4" data-testid="property-mode-checks-result">
      <Alert
        variant={preview.canSchedule ? 'success' : 'warning'}
        title={t(preview.canSchedule ? 'propertyMode.checks.okTitle' : 'propertyMode.checks.blockedTitle', { date })}
      >
        {t(preview.canSchedule ? 'propertyMode.checks.okText' : 'propertyMode.checks.blockedText')}
      </Alert>

      {target === 'Long' ? (
        bookings.length > 0 ? (
          <section className="space-y-2" aria-label={t('propertyMode.checks.bookings.title')}>
            <p className="text-sm font-medium">{t('propertyMode.checks.bookings.found', { date })}</p>
            <BlockerList
              blockers={bookings}
              propertyId={propertyId}
              seeAll={{ to: `/app/short-rent/bookings?propertyId=${encodeURIComponent(propertyId)}`, label: t('propertyMode.checks.bookings.seeAll') }}
            />
            {bookings.some((blocker) => blocker.kind === 'ImportedBlock') && (
              <p className="text-sm text-muted-foreground">{t('propertyMode.checks.bookings.portalHint')}</p>
            )}
          </section>
        ) : (
          <Passed>{t('propertyMode.checks.bookings.none', { date })}</Passed>
        )
      ) : leases.length > 0 ? (
        <section className="space-y-2" aria-label={t('propertyMode.checks.leases.title')}>
          <p className="text-sm font-medium">{t('propertyMode.checks.leases.found', { date })}</p>
          <BlockerList
            blockers={leases}
            propertyId={propertyId}
            seeAll={{ to: '/app/long-rent/leases', label: t('propertyMode.checks.leases.seeAll') }}
          />
        </section>
      ) : (
        <Passed>{t('propertyMode.checks.leases.none', { date })}</Passed>
      )}

      {/* A draft lease frees no day: it has to be deleted, whatever the direction says. */}
      {drafts.length > 0 && (
        <section className="space-y-2" aria-label={t('propertyMode.checks.drafts.title')} data-testid="property-mode-drafts">
          <p className="text-sm font-medium">{t('propertyMode.checks.drafts.found')}</p>
          <BlockerList blockers={drafts} propertyId={propertyId} />
          <p className="text-sm text-muted-foreground">{t('propertyMode.checks.drafts.help')}</p>
        </section>
      )}

      {/* The server refuses for a reason this version of the app does not know: say that much, instead of a warning with nothing under it. */}
      {!preview.canSchedule && !blockedByDate && drafts.length === 0 && issueTexts.length === 0 && (
        <p role="alert" className="text-sm text-danger-foreground" data-testid="property-mode-check-unexplained">
          {t('propertyMode.checks.unexplained')}
        </p>
      )}

      {issueTexts.map((text) => (
        <p key={text} role="alert" className="flex items-start gap-2 text-sm text-danger-foreground" data-testid="property-mode-check-issue">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">{text}</span>
        </p>
      ))}

      {blockedByDate && preview.earliestDate > preview.date && (
        <Button type="button" variant="outline" size="sm" className="min-h-11" data-testid="property-mode-pick-earliest" onClick={() => onPick(preview.earliestDate)}>
          {t('propertyMode.date.useEarliest', { date: dayLabel(preview.earliestDate) })}
        </Button>
      )}
    </div>
  );
}

/**
 * Step 3, "Checks": the server looks at the stays, the dates taken on the portals and the leases for the chosen day (always
 * asked again when the step opens: they change under the host's feet) and the wizard does not go on until it says yes. Each
 * thing that stands in the way is listed with the place where it is dealt with.
 */
export function ChecksStep({ propertyId, target }: ChecksStepProps) {
  const { t } = useTranslation();
  const { control, setValue } = useFormContext<ModeWizardValues>();
  const date = useWatch({ control, name: 'date' });
  const preview = usePropertyModePreview(propertyId, target, date, { enabled: isStayDate(date), fresh: true });
  const region = useRef<HTMLDivElement>(null);

  const data = preview.data;
  const settled = preview.isSuccess && !preview.isFetching && data?.date === date;
  const passed = settled && data?.canSchedule === true;

  // The step opens the way only while the answer in front of the person says yes for the day that is in the field. Written before
  // the browser paints (a layout effect): whoever sees the result also finds the way open, never the other way round.
  useLayoutEffect(() => {
    setValue('checksOk', passed);
  }, [passed, setValue]);

  const pick = (day: string) => {
    setValue('date', day, { shouldDirty: true, shouldTouch: true });
    setValue('checksOk', false);
    // The button that was pressed goes away with the old answer: the focus stays in the step, on the place the new answer fills.
    region.current?.focus();
  };

  let content: React.ReactNode;
  if (!isStayDate(date)) {
    content = <Alert variant="warning">{t('propertyMode.checks.noDate')}</Alert>;
  } else if (preview.isError) {
    content = (
      <Alert
        variant="danger"
        data-testid="property-mode-checks-error"
        action={
          <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void preview.refetch()}>
            {t('propertyMode.retry')}
          </Button>
        }
      >
        {getProblemMessage(preview.error, t) ?? t('propertyMode.checks.loadFailed')}
      </Alert>
    );
  } else if (!data || preview.isFetching) {
    // The spinner is a `div` that announces itself (`role="status"`): it cannot be inside a `p`, and the line next to it is the text.
    content = (
      <div className="flex items-center gap-3 text-sm text-muted-foreground" data-testid="property-mode-checks-loading">
        <Spinner size="sm" />
        <span>{t('propertyMode.checks.loading')}</span>
      </div>
    );
  } else {
    content = <ChecksResult preview={data} propertyId={propertyId} target={target} onPick={pick} />;
  }

  return (
    <div ref={region} tabIndex={-1} role="group" aria-label={t('propertyMode.steps.checks.title')} className="space-y-4 outline-none">
      {content}
    </div>
  );
}

interface ConfirmStepProps {
  propertyName: string;
  currentMode: RentalMode;
  target: RentalMode;
}

/**
 * Step 4, "Confirm": the answers in a short list (the day can be edited from here) and what the passage does, in plain words
 * and only what is true: what closes now, what changes on the day, that an email follows and until when it can be withdrawn.
 * It is not a place to arrive without the checks of this visit (a reload, or "Resume" from a draft: the result of the checks is
 * never kept): the person is taken to them, instead of failing at the last button.
 */
export function ConfirmStep({ propertyName, currentMode, target }: ConfirmStepProps) {
  const { t } = useTranslation();
  const dayLabel = useDayLabel();
  const modeName = useModeName();
  const wizard = useOptionalWizard();
  const { control } = useFormContext<ModeWizardValues>();
  const date = useWatch({ control, name: 'date' });
  const checksOk = useWatch({ control, name: 'checksOk' });
  const toLong = target === 'Long';
  const day = dayLabel(date);

  if (!checksOk && wizard) return <Navigate to={wizard.hrefFor('checks')} replace />;

  const consequences = toLong
    ? [
        t('propertyMode.confirm.toLong.calendar', { date: day }),
        t('propertyMode.confirm.toLong.site', { date: day }),
        t('propertyMode.confirm.toLong.stays'),
      ]
    : [
        t('propertyMode.confirm.toShort.section', { date: day }),
        t('propertyMode.confirm.toShort.leases'),
        t('propertyMode.confirm.toShort.listing'),
      ];

  return (
    <div className="space-y-6" data-testid="property-mode-confirm">
      <WizardSummary
        items={[
          { id: 'property', label: t('propertyMode.confirm.property'), value: propertyName },
          { id: 'from', label: t('propertyMode.confirm.from'), value: modeName(currentMode) },
          { id: 'to', label: t('propertyMode.confirm.to'), value: modeName(target) },
          { id: 'date', label: t('propertyMode.confirm.date'), value: day, stepId: 'date' },
        ]}
      />
      <section className="space-y-2" aria-labelledby="property-mode-consequences">
        <h3 id="property-mode-consequences" className="text-sm font-semibold">
          {t('propertyMode.confirm.consequences')}
        </h3>
        <ul role="list" className="space-y-2">
          {[...consequences, t('propertyMode.confirm.email'), t('propertyMode.confirm.withdraw')].map((text) => (
            <li key={text} className="flex min-w-0 items-start gap-2 text-sm">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 break-words">{text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
