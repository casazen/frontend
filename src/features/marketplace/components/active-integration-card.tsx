import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { translateErrorCode } from '@/lib/api-errors';
import { useDeactivateActivation, useRequestFunctionChange, useUpdateActivationSettings } from '@/queries/use-marketplace';
import { formatDeclaredDay, formatInstant, formatInstantDay, type ActiveRow } from '../lib/active-model';
import { initialsOf } from '../lib/marketplace-entry';
import { useOpenEntryDetails } from '../lib/use-entry-details';
import type { Integration, IntegrationStatus } from '../lib/use-integrations';
import { DeactivateIntegrationDialog } from './deactivate-integration-dialog';
import { IntegrationSettingsDialog } from './integration-settings-dialog';
import { LicensedFunctionChangePanel } from './licensed-function-change-panel';
import { MarketplaceStatusBadge } from './marketplace-status-badge';

const CARD = 'flex h-full min-w-0 flex-col gap-3 rounded-lg border bg-card p-4';

/** What the menu of a card can open. */
type CardAction = 'settings' | 'deactivate' | 'change';

interface ActiveIntegrationCardProps {
  row: ActiveRow;
  /** Where «Correggi» leads for this row; `null` when the person may not start the wizard of its kind (no `ota.write`, the connector is off) or none exists. */
  fixTo: string | null;
  /**
   * Whether the person may change or turn off this activation: `ota.write` and, for what goes through the channel manager, the connector on (as the backend asks). Without it the
   * card has no menu: nothing is offered that the server would refuse.
   */
  mayManage: boolean;
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
 * What the menu of a card offers, by what the card is (MKT-05): the settings of a channel or a tool, the deactivation of a channel, a tool or a partner, the change request of a
 * function of the license (a function that is on, or to fix, and has no request open). It needs the id of the activation, which only the health row (or a list that sends it) has:
 * without it nothing is offered.
 */
function actionsOf(row: ActiveRow, mayManage: boolean): CardAction[] {
  if (!mayManage || !row.activationId) return [];
  switch (row.kind) {
    case 'Channel':
    case 'Tool':
      return ['settings', 'deactivate'];
    case 'Partner':
      return ['deactivate'];
    case 'LicensedFunction':
      return row.status === 'Active' || row.status === 'ToFix' ? ['change'] : [];
    default:
      return [];
  }
}

/**
 * One activation of the Active tab (E09/F03/US02/T01 and T02, MKT-04, MKT-05, NF-57, NF-58): the name, the property, where it stands, and what is known about it and only that:
 * «declared by you on …» while only the host's word backs it («verified» only when the server says so), the last sync (Europe/Rome), the problem in the words the server sent, the quota
 * warning in one sentence and the date of a change that was asked for. A state that is not finished is shown as it is: waiting is `In attesa`, never «attiva». The menu changes the settings,
 * turns it off, or asks for a change of the license, each in a dialog that says its effect; every button of the card is shut while any request of the card is on its way.
 */
export function ActiveIntegrationCard({ row, fixTo, mayManage }: ActiveIntegrationCardProps) {
  const { t, i18n } = useTranslation();
  const openDetails = useOpenEntryDetails();
  const [open, setOpen] = useState<CardAction | null>(null);
  // The three calls of the card: one of them on its way shuts every button of the card, the buttons that open the others included.
  const settings = useUpdateActivationSettings();
  const deactivate = useDeactivateActivation();
  const change = useRequestFunctionChange();
  const busy = settings.isPending || deactivate.isPending || change.isPending;
  const testId = `marketplace-active-${row.kind}-${row.code}-${row.property?.id ?? 'org'}`;
  const language = i18n.language;

  const verified = formatInstantDay(row.verifiedAt, language);
  const declared = formatDeclaredDay(row.declaredAt, language);
  const lastSync = formatInstant(row.lastSyncedAt, language);
  const error = row.health?.error ?? null;
  const changeRequested = formatInstantDay(row.health?.changeRequestedAt, language);
  // A partner is declared by the host and never read from the channel manager: «never checked» would be said of something nobody checks.
  const syncs = row.kind !== 'Partner';
  const actions = actionsOf(row, mayManage);
  const activationId = row.activationId;

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
          busy ? (
            <Button type="button" size="sm" disabled data-testid={`${testId}-fix`}>
              {t('marketplace.mine.card.fix')}
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to={fixTo} aria-label={t('marketplace.mine.card.fixAria', { name: row.name })} data-testid={`${testId}-fix`}>
                {t('marketplace.mine.card.fix')}
              </Link>
            </Button>
          )
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={(event) => openDetails(row, row.property?.id, event.currentTarget)}
          aria-label={t('marketplace.mine.card.detailsAria', { name: row.name })}
          data-testid={`${testId}-details`}
        >
          {t('marketplace.mine.card.details')}
        </Button>
        {actions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto"
                disabled={busy}
                aria-label={t('marketplace.mine.card.actionsAria', { name: row.name })}
                data-testid={`${testId}-actions`}
              >
                <MoreHorizontal aria-hidden="true" className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.includes('settings') ? (
                <DropdownMenuItem className="pointer-coarse:min-h-11" onSelect={() => setOpen('settings')} data-testid={`${testId}-settings`}>
                  {t('marketplace.change.menu.settings')}
                </DropdownMenuItem>
              ) : null}
              {actions.includes('change') ? (
                // One request is open at a time: while the license has not answered it, the card says when it was asked and there is nothing to ask again.
                <DropdownMenuItem className="pointer-coarse:min-h-11" disabled={!!row.health?.changeRequestedAt} onSelect={() => setOpen('change')} data-testid={`${testId}-change-request`}>
                  {t('marketplace.change.menu.change')}
                </DropdownMenuItem>
              ) : null}
              {actions.includes('deactivate') ? (
                <DropdownMenuItem
                  className="pointer-coarse:min-h-11 text-danger-foreground focus:text-danger-foreground"
                  onSelect={() => setOpen('deactivate')}
                  data-testid={`${testId}-deactivate`}
                >
                  {t('marketplace.change.menu.deactivate')}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {/* The dialogs are mounted only while they are open (what was typed or ticked is forgotten with them) and are not inside a form. */}
      {open === 'settings' && activationId && (row.kind === 'Channel' || row.kind === 'Tool') ? (
        <IntegrationSettingsDialog
          target={{ activationId, kind: row.kind, code: row.code, name: row.name, property: row.property }}
          update={settings}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === 'deactivate' && activationId ? (
        <DeactivateIntegrationDialog
          target={{ activationId, kind: row.kind, code: row.code, name: row.name, property: row.property }}
          deactivate={deactivate}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === 'change' && activationId ? (
        <LicensedFunctionChangePanel target={{ activationId, name: row.name, property: row.property }} request={change} onClose={() => setOpen(null)} />
      ) : null}
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
