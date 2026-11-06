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

/** What makes the card of one of CasaZen's own integrations (calendars, card payments) different: it is not in the catalog. */
export interface BuiltInIntegration {
  /** The page where it is set up and managed. */
  href: string;
  icon: LucideIcon;
  /** How it stands when it is on ("2 calendari collegati"). */
  detail: string | null;
  /** False while its state is being read or could not be read: the card has no badge then, never a «Non attivo» that nobody checked. */
  showStatus: boolean;
}

interface MarketplaceEntryCardProps {
  entry: MarketplaceCatalogEntry;
  /** The property the marketplace is about: the wizards and the Active tab keep it. */
  propertyId: string | undefined;
  /** Only for CasaZen's own integrations: they lead to their own page and have no detail card. */
  builtIn?: BuiltInIntegration;
  testId?: string;
}

/** The logo of the integration; the initials of its name when it has none or the picture does not load; an icon for CasaZen's own. */
function EntryLogo({ name, logoUrl, icon: Icon }: { name: string; logoUrl: string | null; icon?: LucideIcon }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const src = failed ? null : httpsUrlOrNull(logoUrl);

  return (
    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary-text">
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
export function MarketplaceEntryCard({ entry, propertyId, builtIn, testId = `marketplace-entry-${entry.kind}-${entry.code}` }: MarketplaceEntryCardProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();

  const action: MarketplaceCardAction | null = builtIn
    ? { kind: entry.status === 'Active' ? 'manage' : 'activate', to: builtIn.href }
    : marketplaceAction(entry, propertyId, marketplaceReturnTarget(location));

  // The server says why a wizard cannot start; a reason this page has no text for is said in general words.
  const reasonKey = `marketplace.detail.reason.${entry.reason}`;
  const reason = !action && !builtIn && entry.reason ? t(i18n.exists(reasonKey) ? reasonKey : 'marketplace.detail.reason.unknown') : null;

  const invoicerKey = `marketplace.card.invoicedBy.${entry.cost.invoicedBy}`;
  const cost = entry.cost.text
    ? t('marketplace.card.cost', { text: entry.cost.text, invoicedBy: t(i18n.exists(invoicerKey) ? invoicerKey : 'marketplace.card.invoicedBy.Unknown') })
    : t('marketplace.card.costUnknown');

  const openDetails = (event: MouseEvent<HTMLButtonElement>) => {
    // The drawer gives the focus back to this button when it closes (Safari does not focus a button that is clicked, so it is said here).
    rememberOpener(event.currentTarget);
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set(MARKETPLACE_ENTRY_PARAM, marketplaceEntryValue(entry));
        return next;
      },
      // The card is part of the page, not a step of the way: it takes the place of the entry of the history, and Back leaves the page.
      { replace: true, preventScrollReset: true },
    );
  };

  return (
    <li className="flex h-full min-w-0 flex-col gap-3 rounded-lg border bg-card p-4" data-testid={testId}>
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
      <div className="mt-auto flex flex-wrap items-center gap-2">
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
