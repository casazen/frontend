import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AgencyFinanceGate } from '@/components/finance/agency-finance-gate';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SkeletonCard } from '@/components/ui/skeleton';
import { commissionRulesRequest, commissionStartTooEarly } from '@/features/fiscal/billing-wizard/billing-wizard-model';
import { BILLING_ERROR_KEYS, isPercent } from '@/features/fiscal/billing-wizard/billing-wizard-schema';
import { CommissionPercentsEditor } from '@/features/fiscal/billing-wizard/steps/commission-percents';
import { isStayDate, todayInRome } from '@/lib/stay-dates';
import { useChannelCommissionRules, useSaveChannelCommissionRules } from '@/queries/use-billing-setup';
import { OwnerAccountingError } from './components/owner-accounting-error';
import { defaultPeriod, messageOf, problemFacts, startOfPeriod } from './owner-accounting-model';
import { useOwnerFormat } from './use-owner-format';

/**
 * «Commissioni dei canali» of the Amministrazione (E13/F02/US03/T01, NF-115, ⚖ R2): what each portal keeps when its reservation carries no commission, for the changes made after the setup. It is the
 * same editor as the step of the wizard «Fatturazione» (`CommissionPercentsEditor`) on the same endpoints of the owner ledger: the rules are read for `agency.statement.view` and written for
 * `agency.owner.financial.manage` on the whole organization, which only the owner and the administrators of an organization on the agency plan hold, so the door is the one of the other pages
 * of the agency's money and nothing is read for anyone else. It sits next to the month-end close, where the stays held back for a missing commission are found: the rules apply by the day a
 * stay checks out, so the page asks from which day the new percents are for («Valide dal»), and proposes the first day of the month the close asks for next.
 */
export function ChannelCommissionRulesPage() {
  const { t } = useTranslation();
  return (
    <AgencyFinanceGate
      testId="channel-commissions-page"
      title={t('ownerAccounting.channelRules.title')}
      description={t('ownerAccounting.channelRules.description')}
      loadingLabel={t('ownerAccounting.channelRules.loading')}
    >
      <ChannelCommissionRulesBody />
    </AgencyFinanceGate>
  );
}

function ChannelCommissionRulesBody() {
  const { t } = useTranslation();
  const { date } = useOwnerFormat();
  const rules = useChannelCommissionRules(true);
  const save = useSaveChannelCommissionRules();
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [today] = useState(() => todayInRome());
  const [from, setFrom] = useState(() => startOfPeriod(defaultPeriod(today)));

  const set = rules.data;
  const problems: Record<string, string> = {};
  for (const [channel, value] of Object.entries(typed)) {
    if (value.trim() !== '' && !isPercent(value)) problems[channel] = BILLING_ERROR_KEYS.percent;
  }
  const fromValid = isStayDate(from);
  const tooEarly = set && fromValid ? commissionStartTooEarly(set, typed, from) : null;
  const fromProblem = !fromValid ? t('ownerAccounting.channelRules.fromInvalid') : tooEarly !== null ? t('ownerAccounting.channelRules.fromTooEarly', { date: date(tooEarly) }) : undefined;
  const request = set && fromProblem === undefined ? commissionRulesRequest(set, typed, today, { draft: true, validFrom: from }) : null;
  const invalid = Object.keys(problems).length > 0 || fromProblem !== undefined;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!request || invalid || save.isPending) return;
    setFailure(null);
    try {
      await save.mutateAsync(request);
      setTyped({});
      toast.success(t('ownerAccounting.channelRules.saved', { date: date(from) }));
    } catch (error) {
      const facts = problemFacts(error);
      setFailure(facts.status === 422 && facts.field === 'validFrom' ? t('ownerAccounting.channelRules.fromOverlap') : messageOf(error, t));
    }
  };

  let content: ReactNode;
  if (rules.isPending) {
    content = <SkeletonCard lines={3} label={t('ownerAccounting.channelRules.loading')} />;
  } else if (rules.isError || !set) {
    content = <OwnerAccountingError error={rules.error} title={t('ownerAccounting.channelRules.loadError')} onRetry={() => void rules.refetch()} />;
  } else if (set.channels.length === 0) {
    content = (
      <p className="break-words text-sm text-foreground/70" data-testid="channel-rules-empty">
        {t('ownerAccounting.channelRules.noChannels')}
      </p>
    );
  } else {
    content = (
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]" data-testid="channel-rules-form">
        <div className="rounded-2xl border bg-card p-4 sm:p-6">
          <CommissionPercentsEditor
            set={set}
            typed={typed}
            onChange={(channel, value) => {
              setFailure(null);
              setTyped((current) => ({ ...current, [channel]: value }));
            }}
            errorOf={(channel) => problems[channel]}
            disabled={save.isPending}
          />
        </div>
        <div className="space-y-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-6">
          <Field label={t('ownerAccounting.channelRules.fromLabel')} hint={t('ownerAccounting.channelRules.fromHint')} error={fromProblem} className="w-full">
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFailure(null);
                setFrom(event.target.value);
              }}
              disabled={save.isPending}
              data-testid="channel-rules-from"
            />
          </Field>
          {failure ? (
            <Alert variant="danger" data-testid="channel-rules-error">
              {failure}
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={save.isPending} disabled={request === null || invalid} data-testid="channel-rules-save">
              {t('ownerAccounting.channelRules.save')}
            </Button>
            {request === null && !invalid ? <p className="text-sm text-foreground/70">{t('ownerAccounting.channelRules.noChange')}</p> : null}
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-6" data-testid="channel-commissions-page">
      <PageHeader title={t('ownerAccounting.channelRules.title')} description={t('ownerAccounting.channelRules.description')} crumbs="auto" />
      {content}
    </div>
  );
}
