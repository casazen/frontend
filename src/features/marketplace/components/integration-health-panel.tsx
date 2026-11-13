import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { translateErrorCode } from '@/lib/api-errors';
import type { useMarketplaceHealth } from '@/queries/use-marketplace';
import type { MarketplaceHealthItem, MarketplaceQuota } from '@/types';
import {
  badgeStatusOf,
  checkedOf,
  fixPathOf,
  formatInstant,
  groupHealthByProperty,
  quotaOf,
  quotaPercent,
  type PropertyHealth,
} from '../lib/active-model';
import { marketplaceReturnTarget } from '../lib/marketplace-entry';
import { useOpenEntryDetails } from '../lib/use-entry-details';
import { MarketplaceStatusBadge } from './marketplace-status-badge';

type HealthQuery = ReturnType<typeof useMarketplaceHealth>;

interface IntegrationHealthPanelProps {
  query: HealthQuery;
  /** Whether the person may start the wizard that fixes an integration of this kind (`ota.write`, and the connector for what goes through the channel manager). */
  mayFix: (kind: string) => boolean;
}

/** What the server says of the quota of the channel manager's API, as it says it:the numbers, the share they make, when they were read and whether it warns. Never a green bar. */
function QuotaLine({ quota }: { quota: MarketplaceQuota | null }) {
  const { t, i18n } = useTranslation();

  if (!quota) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="marketplace-health-quota-unknown">
        {t('marketplace.health.quota.unknown')}
      </p>
    );
  }

  const percent = quotaPercent(quota);
  const values = { used: quota.used, limit: quota.limit };
  const readAt = formatInstant(quota.readAt, i18n.language);

  return (
    <div className="space-y-1.5" data-testid="marketplace-health-quota" data-warn={quota.warn ? 'true' : 'false'}>
      <p className="text-sm font-medium">
        {percent === null ? t('marketplace.health.quota.units', values) : t('marketplace.health.quota.usage', { ...values, percent })}
      </p>
      {percent === null ? null : (
        <Progress value={percent} size="sm" label={t('marketplace.health.quota.label')} valueText={t('marketplace.health.quota.usage', { ...values, percent })} />
      )}
      {readAt ? <p className="text-xs text-muted-foreground">{t('marketplace.health.quota.readAt', { when: readAt })}</p> : null}
      {quota.warn ? (
        <Alert variant="warning" data-testid="marketplace-health-quota-warn">
          {t('marketplace.health.quota.warn')}
        </Alert>
      ) : null}
    </div>
  );
}

interface ProblemRowProps {
  item: MarketplaceHealthItem;
  mayFix: (kind: string) => boolean;
}

/** An integration with a problem: what it is, where it stands, the problem in the words the server sent, when it was last read, and the two things to do about it: fix it, or read its card. */
function ProblemRow({ item, mayFix }: ProblemRowProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const openDetails = useOpenEntryDetails();
  const testId = `marketplace-health-problem-${item.kind}-${item.code}-${item.propertyId ?? 'org'}`;
  const lastSync = formatInstant(item.lastSyncedAt, i18n.language);
  const property = item.propertyId ? { id: item.propertyId, name: item.propertyName ?? '' } : null;
  const fixTo = mayFix(item.kind) ? fixPathOf({ kind: item.kind, code: item.code, property }, marketplaceReturnTarget(location)) : null;

  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between" data-testid={testId}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="break-words font-medium">{item.name}</p>
          <MarketplaceStatusBadge status={badgeStatusOf(item.status)} declared={item.isDeclared} data-testid={`${testId}-status`} />
        </div>
        <p className="break-words text-sm text-[color:var(--color-danger-foreground,#b4232a)]" data-testid={`${testId}-error`}>
          {item.error ? item.error.message || translateErrorCode(item.error.code, t) || t('marketplace.mine.card.errorGeneric') : t('marketplace.health.toFixNoDetail')}
        </p>
        <p className="text-sm text-foreground/70" data-testid={`${testId}-sync`}>
          {lastSync ? t('marketplace.mine.card.lastSync', { when: lastSync }) : t('marketplace.mine.card.neverSynced')}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {fixTo ? (
          <Button asChild size="sm">
            <Link to={fixTo} aria-label={t('marketplace.health.fixAria', { name: item.name })} data-testid={`${testId}-fix`}>
              {t('marketplace.health.fix')}
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(event) => openDetails(item, item.propertyId, event.currentTarget)}
          aria-label={t('marketplace.health.detailsAria', { name: item.name })}
          data-testid={`${testId}-details`}
        >
          {t('marketplace.health.details')}
        </Button>
      </div>
    </li>
  );
}

/**
 * One property in the panel. With problems: the rows with a problem, listed, and the rest counted. With none: one calm line, not a list. A line says «no problem reported» only for
 * the integrations that are active: what waits is counted as waiting, never as working.
 */
function PropertyGroup({ group, mayFix }: { group: PropertyHealth; mayFix: (kind: string) => boolean }) {
  const { t, i18n } = useTranslation();
  const name = group.propertyName ?? t('marketplace.mine.card.wholeOrganization');
  // As of when «no problem reported» is said: the oldest read among the integrations it is said of, and how many were never read.
  const { oldest, never } = checkedOf(group.fine);
  const checked = formatInstant(oldest, i18n.language);
  const calm =
    group.problems.length > 0
      ? group.fine.length > 0
        ? t('marketplace.health.others', { count: group.fine.length })
        : null
      : group.fine.length > 0
        ? t('marketplace.health.calm', { count: group.fine.length })
        : null;

  return (
    <li className="min-w-0 space-y-2" data-testid={`marketplace-health-property-${group.key}`} data-problems={group.problems.length}>
      <h3 className="break-words text-sm font-semibold">{name}</h3>
      {group.problems.length > 0 ? (
        <ul role="list" className="list-none space-y-2">
          {group.problems.map((item) => (
            <ProblemRow key={item.activationId} item={item} mayFix={mayFix} />
          ))}
        </ul>
      ) : null}
      {calm ? (
        <p className="text-sm text-foreground/70" data-testid={`marketplace-health-property-${group.key}-calm`}>
          {calm}
        </p>
      ) : null}
      {group.fine.length > 0 && (checked || never > 0) ? (
        <p className="text-xs text-muted-foreground" data-testid={`marketplace-health-property-${group.key}-checked`}>
          {checked ? t('marketplace.health.checked', { when: checked }) : null}
          {checked && never > 0 ? ' ' : null}
          {never > 0 ? t('marketplace.health.neverChecked', { count: never }) : null}
        </p>
      ) : null}
      {group.waiting.length > 0 ? (
        <p className="text-sm text-foreground/70" data-testid={`marketplace-health-property-${group.key}-waiting`}>
          {t('marketplace.health.waiting', { count: group.waiting.length })}
        </p>
      ) : null}
    </li>
  );
}

/**
 * The health of the active integrations (E09/F03/US02/T01, MKT-04, NF-57): the quota of the channel manager's API as the server reports it, and for each property the integrations that
 * have a problem (with `Correggi`, which opens the wizard of their kind for that property, and `Dettagli`, which opens their card), the problems first. It is a read of CasaZen's own
 * rows: «Controlla di nuovo» reads it again, it does not ask the channel manager. A read that failed is said and can be tried again, never read as «no problem»; a 403 and a 404
 * are said as what they are, and the rows of an older read are not shown for any of them.
 */
export function IntegrationHealthPanel({ query, mayFix }: IntegrationHealthPanelProps) {
  const { t } = useTranslation();
  const title = t('marketplace.health.title');
  let body;

  if (query.isError) {
    // A failed read says so: what an older read held (the query keeps it) is not the state of the connections now.
    body = <ErrorState testId="marketplace-health-error" title={t('marketplace.health.loadError')} error={query.error} onRetry={() => void query.refetch()} />;
  } else if (!query.data) {
    body = (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-testid="marketplace-health-loading">
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {t('marketplace.health.loading')}
      </p>
    );
  } else if (query.data.outcome === 'forbidden') {
    body = (
      <p className="text-sm text-muted-foreground" data-testid="marketplace-health-forbidden">
        {t('marketplace.health.forbidden')}
      </p>
    );
  } else if (query.data.outcome === 'notFound') {
    body = (
      <p className="text-sm text-muted-foreground" data-testid="marketplace-health-not-found">
        {t('marketplace.health.notFound')}
      </p>
    );
  } else if (query.data.items.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground" data-testid="marketplace-health-empty">
        {t('marketplace.health.empty')}
      </p>
    );
  } else {
    const { items } = query.data;
    body = (
      <>
        <QuotaLine quota={quotaOf(items)} />
        <ul role="list" className="list-none space-y-4" data-testid="marketplace-health-properties">
          {groupHealthByProperty(items).map((group) => (
            <PropertyGroup key={group.key} group={group} mayFix={mayFix} />
          ))}
        </ul>
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching} data-testid="marketplace-health-refresh">
            <RefreshCw aria-hidden="true" className={query.isFetching ? 'size-4 animate-spin motion-reduce:animate-none' : 'size-4'} />
            {t('marketplace.health.refresh')}
          </Button>
        </div>
      </>
    );
  }

  return (
    <PlainSection title={title} data-testid="marketplace-health-panel">
      <p className="text-sm text-foreground/70">{t('marketplace.health.description')}</p>
      {body}
    </PlainSection>
  );
}
