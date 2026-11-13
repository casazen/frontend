import { Ellipsis } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { otherActionsOf, primaryActionOf, type ActionKey, type RowActions } from '../owner-accounting-model';

interface OwnerActionButtonsProps {
  actions: RowActions;
  busy?: boolean;
  onAsk: (action: ActionKey) => void;
  /** Prefix of the `data-testid`s (`row-<owner>` on the month page). */
  testId: string;
}

/**
 * The next step of an owner's month as the one button, and the others in «⋯» (approve, publish, pay, close, a new version): one thing to do at a
 * time. A published statement has no «edit»: the only change it offers is a new version, which supersedes it. What cannot be done now says why in
 * a line (the ledger changed after the version; the month is not over), never as a button that would be refused. While a step of the card is on its way (`busy`) none of its
 * buttons can be pressed, the «⋯» menu included.
 */
export function OwnerActionButtons({ actions, busy = false, onAsk, testId }: OwnerActionButtonsProps) {
  const { t } = useTranslation();
  const primary = primaryActionOf(actions);
  const others = otherActionsOf(actions);

  return (
    <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end" data-testid={`${testId}-actions`}>
      <div className="flex flex-wrap items-center gap-2">
        {primary ? (
          <Button type="button" size="sm" loading={busy} onClick={() => onAsk(primary)} data-testid={`${testId}-${primary}`}>
            {t(`ownerAccounting.actions.${primary}.label`)}
          </Button>
        ) : null}
        {others.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" disabled={busy} aria-label={t('ownerAccounting.actions.more')} data-testid={`${testId}-more`}>
                <Ellipsis className="h-5 w-5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {others.map((action) => (
                <DropdownMenuItem key={action} onSelect={() => onAsk(action)} data-testid={`${testId}-menu-${action}`}>
                  {t(`ownerAccounting.actions.${action}.label`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {actions.stale ? (
        <p className="max-w-xs break-words text-sm text-foreground/70 sm:text-right" data-testid={`${testId}-stale`}>
          {t('ownerAccounting.actions.stale')}
        </p>
      ) : null}
      {actions.closeWaitsForTheEnd ? (
        <p className="max-w-xs break-words text-sm text-foreground/70 sm:text-right" data-testid={`${testId}-waits`}>
          {t('ownerAccounting.actions.closeWaits')}
        </p>
      ) : null}
    </div>
  );
}
