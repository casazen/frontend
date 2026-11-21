import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StayGuestsEditDialog } from '@/features/alloggiati/components/stay-guests-edit-dialog';
import { getProblemMessage } from '@/lib/api-errors';
import { useAlloggiatiGuestSummary } from '@/queries/use-alloggiati';

interface TicinoGuestsEditorProps {
  bookingId: string;
  onClose: () => void;
}

/**
 * «Completa i dati» of a guest the file of the Ticino police leaves out: the host form of the guests of the stay («Modifica ospiti», the one of the Alloggiati tab of the
 * booking), opened over the layer, so that the host never leaves the notification to finish what the file needs. The guests of the stay are read when the form opens and
 * let go when it closes (`gcTime: 0`: they hold the documents). It is rendered next to the steps and not inside a form of the layer: the form has one of its own, and the events of a
 * layer go up the tree of the page.
 */
export function TicinoGuestsEditor({ bookingId, onClose }: TicinoGuestsEditorProps) {
  const { t } = useTranslation();
  const summary = useAlloggiatiGuestSummary(bookingId, { gcTime: 0 });
  const onOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  // A read that failed is an error even when an older answer is still held: the form would offer to edit what may no longer be there.
  if (summary.data && !summary.isError) {
    return <StayGuestsEditDialog bookingId={bookingId} summary={summary.data} open onOpenChange={onOpenChange} />;
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent data-testid="ticino-guests-editor-wait">
        <DialogHeader>
          <DialogTitle>{t('alloggiati.editGuests.title')}</DialogTitle>
          <DialogDescription role={summary.isError ? 'alert' : 'status'}>
            {summary.isError ? (getProblemMessage(summary.error, t) ?? t('alloggiati.guestSummary.error')) : t('alloggiati.editGuests.loadingDocuments')}
          </DialogDescription>
        </DialogHeader>
        {summary.isError ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void summary.refetch()}>
              {t('alloggiati.guestSummary.retry')}
            </Button>
            <Button type="button" onClick={onClose}>
              {t('shared.close')}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
