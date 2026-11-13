import { useState } from 'react';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GuestsEditor } from '@/features/checkin/wizard/steps/guests-step';
import { ALLOGGIATI_KEY } from '@/queries/use-alloggiati';

interface SubflowProps {
  bookingId: string;
  /** The panel is open. It is mounted only while it is, so each visit starts clean: nothing typed, nothing saved. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The sub-step of the check-out wizard "Complete the guests' data" (E08/F04/US01, NF-45, NF-02): a layer over the wizard, so that the host never leaves it to
 * finish what Alloggiati Web needs. It mounts the guests editor of the check-in wizard (`GuestsEditor`: one component, not a copy), which saves through the
 * check-in endpoints with its own "Save guests". "Done" and "Cancel" give back the same step of the wizard, whose answers were never touched (the layer is not
 * a page and not a form of the wizard); "Done" also asks for the Alloggiati status again, so the step shows the new state.
 *
 * It must be rendered next to the wizard and not inside its form: the editor has a form of its own and the events of a layer go up the tree of the page.
 */
export function CheckoutGuestDataSubflow({ bookingId, open, onOpenChange }: SubflowProps) {
  if (!open) return null;
  return <SubflowLayer bookingId={bookingId} onClose={() => onOpenChange(false)} />;
}

function SubflowLayer({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showUnsaved, setShowUnsaved] = useState(false);
  // The buttons stay off while any request is on its way: the layer must not close over a save that has not answered.
  const busy = useIsMutating() > 0;

  // Leaving by any way but "Cancel" never throws away what the host typed: it says so and stays.
  const leave = () => {
    if (busy) return;
    if (dirty) {
      setShowUnsaved(true);
      return;
    }
    onClose();
  };

  const done = () => {
    if (busy) return;
    if (dirty) {
      setShowUnsaved(true);
      return;
    }
    // The status is read again whether the guests were saved here or not: the step and the notice that opened this layer show what the server holds now.
    void queryClient.invalidateQueries({ queryKey: [ALLOGGIATI_KEY, 'status', bookingId] });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) leave();
      }}
    >
      <DialogContent
        className="max-h-[90dvh] max-w-3xl overflow-y-auto"
        // A form with this many fields is not closed by a stray click outside it.
        onInteractOutside={(event) => event.preventDefault()}
        data-testid="checkout-guest-data-subflow"
      >
        <DialogHeader>
          <DialogTitle>{t('compliance.checkout.guestData.title')}</DialogTitle>
          <DialogDescription>{t('compliance.checkout.guestData.description')}</DialogDescription>
        </DialogHeader>

        <GuestsEditor
          bookingId={bookingId}
          onDirtyChange={setDirty}
          onSaved={() => {
            setSaved(true);
            setShowUnsaved(false);
          }}
        />

        {saved && !dirty && (
          <p role="status" className="text-sm text-green-700" data-testid="checkout-guest-data-saved">
            {t('compliance.checkout.guestData.saved')}
          </p>
        )}
        {showUnsaved && dirty && (
          <p role="alert" className="text-sm text-destructive" data-testid="checkout-guest-data-unsaved">
            {t('compliance.checkout.guestData.unsaved')}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose} data-testid="checkout-guest-data-cancel">
            {t('compliance.checkout.guestData.cancel')}
          </Button>
          <Button type="button" disabled={busy} onClick={done} data-testid="checkout-guest-data-done">
            {t('compliance.checkout.guestData.done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
