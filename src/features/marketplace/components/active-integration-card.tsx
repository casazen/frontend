import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { translateErrorCode } from '@/lib/api-errors';
import { formatDeclaredDay, formatInstant, formatInstantDay, type ActiveRow } from '../lib/active-model';
import { initialsOf } from '../lib/marketplace-entry';
import { useOpenEntryDetails } from '../lib/use-entry-details';
import type { Integration, IntegrationStatus } from '../lib/use-integrations';
import { MarketplaceStatusBadge } from './marketplace-status-badge';

const CARD = 'flex h-full min-w-0 flex-col gap-3 rounded-lg border bg-card p-4';

interface ActiveIntegrationCardProps {
  row: ActiveRow;
  /** Where «Correggi» leads for this row; `null` when the person may not start the wizard of its kind (no `ota.write`, the connector is off) or none exists. */
  fixTo: string | null;
}

/** The mark of a row: the initials of its name (the active list carries no logo). */
function Initials({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary-text">
      {initialsOf(name)}
    </span>
  );
}

/**
 * One activation of the Active tab (E09/F03/US02/T01, MKT-04, NF-57): the name, the property, where it stands, and what is known about it and only that: «declared by you
 * on …» while only the host's word backs it («verified» only when the server says so), the last sync (Europe/Rome), the problem in the words the server sent, the quota
 * warning in one sentence and the date of a change that was asked for. A state that is not finished is shown as it is: waiting is `In attesa`, never «attiva».
 */
export function ActiveIntegrationCard({ row, fixTo }: ActiveIntegrationCardProps) {
  const { t, i18n } = useTranslation();
  const openDetails = useOpenEntryDetails();
  const testId = `marketplace-active-${row.kind}-${row.code}-${row.property?.id ?? 'org'}`;
  const language = i18n.language;

  const verified = formatInstantDay(row.verifiedAt, language);
  const declared = formatDeclaredDay(row.declaredAt, language);
  const lastSync = formatInstant(row.lastSyncedAt, language);
  const error = row.health?.error ?? null;
  const changeRequested = formatInstantDay(row.health?.changeRequestedAt, language);
  // A partner is declared by the host and never read from the channel manager: «never checked» would be said of something nobody checks.
  const syncs = row.kind !== 'Partner';

  return (
    <li className={CARD} data-testid={testId}>
      <div className="flex min-w-0 items-start gap-3">
        <Initials name={row.name} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="break-words font-medium">{row.name}</h3>
            <MarketplaceStatusBadge status={row.status} declared={row.isDeclared && !row.verifiedAt} data-testid={`${testId}-status`} />
          </div>
          <p className="break-words text-sm text-foreground/70" data-testid={`${testId}-property`}>
            {row.property ? t('marketplace.mine.card.property', { name: row.property.name }) : t('marketplace.mine.card.wholeOrganization')}
          </p>
          {row.verifiedAt ? (
            <p className="text-sm text-foreground/70" data-testid={`${testId}-trust`}>
              {verified ? t('marketplace.mine.card.verified', { date: verified }) : t('marketplace.mine.card.verifiedNoDate')}
            </p>
          ) : row.isDeclared ? (
            <p className="text-sm text-foreground/70" data-testid={`${testId}-trust`}>
              {declared ? t('marketplace.mine.card.declared', { date: declared }) : t('marketplace.mine.card.declaredNoDate')}
            </p>
          ) : null}
          {syncs ? (
            <p className="text-sm text-foreground/70" data-testid={`${testId}-sync`}>
              {lastSync ? t('marketplace.mine.card.lastSync', { when: lastSync }) : t('marketplace.mine.card.neverSynced')}
            </p>
          ) : null}
          {error ? (
            <p className="break-words text-sm font-medium text-[color:var(--color-danger-foreground,#b4232a)]" data-testid={`${testId}-error`}>
              {error.message || translateErrorCode(error.code, t) || t('marketplace.mine.card.errorGeneric')}
            </p>
          ) : null}
          {row.health?.quota?.warn ? (
            <p className="text-sm font-medium text-[color:var(--color-warning-foreground,#8a4b05)]" data-testid={`${testId}-quota`}>
              {t('marketplace.mine.card.quotaWarn')}
            </p>
          ) : null}
          {changeRequested ? (
            <p className="text-sm text-foreground/70" data-testid={`${testId}-change`}>
              {t('marketplace.mine.card.changeRequested', { date: changeRequested })}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {fixTo ? (
          <Button asChild size="sm">
            <Link to={fixTo} aria-label={t('marketplace.mine.card.fixAria', { name: row.name })} data-testid={`${testId}-fix`}>
              {t('marketplace.mine.card.fix')}
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(event) => openDetails(row, row.property?.id, event.currentTarget)}
          aria-label={t('marketplace.mine.card.detailsAria', { name: row.name })}
          data-testid={`${testId}-details`}
        >
          {t('marketplace.mine.card.details')}
        </Button>
      </div>
    </li>
  );
}

const BUILT_IN_STATUS_VARIANT: Record<Exclude<IntegrationStatus, 'loading' | 'unknown'>, NonNullable<BadgeProps['variant']>> = {
  active: 'success',
  pending: 'warning',
  inactive: 'outline',
};

/**
 * One of the integrations CasaZen has of its own (the calendars of the portals, the card payments): its name, what it is for, how it stands, and the page where it is managed.
 * Nothing about it comes from the channel manager, so there is no health and no change to make here.
 */
export function BuiltInIntegrationCard({ integration }: { integration: Integration }) {
  const { t } = useTranslation();
  const { id, icon: Icon, href, status, count } = integration;
  const key = `marketplace.integrations.items.${id}`;
  const on = status === 'active';

  return (
    <li className={CARD} data-testid={`marketplace-integration-${id}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-text">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="break-words font-medium">{t(`${key}.title`)}</h3>
            {status !== 'loading' && status !== 'unknown' ? (
              <Badge variant={BUILT_IN_STATUS_VARIANT[status]} data-testid={`marketplace-integration-${id}-status`}>
                {t(`marketplace.integrations.status.${status}`)}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-foreground/70">{t(`${key}.summary`)}</p>
          {on ? <p className="text-sm font-medium">{t(`${key}.detail`, { count: count ?? 0 })}</p> : null}
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="mt-auto self-start">
        <Link to={href}>{t('marketplace.integrations.manage')}</Link>
      </Button>
    </li>
  );
}
