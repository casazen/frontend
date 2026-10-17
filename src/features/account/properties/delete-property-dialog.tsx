import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { longRentLeasePath, longRentPropertyPath } from '@/features/properties/long-rent/paths';
import { propertyBookingsPath } from '@/features/properties/properties-paths';
import { useWorkspace } from '@/hooks/use-workspace';
import { propertyDeleteBlock, type PropertyDeleteBlock } from '@/lib/property-delete-block';
import { useDeleteProperty } from '@/queries/use-properties';
import type { AccountPropertyRow } from './account-properties-model';

interface Blocked {
  row: AccountPropertyRow;
  block: PropertyDeleteBlock;
}

/** Where a refusal leads: to the stays that hold the property, or to the lease that does; nothing when the person may open neither. */
function useWayOut({ row, block }: Blocked): { label: string; to: string } | null {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();

  if (block === 'bookings') {
    return hasPermission('short-rent', 'booking.read') ? { label: t('accountProperties.blocked.bookings.action'), to: propertyBookingsPath(row.property.id) } : null;
  }
  if (row.lease && hasPermission('long-rent', 'lease.read')) return { label: t('accountProperties.blocked.leases.action'), to: longRentLeasePath(row.lease.id) };
  return hasPermission('long-rent', 'property.read') ? { label: t('accountProperties.blocked.leases.actionProperty'), to: longRentPropertyPath(row.property.id) } : null;
}

/** The two refusals of the backend, in words, with the way to what has to be settled first: never a dead end. */
function BlockedDialog({ blocked, onClose }: { blocked: Blocked | null; onClose: () => void }) {
  return (
    <Dialog open={blocked !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{blocked ? <BlockedBody blocked={blocked} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}

function BlockedBody({ blocked, onClose }: { blocked: Blocked; onClose: () => void }) {
  const { t } = useTranslation();
  const wayOut = useWayOut(blocked);

  return (
    <div className="grid gap-4" data-testid="delete-blocked">
      <DialogHeader>
        <DialogTitle>{t('accountProperties.blocked.title', { name: blocked.row.property.name })}</DialogTitle>
        <DialogDescription>
          {blocked.block === 'bookings' ? t('accountProperties.blocked.bookings.text') : t('accountProperties.blocked.leases.text')}
        </DialogDescription>
      </DialogHeader>
      <p className="text-sm text-foreground/70">{t('accountProperties.blocked.later')}</p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t('accountProperties.blocked.close')}
        </Button>
        {wayOut ? (
          <Button asChild>
            <Link to={wayOut.to} data-testid="delete-blocked-action">
              {wayOut.label}
            </Link>
          </Button>
        ) : null}
      </DialogFooter>
    </div>
  );
}

interface DeletePropertyDialogProps {
  /** The property to delete; `null` while the dialog is closed. */
  row: AccountPropertyRow | null;
  onClose: () => void;
}

/**
 * «Elimina l'immobile» (AM-13, AM-D23): a deletion that the person cannot take back from here, so it asks for the word. It says what
 * it does as it is (the property goes out of the lists, the calendar and the site; documents and fiscal data stay, as the law asks to
 * keep them) and, when the backend refuses because a stay or a lease is still to come, it says so and leads to it.
 */
export function DeletePropertyDialog({ row, onClose }: DeletePropertyDialogProps) {
  const { t } = useTranslation();
  const remove = useDeleteProperty({ explainBlocked: true });
  const [blocked, setBlocked] = useState<Blocked | null>(null);

  const confirm = async () => {
    if (!row) return;
    try {
      await remove.mutateAsync(row.property.id);
    } catch (error) {
      // Any other failure has been told by the toast of the mutation; the two refusals are told here, with the way out.
      const block = propertyDeleteBlock(error);
      if (block) setBlocked({ row, block });
    }
  };

  return (
    <>
      <ConfirmationDialog
        open={row !== null}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={t('accountProperties.delete.title', { name: row?.property.name ?? '' })}
        description={t('accountProperties.delete.description')}
        confirmLabel={t('accountProperties.delete.confirm')}
        variant="destructive"
        requireText={t('accountProperties.delete.word')}
        consequences={[t('accountProperties.delete.consequenceKept'), t('accountProperties.delete.consequenceSlot')]}
        onConfirm={confirm}
        isLoading={remove.isPending}
      />
      <BlockedDialog blocked={blocked} onClose={() => setBlocked(null)} />
    </>
  );
}
