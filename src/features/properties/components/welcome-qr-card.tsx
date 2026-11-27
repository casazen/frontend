import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Loader2, Printer, QrCode, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { PlainSection } from '@/components/shared/calm';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getProblemMessage } from '@/lib/api-errors';
import { openQrPrintSheet, useQrDataUrl } from '@/lib/qr-print-sheet';
import { useCreateWelcomeLink, useRotateWelcomeLink, useWelcomeLink } from '@/queries/welcome';

const COPIED_FEEDBACK_MS = 2_000;

interface WelcomeQrCardProps {
  propertyId: string;
  propertyName: string;
}

/**
 * «QR di benvenuto» of a property (E07/F04/US02/T02, NF-90, CRM-03): the QR code the host prints and puts in the house, which opens the welcome
 * page (`/benvenuto/{token}`) where a guest leaves a contact and chooses what to receive. It shows the QR and the link with a copy button,
 * «Stampa il cartello» (a clean sheet with the code and a line in Italian and in English, as the QR of the stay verification does) and «Crea un
 * nuovo QR», which asks first: the printed code stops working at once. A property with no link offers to make one. The property detail
 * mounts it only with the flag `crmMarketing` on and the permission `property.write`, which is what the API behind it asks.
 */
export function WelcomeQrCard({ propertyId, propertyName }: WelcomeQrCardProps) {
  const { t, i18n } = useTranslation();
  const link = useWelcomeLink(propertyId);
  const create = useCreateWelcomeLink(propertyId);
  const rotate = useRotateWelcomeLink(propertyId);
  const [copied, setCopied] = useState(false);
  const [confirmRenew, setConfirmRenew] = useState(false);

  const active = link.data?.active === true;
  const url = active ? (link.data?.url ?? '') : '';
  const image = useQrDataUrl(url);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard (insecure context, permission denied): the host copies the address by hand.
      toast.error(t('property.detail.welcomeQr.copyFailed'));
    }
  };

  // The sign is for the guests, in both languages whatever the language of the host's screen.
  const print = () => {
    if (!image) return;
    const italian = i18n.getFixedT('it');
    const english = i18n.getFixedT('en');
    const opened = openQrPrintSheet({
      title: `${italian('property.detail.welcomeQr.signTitle')} · ${english('property.detail.welcomeQr.signTitle')}`,
      lines: [italian('property.detail.welcomeQr.signLine'), english('property.detail.welcomeQr.signLine')],
      image,
    });
    if (!opened) toast.error(t('property.detail.welcomeQr.popupBlocked'));
  };

  const openRenew = () => {
    rotate.reset();
    setConfirmRenew(true);
  };

  // The dialog closes only when the new code exists; on a failure it stays open (the dialog catches it) with the reason in it.
  const renew = async () => {
    await rotate.mutateAsync();
    setCopied(false);
    toast.success(t('property.detail.welcomeQr.renewDone'));
  };

  let body: ReactNode;
  if (link.isPending) {
    body = (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-testid="welcome-qr-loading">
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {t('property.detail.welcomeQr.loading')}
      </p>
    );
  } else if (link.isError) {
    body = (
      <Alert
        variant="danger"
        data-testid="welcome-qr-error"
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => void link.refetch()}>
            {t('property.detail.welcomeQr.retry')}
          </Button>
        }
      >
        {getProblemMessage(link.error, t) ?? t('property.detail.welcomeQr.loadError')}
      </Alert>
    );
  } else if (!active) {
    body = (
      <div className="space-y-3" data-testid="welcome-qr-none">
        <p className="text-sm">{t('property.detail.welcomeQr.none')}</p>
        {create.isError ? (
          <p className="text-sm text-destructive" role="alert" data-testid="welcome-qr-create-error">
            {getProblemMessage(create.error, t) ?? t('property.detail.welcomeQr.createFailed')}
          </p>
        ) : null}
        <Button type="button" loading={create.isPending} onClick={() => create.mutate()} data-testid="welcome-qr-create">
          <QrCode aria-hidden="true" className="size-4" />
          {t('property.detail.welcomeQr.create')}
        </Button>
      </div>
    );
  } else if (url === '') {
    // A link exists but the public address of the web app is not set up here, so there is nothing to put in a code.
    body = (
      <Alert variant="warning" data-testid="welcome-qr-no-address">
        {t('property.detail.welcomeQr.noAddress')}
      </Alert>
    );
  } else {
    body = (
      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start" data-testid="welcome-qr-active">
        {image ? (
          <img
            src={image}
            alt={t('property.detail.welcomeQr.qrAlt', { name: propertyName })}
            className="size-40 rounded-md border bg-white p-2"
            data-testid="welcome-qr-image"
          />
        ) : (
          <div className="size-40 rounded-md border bg-muted motion-safe:animate-pulse" aria-hidden="true" />
        )}
        <div className="min-w-0 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="welcome-qr-link">{t('property.detail.welcomeQr.linkLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="welcome-qr-link"
                readOnly
                value={url}
                onFocus={(event) => event.currentTarget.select()}
                className="font-mono text-xs"
                data-testid="welcome-qr-link"
              />
              <Button type="button" variant="outline" onClick={() => void copy()} data-testid="welcome-qr-copy">
                {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                {copied ? t('property.detail.welcomeQr.copied') : t('property.detail.welcomeQr.copy')}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={print} disabled={!image} data-testid="welcome-qr-print">
              <Printer aria-hidden="true" className="size-4" />
              {t('property.detail.welcomeQr.print')}
            </Button>
            <Button type="button" variant="outline" onClick={openRenew} data-testid="welcome-qr-renew">
              <RotateCw aria-hidden="true" className="size-4" />
              {t('property.detail.welcomeQr.renew')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PlainSection title={t('property.detail.welcomeQr.title')} data-testid="welcome-qr-card">
      <p className="text-sm text-muted-foreground">{t('property.detail.welcomeQr.description')}</p>
      {body}
      <ConfirmationDialog
        open={confirmRenew}
        onOpenChange={setConfirmRenew}
        title={t('property.detail.welcomeQr.renewTitle')}
        description={t('property.detail.welcomeQr.renewDescription')}
        confirmLabel={t('property.detail.welcomeQr.renewConfirm')}
        variant="destructive"
        consequences={[t('property.detail.welcomeQr.renewConsequence')]}
        onConfirm={renew}
        isLoading={rotate.isPending}
      >
        {rotate.isError ? (
          <p className="text-sm text-destructive" role="alert" data-testid="welcome-qr-renew-error">
            {getProblemMessage(rotate.error, t) ?? t('property.detail.welcomeQr.renewFailed')}
          </p>
        ) : null}
      </ConfirmationDialog>
    </PlainSection>
  );
}
