import { useId, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getHttpStatus } from '@/lib/api-errors';
import { useDeactivateActivation, useDeactivationPreview } from '@/queries/use-marketplace';
import type { MarketplaceActivationStatus, MarketplaceEntryKind, MarketplaceIntegrationProperty } from '@/types';
import { changeErrorText, leftUnchanged } from '../lib/change-errors';
import { PartnerDeactivationGuide } from './partner-deactivation-guide';

/** What is turned off: the activation, what it is, and the property it is for (`null`: the whole organization). */
export interface DeactivateTarget {
  activationId: string;
  kind: MarketplaceEntryKind;
  code: string;
  name: string;
  property: MarketplaceIntegrationProperty | null;
}

interface DeactivateIntegrationDialogProps {
  target: DeactivateTarget;
  /** The deactivation of the card: it is the card's, so that every button of the card is shut while it is on its way. */
  deactivate: ReturnType<typeof useDeactivateActivation>;
  /** Closes the dialog (the card stops mounting it): what was typed or ticked is forgotten with it. */
  onClose: () => void;
}

/**
 * Turns an integration off, after saying what that does (E09/F03/US02/T02, MKT-05, NF-58, AC-NF58-2). The dialog opens by reading `GET …/deactivation-preview` and shows the effect in
 * the server's own sentences, with the name of the integration and the property: without them the button that deactivates stays off, and so it does until the person ticks that they read
 * them. «Lascia com'è» is the main button; «Disattiva» is the quiet, red one, and nothing is the default action (the focus starts on the tick). The call carries `confirmed: true` and is
 * made once: the buttons are shut and the dialog stays while the answer is on its way, a refusal or an answer that never came is said (and whether the activation was left as it was),
 * and an answer that is not `Deactivated` is said as what it is and is never a success. A partner is turned off on its own site: its guide goes first, and the step is «L'ho fatto».
 * It is mounted by the card only while it is open, and it is not inside a form (the dialog of the app stops the submit of its own form from reaching one around it all the same).
 */
export function DeactivateIntegrationDialog({ target, deactivate, onClose }: DeactivateIntegrationDialogProps) {
  const { t } = useTranslation();
  const tickId = useId();
  const preview = useDeactivationPreview(target.activationId);
  const [confirmed, setConfirmed] = useState(false);
  const [notDone, setNotDone] = useState<MarketplaceActivationStatus | null>(null);
  // The call is made once: a second press before the first answer comes (or Escape while it is on its way) does nothing.
  const inFlight = useRef(false);
  const partner = target.kind === 'Partner';
  const busy = deactivate.isPending;
  // What the person confirms is what was shown: the effect is read, and has been ticked.
  const ready = !!preview.data && !preview.isError && confirmed;

  const handleOpenChange = (open: boolean) => {
    if (open || inFlight.current) return;
    deactivate.reset();
    onClose();
  };

  const confirm = async () => {
    if (inFlight.current || !ready) return;
    inFlight.current = true;
    setNotDone(null);
    try {
      const change = await deactivate.mutateAsync(target.activationId);
      if (change.status !== 'Deactivated') {
        // Partial, or not what was asked: it is said as that, and the dialog stays (a dialog that throws is kept open by the confirmation dialog).
        setNotDone(change.status);
        throw new Error('The activation was not deactivated');
      }
      toast.success(t('marketplace.deactivate.done', { name: target.name }));
    } finally {
      inFlight.current = false;
    }
  };

  // The words of a refusal, and whether the activation was left as it was (said outside the markup: a key given to a function is not text to translate).
  const failure = deactivate.isError ? changeErrorText(deactivate.error, t, 'marketplace.deactivate.failed') : null;

  const description = target.property
    ? t('marketplace.deactivate.descriptionProperty', { name: target.name, property: target.property.name })
    : t('marketplace.deactivate.descriptionOrganization', { name: target.name });

  return (
    <ConfirmationDialog
      open
      onOpenChange={handleOpenChange}
      title={t('marketplace.deactivate.title', { name: target.name })}
      description={description}
      confirmLabel={partner ? t('marketplace.deactivate.partner.confirm') : t('marketplace.deactivate.confirm')}
      cancelLabel={t('marketplace.deactivate.keep')}
      // «Lascia com'è» is the main button, and what turns off is the quiet red one: the destructive action is never the primary one.
      variant="danger-outline"
      cancelVariant="default"
      confirmDisabled={!ready}
      isLoading={busy}
      onConfirm={confirm}
    >
      <div className="grid gap-4" data-testid="deactivate-dialog-body">
        {partner ? <PartnerDeactivationGuide code={target.code} name={target.name} propertyId={target.property?.id} /> : null}

        <section className="space-y-1.5" aria-label={t('marketplace.deactivate.effectsTitle')} data-testid="deactivate-effects">
          <h3 className="text-sm font-semibold">{t('marketplace.deactivate.effectsTitle')}</h3>
          {preview.isError ? (
            // A 404 is «not found» whatever the cache still holds of an older read.
            getHttpStatus(preview.error) === 404 ? (
              <Alert variant="warning" data-testid="deactivate-preview-not-found">
                {t('marketplace.deactivate.previewNotFound')}
              </Alert>
            ) : (
              <Alert
                variant="danger"
                data-testid="deactivate-preview-error"
                action={
                  <Button type="button" variant="outline" size="sm" onClick={() => void preview.refetch()}>
                    {t('marketplace.deactivate.retry')}
                  </Button>
                }
              >
                {t('marketplace.deactivate.previewError')}
              </Alert>
            )
          ) : preview.data ? (
            <ul role="list" className="grid gap-2" data-testid="deactivate-effects-list">
              {preview.data.effects.map((effect, index) => (
                <li key={`${index}-${effect}`} className="flex items-start gap-2 text-sm">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <span className="min-w-0 break-words">{effect}</span>
                </li>
              ))}
            </ul>
          ) : (
            <SkeletonLine lines={3} label={t('marketplace.deactivate.previewLoading')} />
          )}
          {target.kind === 'Channel' && preview.data ? <p className="text-sm text-foreground/80">{t('marketplace.deactivate.channelNote')}</p> : null}
          {preview.data ? <p className="text-sm text-foreground/80">{t('marketplace.deactivate.reactivate')}</p> : null}
        </section>

        <div className="flex min-h-11 items-start gap-3 rounded-md border p-3">
          <Checkbox id={tickId} checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} disabled={busy || !preview.data} className="mt-0.5" data-testid="deactivate-confirm-check" />
          <Label htmlFor={tickId} className="min-w-0 flex-1 cursor-pointer break-words text-sm font-medium leading-snug">
            {partner ? t('marketplace.deactivate.partner.confirmCheck', { name: target.name }) : t('marketplace.deactivate.confirmCheck', { name: target.name })}
          </Label>
        </div>

        {busy ? (
          <p className="flex items-center gap-2 text-sm font-medium" role="status" data-testid="deactivate-working">
            <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
            {t('marketplace.deactivate.working')}
          </p>
        ) : null}
        {deactivate.isError ? (
          <Alert variant="danger" data-testid="deactivate-error">
            <p>{failure}</p>
            <p>{leftUnchanged(deactivate.error) ? t('marketplace.change.outcome.unchanged') : t('marketplace.change.outcome.unknown')}</p>
          </Alert>
        ) : null}
        {notDone ? (
          <Alert variant="warning" data-testid="deactivate-not-done">
            {t('marketplace.deactivate.notDone', { status: t(`marketplace.status.${notDone}`) })}
          </Alert>
        ) : null}
      </div>
    </ConfirmationDialog>
  );
}
