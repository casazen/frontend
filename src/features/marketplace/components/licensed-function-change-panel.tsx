import { useRef } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useRequestFunctionChange } from '@/queries/use-marketplace';
import type { MarketplaceIntegrationProperty } from '@/types';
import { changeErrorText, leftUnchanged } from '../lib/change-errors';

/** The function of the license a change is asked for, for a property (`null`: the whole organization). */
export interface ChangeTarget {
  activationId: string;
  name: string;
  property: MarketplaceIntegrationProperty | null;
}

interface LicensedFunctionChangePanelProps {
  target: ChangeTarget;
  /** The request of the card: it is the card's, so that every button of the card is shut while it is on its way. */
  request: ReturnType<typeof useRequestFunctionChange>;
  /** Closes the panel (the card stops mounting it). */
  onClose: () => void;
}

/**
 * The change of a function of the channel manager's license (E09/F03/US02/T02, MKT-05, PO-12, AC-NF58-3). CasaZen cannot change the license, so the panel says so in plain words, gives the
 * text to send to the channel manager (it names the function and the property) with a «Copia» button, and «Ho fatto la richiesta» records that the host asked
 * (`POST …/change-request`): the card then says «Modifica richiesta il …» until the license shows the change. Nothing is sent to the channel manager by CasaZen. The call is made once, the
 * buttons are shut and the panel stays while the answer is on its way, and a refusal (a request already open, say) is said with whether anything was recorded.
 */
export function LicensedFunctionChangePanel({ target, request, onClose }: LicensedFunctionChangePanelProps) {
  const { t } = useTranslation();
  // The call is made once: a second press before the first answer comes (or Escape while it is on its way) does nothing.
  const inFlight = useRef(false);
  const busy = request.isPending;
  const text = target.property
    ? t('marketplace.change.function.template', { name: target.name, property: target.property.name })
    : t('marketplace.change.function.templateOrganization', { name: target.name });

  // The words of a refusal, and whether anything was recorded (said outside the markup: a key given to a function is not text to translate).
  const failure = request.isError ? changeErrorText(request.error, t, 'marketplace.change.function.failed') : null;

  const close = () => {
    if (inFlight.current) return;
    request.reset();
    onClose();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('marketplace.change.function.copied'));
    } catch {
      // The text is on the screen and can be selected: the person copies it by hand.
      toast.error(t('marketplace.change.function.copyFailed'));
    }
  };

  const asked = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await request.mutateAsync(target.activationId);
      toast.success(t('marketplace.change.function.requested'));
      request.reset();
      onClose();
    } catch {
      // The refusal is on the screen (`request.error`).
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent>
        <div className="grid gap-4" data-testid="change-panel">
          <DialogHeader>
            <DialogTitle>{t('marketplace.change.function.title', { name: target.name })}</DialogTitle>
            <DialogDescription>{t('marketplace.change.function.explain')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Textarea readOnly rows={5} value={text} aria-label={t('marketplace.change.function.textLabel')} data-testid="change-text" />
            <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal py-2" onClick={() => void copy()} disabled={busy} iconRight={<Copy />} data-testid="change-copy">
              {t('marketplace.change.function.copy')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t('marketplace.change.function.after')}</p>

          {busy ? (
            <p className="flex items-center gap-2 text-sm font-medium" role="status" data-testid="change-working">
              <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
              {t('marketplace.change.function.working')}
            </p>
          ) : null}
          {request.isError ? (
            <Alert variant="danger" data-testid="change-error">
              <p>{failure}</p>
              <p>{leftUnchanged(request.error) ? t('marketplace.change.outcome.unchanged') : t('marketplace.change.outcome.unknown')}</p>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={busy}>
              {t('shared.cancel')}
            </Button>
            <Button type="button" onClick={() => void asked()} disabled={busy} data-testid="change-asked">
              {t('marketplace.change.function.ask')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
