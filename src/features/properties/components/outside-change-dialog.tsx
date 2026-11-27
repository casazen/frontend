import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getProblemMessage } from '@/lib/api-errors';
import { useResolveOutsideChange, type AdoptedTexts } from '@/queries/use-listing-status';
import type { ListingChannelStatus, OutsideChangeChoice } from '@/types';
import { canTakeTheirs } from '../wizard/channels-model';
import { useChannelName } from './channel-name';

interface OutsideChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  rows: readonly ListingChannelStatus[];
  onAdopted?: (adopted: AdoptedTexts) => void;
}

interface Pending {
  row: ListingChannelStatus;
  choice: OutsideChangeChoice;
}

export function OutsideChangeDialog({ open, onOpenChange, propertyId, rows, onAdopted }: OutsideChangeDialogProps) {
  const { t, i18n } = useTranslation();
  const channelName = useChannelName();
  const resolve = useResolveOutsideChange(propertyId);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [rereadFailed, setRereadFailed] = useState(false);

  const groupNames = (groups: readonly string[]) =>
    groups.map((group) => (i18n.exists(`listingStatus.groups.${group}`) ? t(`listingStatus.groups.${group}`) : group)).join(', ');

  const close = (next: boolean) => {
    if (!next) {
      setPending(null);
      setError(null);
      setRereadFailed(false);
    }
    onOpenChange(next);
  };

  const confirm = async () => {
    if (!pending) return;
    setError(null);
    setRereadFailed(false);
    try {
      const result = await resolve.mutateAsync({ channelCode: pending.row.channel, choice: pending.choice });
      setPending(null);
      if (result.adopted) onAdopted?.(result.adopted);
      if (result.rereadFailed) {
        setRereadFailed(true);
        return;
      }
      if (rows.length <= 1) onOpenChange(false);
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent data-testid="outside-change-dialog">
        <DialogHeader>
          <DialogTitle>{t('listingStatus.outside.title')}</DialogTitle>
          <DialogDescription>{t('listingStatus.outside.description')}</DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="danger" data-testid="outside-change-error">
            {getProblemMessage(error, t) ?? t('listingStatus.outside.failed')}
          </Alert>
        ) : null}

        {rereadFailed ? (
          <Alert variant="warning" data-testid="outside-change-reread">
            {t('listingStatus.outside.reread')}
          </Alert>
        ) : null}

        {pending ? (
          <div className="space-y-4" data-testid="outside-change-confirm">
            <p className="text-sm font-medium">{channelName(pending.row.channel)}</p>
            <p className="text-sm">
              {pending.choice === 'take'
                ? t('listingStatus.outside.confirmTake', { fields: t('listingStatus.outside.takeLoses') })
                : t('listingStatus.outside.confirmKeep', { fields: groupNames(pending.row.changedOutside) })}
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={resolve.isPending} onClick={() => setPending(null)}>
                {t('listingStatus.outside.back')}
              </Button>
              <Button
                type="button"
                variant={pending.choice === 'take' ? 'destructive' : 'default'}
                loading={resolve.isPending}
                onClick={() => void confirm()}
                data-testid="outside-change-continue"
              >
                {t('listingStatus.outside.continue')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <ul className="space-y-4">
            {rows.map((row) => (
              <li key={row.channel} className="space-y-3 rounded-lg p-4 ring-1 ring-inset ring-border" data-testid={`outside-change-${row.channel}`}>
                <div className="space-y-1">
                  <p className="font-medium">{channelName(row.channel)}</p>
                  <p className="text-sm text-foreground/70">{t('listingStatus.outside.changed', { groups: groupNames(row.changedOutside) })}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="default" onClick={() => setPending({ row, choice: 'keep' })} data-testid="outside-change-keep">
                    {t('listingStatus.outside.keep')}
                  </Button>
                  {canTakeTheirs(row.changedOutside) ? (
                    <Button type="button" variant="outline" onClick={() => setPending({ row, choice: 'take' })} data-testid="outside-change-take">
                      {t('listingStatus.outside.take')}
                    </Button>
                  ) : (
                    <p className="text-sm text-foreground/70">{t('listingStatus.outside.takeNotPossible')}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
