import { useState } from 'react';
import { Search, UserRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { matchesSearch } from '@/components/shared/list-view/list-data';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AgencyFinanceGate } from '@/components/finance/agency-finance-gate';
import { PageHeader } from '@/components/layout/page-header';
import { PlainSection } from '@/components/shared/calm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { getHttpStatus } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import { useOwnerMandates, useOwnerNames } from '@/queries/use-owner-accounting';
import type { PropertyOwnerSummary } from '@/types';
import { OwnerAccountingError } from '@/features/owner-accounting/components/owner-accounting-error';
import { OWNER_ONBOARDING_PATH, mandateOfRow, ownerFinancialPath, shortId } from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';

/** The owners drawn before «Mostra tutti»: a long registry is not a wall of rows (the rows that need the versions of their mandate read them only when they are drawn). */
const VISIBLE_OWNERS = 20;

/**
 * «Proprietari» of the Amministrazione (E13/F02/US01/T01, NF-110, NF-115): the owners of the properties the agency manages, each with its kind, its settlement currency, its properties and the
 * mandate in force (the commission, or «manca il mandato»), and the way to its financial page, where the mandate and the billing address are written. It is the page of the agency plan and of the
 * owner and the administrators of the organization, like the other pages of the agency's money: the role and the plan are checked before anything is read (`AgencyFinanceGate`). The list is
 * what the server decides for the person: with a partial reach it holds only the owners they can open.
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
  const [query, setQuery] = useState('');
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
  if (list.length === 0) return <Navigate to={OWNER_ONBOARDING_PATH} replace />;
  const filtered = list.filter(owner => matchesSearch(nameOf(owner, id => t('ownerAccounting.owner.unnamed', { id })), query));
  const shown = showAll ? filtered : filtered.slice(0, VISIBLE_OWNERS);

  return (
    <div className="space-y-6" data-testid="owners-page">
      {header}
      <PlainSection title={t('owners.list.title')} count={filtered.length} data-testid="owners-list">
        <label className="relative block max-w-md">
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-foreground/70" />
          <span className="sr-only">{t('commandPalette.title')} · {t('owners.title')}</span>
          <Input type="search" className="min-h-11 rounded-full ps-9" value={query} placeholder={t('commandPalette.title')} onChange={event => { setQuery(event.target.value); setShowAll(false); }} />
        </label>
        {shown.length ? (
          <ul role="list" className="grid gap-3 lg:grid-cols-2">
            {shown.map(owner => <OwnerRow key={owner.id} owner={owner} />)}
          </ul>
        ) : <p role="status" className="rounded-xl border bg-surface-2 p-4 text-sm">{t('listView.noResults.title')}</p>}
        {filtered.length > VISIBLE_OWNERS ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll(current => !current)} data-testid="owners-show-all">
            {showAll ? t('owners.list.showLess') : t('owners.list.showAll', { count: filtered.length })}
          </Button>
        ) : null}
      </PlainSection>
    </div>
  );
}

/**
 * One owner: the name that opens its financial page, its kind and settlement currency (from the profile in force), how many properties it has, and the mandate in force today. The list
 * carries all of it, in the same read that made the row: nothing is read for each row, except the mandates of an owner for whom the list has no mandate to say. Its `mandateInForce` is
 * the owner's own mandate that covers today: where it is `null` the owner may still have a mandate of a single property or one that starts later (the list does not count them), so
 * the versions of its mandate are read and say whether the row shows «manca il mandato» (a fact that could not be read is told as such and never as «no mandate», and a loading row says
 * so). Nothing is written from the list.
 */
function OwnerRow({ owner }: { owner: PropertyOwnerSummary }) {
  const { t } = useTranslation();
  const { date, percent } = useOwnerFormat();
  const today = todayInRome();
  const settled = owner.mandateInForce ?? null;
  const mandates = useOwnerMandates(owner.id, settled === null);
  const name = nameOf(owner, (id) => t('ownerAccounting.owner.unnamed', { id }));
  const state = mandateOfRow(settled, mandates.isError ? undefined : mandates.data, today);

  // What the list says of the profile and the properties. `null` is the server saying the owner has no profile, and it is told; an absent member is a server that did not write it (one older than
  // the list), and nothing is told of it: a fact that was not read is never said as «no profile».
  const facts: string[] = [];
  if (owner.entityKind === null) facts.push(t('owners.row.noProfile'));
  else if (owner.entityKind !== undefined) {
    const kind = t(`ownerProfile.options.entityKind.${owner.entityKind}`);
    facts.push(owner.settlementCurrency ? t('owners.row.kindAndCurrency', { kind, currency: owner.settlementCurrency }) : t('owners.row.kindNoCurrency', { kind }));
  }
  if (typeof owner.propertyCount === 'number') {
    facts.push(owner.propertyCount > 0 ? t('owners.row.properties', { count: owner.propertyCount }) : t('owners.row.noProperties'));
  }
  const profileLine = facts.join(' · ');

  let mandateLine;
  if (settled === null && mandates.isPending) {
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
    <li className="flex min-w-0 flex-col items-start justify-between gap-4 rounded-xl border bg-card p-4" data-testid="owner-row" data-owner={owner.id}>
      <div className="min-w-0 space-y-1">
        <h3 className="flex items-center gap-2 break-words text-base font-semibold">
          <UserRound aria-hidden="true" className="size-5 shrink-0 text-primary-text" />
          <Link to={ownerFinancialPath(owner.id)} className="min-w-0 break-words underline-offset-4 hover:underline" data-testid={`owner-${owner.id}-open`}>
            {name}
          </Link>
        </h3>
        {profileLine ? (
          <p className="break-words text-sm text-foreground/70" data-testid="owner-profile-line">
            {profileLine}
          </p>
        ) : null}
        <div className="break-words text-sm" data-testid="owner-mandate-line">
          {mandateLine}
        </div>
      </div>
      <Button asChild size="sm" variant="outline" className="self-start">
        <Link to={ownerFinancialPath(owner.id)} aria-label={t('owners.row.openLabel', { owner: name })}>
          {t('owners.row.open')}
        </Link>
      </Button>
    </li>
  );
}
