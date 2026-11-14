import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AgencyFinanceGate } from '@/components/finance/agency-finance-gate';
import { PageHeader } from '@/components/layout/page-header';
import { PlainSection } from '@/components/shared/calm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { getHttpStatus } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import { useOwnerMandates, useOwnerNames, useOwnerProfileFacts } from '@/queries/use-owner-accounting';
import type { PropertyOwnerSummary } from '@/types';
import { OwnerAccountingError } from '@/features/owner-accounting/components/owner-accounting-error';
import { OWNER_ONBOARDING_PATH, mandateStateOn, ownerFinancialPath, shortId } from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';

/** The owners drawn before «Mostra tutti»: each row reads its own mandate and profile, so a long registry does not ask for all of them at once. */
const VISIBLE_OWNERS = 20;

/**
 * «Proprietari» of the Amministrazione (E13/F02/US01/T01, NF-110, NF-115): the owners of the properties the agency manages, each with its kind, its settlement currency and the mandate in
 * force (the commission, or «manca il mandato»), and the way to its financial page, where the mandate and the billing address are written. It is the page of the agency plan and of the
 * owner and the administrators of the organization, like the other pages of the agency's money: the role and the plan are checked before anything is read (`AgencyFinanceGate`).
 */
export function OwnersListPage() {
  const { t } = useTranslation();
  return (
    <AgencyFinanceGate testId="owners-page" title={t('owners.title')} description={t('owners.description')} loadingLabel={t('owners.loading')}>
      <OwnersBody />
    </AgencyFinanceGate>
  );
}

const nameOf = (owner: PropertyOwnerSummary, unnamed: (id: string) => string): string => `${owner.firstName} ${owner.lastName}`.trim() || unnamed(shortId(owner.id));

function OwnersBody() {
  const { t } = useTranslation();
  const owners = useOwnerNames();
  const [showAll, setShowAll] = useState(false);
  const header = <PageHeader title={t('owners.title')} description={t('owners.description')} crumbs="auto" />;

  if (owners.isPending) {
    return (
      <div className="space-y-6" data-testid="owners-page">
        {header}
        <SkeletonCard lines={4} label={t('owners.loading')} />
      </div>
    );
  }
  // A failed read keeps the old list: a 404 is still «not found», and any failure is told as one, never as an empty registry.
  if (owners.isError || !owners.data || getHttpStatus(owners.error) === 404) {
    return (
      <div className="space-y-6" data-testid="owners-page">
        {header}
        <OwnerAccountingError error={owners.error} title={t('owners.loadError')} onRetry={() => void owners.refetch()} />
      </div>
    );
  }

  const list = owners.data;
  const shown = showAll ? list : list.slice(0, VISIBLE_OWNERS);

  return (
    <div className="space-y-6" data-testid="owners-page">
      {header}
      {list.length === 0 ? (
        <div className="space-y-3" data-testid="owners-empty">
          <p className="break-words text-sm text-foreground/70">{t('owners.empty')}</p>
          <Button asChild size="sm" variant="outline">
            <Link to={OWNER_ONBOARDING_PATH}>{t('owners.emptyAction')}</Link>
          </Button>
        </div>
      ) : (
        <PlainSection title={t('owners.list.title')} count={list.length} data-testid="owners-list">
          <ul role="list" className="divide-y divide-border">
            {shown.map((owner) => (
              <OwnerRow key={owner.id} owner={owner} />
            ))}
          </ul>
          {list.length > VISIBLE_OWNERS ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((current) => !current)} data-testid="owners-show-all">
              {showAll ? t('owners.list.showLess') : t('owners.list.showAll', { count: list.length })}
            </Button>
          ) : null}
        </PlainSection>
      )}
    </div>
  );
}

/**
 * One owner: the name that opens its financial page, its kind and settlement currency (from the profile in force), and the mandate in force today. Each fact is read here, for the rows on
 * screen: a fact that could not be read is told as such and never as «no mandate», and a loading row says so. Nothing is written from the list.
 */
function OwnerRow({ owner }: { owner: PropertyOwnerSummary }) {
  const { t } = useTranslation();
  const { date, percent } = useOwnerFormat();
  const mandates = useOwnerMandates(owner.id);
  const facts = useOwnerProfileFacts(owner.id);
  const today = todayInRome();
  const name = nameOf(owner, (id) => t('ownerAccounting.owner.unnamed', { id }));
  const state = mandates.data && !mandates.isError ? mandateStateOn(mandates.data, today) : null;

  let profileLine: string;
  if (facts.isPending) profileLine = t('owners.row.loading');
  else if (facts.isError) profileLine = t('owners.row.profileError');
  else if (facts.data === null || facts.data === undefined) profileLine = t('owners.row.noProfile');
  else {
    const kind = t(`ownerProfile.options.entityKind.${facts.data.entityKind}`);
    profileLine = facts.data.settlementCurrency ? t('owners.row.kindAndCurrency', { kind, currency: facts.data.settlementCurrency }) : t('owners.row.kindNoCurrency', { kind });
  }

  let mandateLine;
  if (mandates.isPending) {
    mandateLine = <span>{t('owners.row.mandateLoading')}</span>;
  } else if (state === null) {
    mandateLine = (
      <span role="alert">
        {t('owners.row.mandateError')}{' '}
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => void mandates.refetch()}>
          {t('shared.errorState.retry')}
        </Button>
      </span>
    );
  } else if (state.kind === 'active') {
    mandateLine = (
      <span data-state="active">
        {t('owners.row.mandateActive', {
          percent: percent(state.mandate.commissionPercent),
          vat: state.mandate.commissionIncludesVat ? t('ownerMandate.vat.included') : t('ownerMandate.vat.excluded'),
          from: date(state.mandate.validFrom),
        })}
      </span>
    );
  } else if (state.kind === 'upcoming') {
    mandateLine = (
      <span data-state="upcoming">
        {t('owners.row.mandateUpcoming', { percent: percent(state.mandate.commissionPercent), from: date(state.mandate.validFrom) })}
      </span>
    );
  } else {
    mandateLine = <Badge variant="warning" data-state="missing">{t('owners.row.mandateMissing')}</Badge>;
  }

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between" data-testid="owner-row" data-owner={owner.id}>
      <div className="min-w-0 space-y-1">
        <h3 className="break-words text-base font-semibold">
          <Link to={ownerFinancialPath(owner.id)} className="underline-offset-4 hover:underline" data-testid={`owner-${owner.id}-open`}>
            {name}
          </Link>
        </h3>
        <p className="break-words text-sm text-foreground/70" data-testid="owner-profile-line">
          {profileLine}
        </p>
        <p className="break-words text-sm" data-testid="owner-mandate-line">
          {mandateLine}
        </p>
      </div>
      <Button asChild size="sm" variant="outline" className="self-start">
        <Link to={ownerFinancialPath(owner.id)} aria-label={t('owners.row.openLabel', { owner: name })}>
          {t('owners.row.open')}
        </Link>
      </Button>
    </li>
  );
}
