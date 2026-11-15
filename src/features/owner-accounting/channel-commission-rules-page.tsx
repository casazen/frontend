import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AgencyFinanceGate } from '@/components/finance/agency-finance-gate';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { commissionRulesRequest } from '@/features/fiscal/billing-wizard/billing-wizard-model';
import { BILLING_ERROR_KEYS, isPercent } from '@/features/fiscal/billing-wizard/billing-wizard-schema';
import { CommissionPercentsEditor } from '@/features/fiscal/billing-wizard/steps/commission-percents';
import { todayInRome } from '@/lib/stay-dates';
import { useChannelCommissionRules, useSaveChannelCommissionRules } from '@/queries/use-billing-setup';
import { OwnerAccountingError } from './components/owner-accounting-error';
import { messageOf } from './owner-accounting-model';

/**
 * «Commissioni dei canali» of the Amministrazione (E13/F02/US03/T01, NF-115, ⚖ R2): what each portal keeps when its reservation carries no commission, for the changes made after the setup. It is the
 * same editor as the step of the wizard «Fatturazione» (`CommissionPercentsEditor`) on the same endpoints of the owner ledger: the rules are read for `agency.statement.view` and written for
 * `agency.owner.financial.manage` on the whole organization, which only the owner and the administrators of an organization on the agency plan hold, so the door is the one of the other pages
 * of the agency's money and nothing is read for anyone else. It sits next to the month-end close, where the stays held back for a missing commission are found.
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
  const rules = useChannelCommissionRules(true);
  const save = useSaveChannelCommissionRules();
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  // The day a new percent starts from is the one the page opened on (Europe/Rome): the rule in force is closed the day before.
  const [today] = useState(() => todayInRome());

  const set = rules.data;
  // What is typed and is not a percent (empty is no change): the field says so, and nothing is sent.
  const problems: Record<string, string> = {};
  for (const [channel, value] of Object.entries(typed)) {
    if (value.trim() !== '' && !isPercent(value)) problems[channel] = BILLING_ERROR_KEYS.percent;
  }
  // Only what the person typed is saved: a percent that is only shown (the default of the configuration, which nobody confirmed) is not turned into the agency's rule by saving another.
  const request = set ? commissionRulesRequest(set, typed, today, { draft: true }) : null;
  const invalid = Object.keys(problems).length > 0;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!request || invalid || save.isPending) return;
    setFailure(null);
    try {
      await save.mutateAsync(request);
      setTyped({});
      toast.success(t('ownerAccounting.channelRules.saved'));
    } catch (error) {
      // A rule that lines of the owner ledger already name cannot be given another percent (409), and a percent the server refuses comes back as 422: said in words, nothing is told as saved.
      setFailure(messageOf(error, t));
    }
  };

  let content: ReactNode;
  if (rules.isPending) {
    content = <SkeletonCard lines={3} label={t('ownerAccounting.channelRules.loading')} />;
  } else if (rules.isError || !set) {
    // A failed read is a failed read, whatever the cache still holds from before.
    content = <OwnerAccountingError error={rules.error} title={t('ownerAccounting.channelRules.loadError')} onRetry={() => void rules.refetch()} />;
  } else if (set.channels.length === 0) {
    content = (
      <p className="break-words text-sm text-foreground/70" data-testid="channel-rules-empty">
        {t('ownerAccounting.channelRules.noChannels')}
      </p>
    );
  } else {
    content = (
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4" data-testid="channel-rules-form">
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
