import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { getProblemMessage } from '@/lib/api-errors';
import { addDays, formatStayDate, todayInRome } from '@/lib/stay-dates';
import { useCancelOwnerStay, useRequestOwnerStay } from '@/queries/ownerPortal';
import type { OwnerStay, OwnerStayRuleSummary, OwnerStayState } from '@/types';
import { canCancelStay, stayFormProblem, stayRefusalText } from './owner-portal-model';
import { ownerPortalPaths } from './paths';
import { StatusPill, type PillTone, TOUCH } from './portal-parts';

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** An owner stay is told in the words of where it really stands: a request blocks nothing, an approved stay is not confirmed until its block exists. */
const STATE_TONE: Record<OwnerStayState, PillTone> = {
  requested: 'info',
  approved_syncing: 'warning',
  confirmed: 'success',
  sync_failed: 'danger',
  rejected: 'neutral',
  cancelled: 'neutral',
};

interface RulePanelProps {
  summary: OwnerStayRuleSummary;
}

/** The rule an owner stay follows, in plain words and before the form: the person knows what will be refused and why, and sees what the allowance leaves this year. */
export function StayRulePanel({ summary }: RulePanelProps) {
  const { t, i18n } = useTranslation();
  const { rule } = summary;
  const items: string[] = [];

  items.push(rule.minAdvanceDays > 0 ? t('ownerPortal.stays.rule.minAdvance', { count: rule.minAdvanceDays }) : t('ownerPortal.stays.rule.noNotice'));
  if (rule.maxAdvanceDays != null) items.push(t('ownerPortal.stays.rule.maxAdvance', { count: rule.maxAdvanceDays }));
  if (rule.maxNights != null) items.push(t('ownerPortal.stays.rule.nightsBetween', { min: rule.minNights, max: rule.maxNights }));
  else items.push(t('ownerPortal.stays.rule.nightsAtLeast', { count: rule.minNights }));
  if (rule.yearlyNightAllowance != null) {
    items.push(
      t('ownerPortal.stays.rule.allowance', {
        count: rule.yearlyNightAllowance,
        year: summary.year,
        used: summary.nightsUsed,
        left: summary.nightsRemaining ?? Math.max(0, rule.yearlyNightAllowance - summary.nightsUsed),
      }),
    );
  }
  if (rule.activeFrom || rule.activeUntil) {
    items.push(
      t('ownerPortal.stays.rule.activePeriod', {
        from: rule.activeFrom ? formatStayDate(rule.activeFrom, i18n.language, DATE) : '…',
        to: rule.activeUntil ? formatStayDate(rule.activeUntil, i18n.language, DATE) : '…',
      }),
    );
  }
  for (const blackout of rule.blackouts) {
    items.push(
      t('ownerPortal.stays.rule.blackout', {
        from: formatStayDate(blackout.from, i18n.language, DATE),
        to: formatStayDate(blackout.to, i18n.language, DATE),
      }),
    );
  }

  return (
    <div className="space-y-2 rounded-md border bg-card p-4" data-testid="owner-stay-rule">
      <h3 className="text-base font-semibold">{t('ownerPortal.stays.rule.title')}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">{rule.approvalRequired ? t('ownerPortal.stays.rule.approvalRequired') : t('ownerPortal.stays.rule.approvalAutomatic')}</p>
    </div>
  );
}

interface StayRequestFormProps {
  propertyId: string;
  summary: OwnerStayRuleSummary;
  busy: boolean;
  request: ReturnType<typeof useRequestOwnerStay>;
}

/**
 * Asks for an owner stay (NF-111): the arrival and the departure. It checks only what costs nothing (both days, the departure after the arrival, not in the past);
 * the rules of the agency are the server's, which answers with the code of the one that is broken and the text says it with the numbers of the rule shown above.
 * What comes back is a request: the page says that it blocks nothing yet, and never calls it a stay until the server says it is confirmed.
 */
export function StayRequestForm({ propertyId, summary, busy, request }: StayRequestFormProps) {
  const { t } = useTranslation();
  const today = todayInRome();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState<OwnerStay | null>(null);

  const refusal = request.error ? stayRefusalText(request.error, summary.rule, summary.year) : null;
  const refusalMessage = request.error
    ? refusal
      ? t(`ownerPortal.stays.errors.${refusal.key}`, refusal.values)
      : (getProblemMessage(request.error, t) ?? t('ownerPortal.stays.errors.generic'))
    : null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const formProblem = stayFormProblem(startDate, endDate, today);
    if (formProblem) {
      setProblem(t(`ownerPortal.stays.errors.${formProblem}`));
      return;
    }
    setProblem(null);
    setSent(null);
    request.mutate(
      { propertyId, startDate, endDate },
      {
        onSuccess: (stay) => {
          setSent(stay);
          setStartDate('');
          setEndDate('');
          request.reset();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-md border bg-card p-4" data-testid="owner-stay-form" aria-labelledby="owner-stay-form-title">
      <h3 id="owner-stay-form-title" className="text-base font-semibold">
        {t('ownerPortal.stays.requestTitle')}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('ownerPortal.stays.startDate')}>
          <Input
            type="date"
            className={TOUCH}
            value={startDate}
            min={today}
            onChange={(event) => {
              setStartDate(event.target.value);
              setProblem(null);
            }}
            data-testid="owner-stay-start"
          />
        </Field>
        <Field label={t('ownerPortal.stays.endDate')}>
          <Input
            type="date"
            className={TOUCH}
            value={endDate}
            min={startDate ? addDays(startDate, 1) : today}
            onChange={(event) => {
              setEndDate(event.target.value);
              setProblem(null);
            }}
            data-testid="owner-stay-end"
          />
        </Field>
      </div>
      {problem ? (
        <Alert variant="danger" data-testid="owner-stay-problem">
          {problem}
        </Alert>
      ) : null}
      {refusalMessage ? (
        <Alert variant="danger" data-testid="owner-stay-refused">
          {refusalMessage}
        </Alert>
      ) : null}
      {sent ? (
        <Alert variant={sent.state === 'requested' ? 'info' : 'warning'} title={t(`ownerPortal.stays.state.${sent.state}.title`)} data-testid="owner-stay-sent">
          {sent.state === 'requested' ? t('ownerPortal.stays.requestSent') : t(`ownerPortal.stays.state.${sent.state}.description`)}
        </Alert>
      ) : null}
      <Button type="submit" className={`${TOUCH} w-full sm:w-auto`} loading={request.isPending} disabled={busy && !request.isPending} data-testid="owner-stay-submit">
        {request.isPending ? t('ownerPortal.stays.submitting') : t('ownerPortal.stays.submit')}
      </Button>
    </form>
  );
}

interface StayListProps {
  stays: readonly OwnerStay[];
  busy: boolean;
  cancel: ReturnType<typeof useCancelOwnerStay>;
}

/**
 * The stays of the owner with where each one stands, and the way to withdraw the ones that have not ended. A stay is a request, then approved while its block waits
 * for the channels, then confirmed - or its block failed, or it was refused or withdrawn: the words are the ones of its real state. Every button of the list is off while
 * one of them is working, so two withdrawals never run together.
 */
export function StayList({ stays, busy, cancel }: StayListProps) {
  const { t, i18n } = useTranslation();
  const today = todayInRome();
  const [toCancel, setToCancel] = useState<OwnerStay | null>(null);
  const [failure, setFailure] = useState<unknown>(null);

  if (stays.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid="owner-stays-empty">
        {t('ownerPortal.stays.empty')}
      </p>
    );
  }

  const confirmCancel = async () => {
    if (!toCancel) return;
    setFailure(null);
    try {
      await cancel.mutateAsync(toCancel.id);
      setToCancel(null);
    } catch (error) {
      setFailure(error);
      setToCancel(null);
    }
  };

  return (
    <div className="space-y-3">
      {failure ? (
        <Alert variant="danger" data-testid="owner-stay-cancel-failed">
          {getProblemMessage(failure, t) ?? t('ownerPortal.stays.cancelFailed')}
        </Alert>
      ) : null}
      <ul className="space-y-3" data-testid="owner-stays">
        {stays.map((stay) => (
          <li key={stay.id} className="min-w-0 rounded-md border bg-card p-4" data-testid="owner-stay" data-state={stay.state}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-medium">{stay.propertyName}</p>
                <p className="text-sm text-muted-foreground">
                  {t('ownerPortal.calendar.range', {
                    from: formatStayDate(stay.startDate, i18n.language, DATE),
                    to: formatStayDate(stay.endDate, i18n.language, DATE),
                  })}{' '}
                  · {t('ownerPortal.calendar.nights', { count: stay.nights })}
                </p>
              </div>
              <StatusPill tone={STATE_TONE[stay.state]}>{t(`ownerPortal.stays.state.${stay.state}.title`)}</StatusPill>
            </div>
            <p className="mt-2 text-sm">{t(`ownerPortal.stays.state.${stay.state}.description`)}</p>
            {stay.requestedByContact ? <p className="mt-1 text-sm text-muted-foreground">{t('ownerPortal.stays.byContact')}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {canCancelStay(stay, today) ? (
                <Button
                  type="button"
                  variant="danger-outline"
                  className={TOUCH}
                  disabled={busy}
                  onClick={() => setToCancel(stay)}
                  data-testid="owner-stay-cancel"
                >
                  {t('ownerPortal.stays.cancel')}
                </Button>
              ) : null}
              <Button asChild variant="outline" className={TOUCH}>
                <Link to={`${ownerPortalPaths.messages}?topic=ownerStay&ownerStayId=${encodeURIComponent(stay.id)}`}>{t('ownerPortal.stays.ask')}</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmationDialog
        open={toCancel !== null}
        onOpenChange={(open) => {
          if (!open && !cancel.isPending) setToCancel(null);
        }}
        title={t('ownerPortal.stays.cancelConfirm.title')}
        description={t('ownerPortal.stays.cancelConfirm.description')}
        consequences={[t('ownerPortal.stays.cancelConfirm.consequence')]}
        confirmLabel={t('ownerPortal.stays.cancelConfirm.confirm')}
        cancelLabel={t('ownerPortal.stays.cancelConfirm.keep')}
        variant="destructive"
        isLoading={cancel.isPending}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
