import { useState, type MouseEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { rememberOpener } from '@/components/shared/detail-drawer/detail-opener';
import { Button } from '@/components/ui/button';
import type { MarketplaceCatalogEntry } from '@/types';
import { httpsUrlOrNull, initialsOf, marketplaceAction, marketplaceEntryValue, marketplaceReturnTarget, type MarketplaceCardAction } from '../lib/marketplace-entry';
import { MARKETPLACE_ENTRY_PARAM } from '../lib/marketplace-paths';
import { MarketplaceStatusBadge } from './marketplace-status-badge';

export interface BuiltInIntegration {
  href: string;
  icon: LucideIcon;
  detail: string | null;
  showStatus: boolean;
}

interface MarketplaceEntryCardProps {
  entry: MarketplaceCatalogEntry;
  builtIn?: BuiltInIntegration;
  testId?: string;
}

function EntryLogo({ name, logoUrl, icon: Icon }: { name: string; logoUrl: string | null; icon?: LucideIcon }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const src = failed ? null : httpsUrlOrNull(logoUrl);

  return (
    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-primary-text">
      {src ? (
        <img src={src} alt={t('marketplace.card.logoAlt', { name })} loading="lazy" onError={() => setFailed(true)} className="size-full object-contain" />
      ) : Icon ? (
        <Icon aria-hidden="true" className="size-5" />
      ) : (
        <span aria-hidden="true" className="text-sm font-semibold">
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}

/**
 * A card of the marketplace (MKT-01): the logo, the name, one line on what it is for, what it costs and who invoices (or that the cost
 * is not specified: never an invented price), where it stands, and one action: Activate or Fix (they open the wizard), Manage (the
 * Active tab). «Dettagli» opens the detail card, which the address names (`?entry=<kind>:<code>`) so that it can be shared.
 */
export function MarketplaceEntryCard({ entry, builtIn, testId = `marketplace-entry-${entry.kind}-${entry.code}` }: MarketplaceEntryCardProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();

  const action: MarketplaceCardAction | null = builtIn
    ? { kind: entry.status === 'Active' ? 'manage' : 'activate', to: builtIn.href }
    : marketplaceAction(entry, undefined, marketplaceReturnTarget(location));

  const reasonKey = `marketplace.detail.reason.${entry.reason}`;
  const reason = !action && !builtIn && entry.reason ? t(i18n.exists(reasonKey) ? reasonKey : 'marketplace.detail.reason.unknown') : null;

  const invoicerKey = `marketplace.card.invoicedBy.${entry.cost.invoicedBy}`;
  const cost = entry.cost.text
    ? t('marketplace.card.cost', { text: entry.cost.text, invoicedBy: t(i18n.exists(invoicerKey) ? invoicerKey : 'marketplace.card.invoicedBy.Unknown') })
    : t('marketplace.card.costUnknown');

  const openDetails = (event: MouseEvent<HTMLButtonElement>) => {
    rememberOpener(event.currentTarget);
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set(MARKETPLACE_ENTRY_PARAM, marketplaceEntryValue(entry));
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  return (
    <li className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm" data-testid={testId}>
      <div className="flex min-w-0 items-start gap-3">
        <EntryLogo key={entry.logoUrl ?? ''} name={entry.name} logoUrl={builtIn ? null : entry.logoUrl} icon={builtIn?.icon} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="break-words font-medium">{entry.name}</h3>
            {builtIn?.showStatus === false ? null : <MarketplaceStatusBadge status={entry.status} data-testid={`${testId}-status`} />}
          </div>
          {entry.benefit ? <p className="text-sm text-foreground/70">{entry.benefit}</p> : null}
          {builtIn?.detail ? <p className="text-sm font-medium">{builtIn.detail}</p> : null}
          <p className="text-sm text-foreground/70" data-testid={`${testId}-cost`}>
            {cost}
          </p>
          {reason ? (
            <p className="text-sm text-foreground/70" data-testid={`${testId}-reason`}>
              {reason}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {action ? (
          <Button asChild variant={action.kind === 'manage' ? 'outline' : 'default'} size="sm">
            <Link to={action.to} aria-label={t(`marketplace.card.${action.kind}Aria`, { name: entry.name })} data-testid={`${testId}-action`}>
              {t(`marketplace.card.${action.kind}`)}
            </Link>
          </Button>
        ) : null}
        {builtIn ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openDetails}
            aria-label={t('marketplace.card.detailsAria', { name: entry.name })}
            data-testid={`${testId}-details`}
          >
            {t('marketplace.card.details')}
          </Button>
        )}
      </div>
    </li>
  );
}
