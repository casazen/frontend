import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Download, Printer, QrCode, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { isFeatureEnabled } from '@/config/feature-flags';
import { FEATURE_FLAGS_QUERY_KEY } from '@/contexts/feature-flags-context';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { openQrPrintSheet, useQrDataUrl } from '@/lib/qr-print-sheet';
import { useDoorQr, useRotateDoorQr } from '@/queries/use-checkin';

/** Opens a clean page with the QR code and the instructions, and prints it; says so when the browser blocked the window. */
function printSheet(title: string, instructions: string, image: string, popupBlocked: string) {
  if (!openQrPrintSheet({ title, lines: [instructions], image })) toast.error(popupBlocked);
}

/** The page when the property is not known: the address has no property in it. */
function MissingProperty() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>{t('property.qr.error')}</CardTitle>
          <CardDescription>{t('property.qr.errorDescription')}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

interface QrSheetProps {
  propertyId: string;
  image: string;
  title: string;
  instructions: string;
  hint: string;
  /** What else the host can do with the code, next to printing and downloading it (the door has «Rigenera»). */
  extraAction?: ReactNode;
}

/** The printable card: the code, «Stampa» and «Scarica PNG», and the hint on where it goes. */
function QrSheet({ propertyId, image, title, instructions, hint, extraAction }: QrSheetProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="max-w-2xl w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <QrCode className="size-8 text-primary" aria-hidden="true" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{instructions}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center rounded-md border bg-white p-6">
            <img src={image} alt={title} className="h-96 w-96" data-testid="property-qr-code" />
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Button
              type="button"
              onClick={() => printSheet(title, instructions, image, t('property.qr.popupBlocked'))}
              data-testid="property-qr-print"
            >
              <Printer className="mr-2 h-4 w-4" aria-hidden />
              {t('property.qr.print')}
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href={image} download={`property-${propertyId}-qr.png`} data-testid="property-qr-download">
                <Download className="mr-2 h-4 w-4" aria-hidden />
                {t('property.qr.download')}
              </a>
            </Button>
            {extraAction}
          </div>

          <p className="text-sm text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * The QR as it always was (flag off): it directs to `/guest/verify?property=`, the verification entry the page was built for. Nothing of it changes while the identity verification is
 * not switched on.
 */
function EntranceQr({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const origin = window.location.origin;

  // The QR directs to the guest verification entry page where they enter booking code + email
  const image = useQrDataUrl(`${origin}/guest/verify?property=${propertyId}`);

  if (!image) {
    return <LoadingScreen message={t('property.qr.loading')} />;
  }

  return (
    <QrSheet
      propertyId={propertyId}
      image={image}
      title={t('property.qr.title')}
      instructions={t('property.qr.instructions')}
      hint={t('property.qr.hint')}
    />
  );
}

/** A card with a sentence and, when there is one, the button that tries again: the page has nothing to print. */
function DoorQrMessage({ title, children, onRetry }: { title: string; children: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full" data-testid="property-door-qr-message">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{children}</CardDescription>
        </CardHeader>
        {onRetry && (
          <CardContent>
            <Button type="button" variant="outline" onClick={onRetry} data-testid="property-door-qr-retry">
              {t('property.qr.door.retry')}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/**
 * The QR at the door of the property (flag on, E22/F02/US01/T01): the address of the door page that the API makes for this property (`GET api/properties/{id}/door-qr`), with «Rigenera», which
 * replaces it so that the code printed before stops working at once. Only who may write the property reaches the address (the server asks `property.write`); the others are told so and are
 * shown no code. An error is an error: the page never prints a code it could not read.
 */
function DoorEntranceQr({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canWrite = hasPermission('short-rent', 'property.write');
  const door = useDoorQr(propertyId, canWrite);
  const rotate = useRotateDoorQr(propertyId);
  const [confirming, setConfirming] = useState(false);

  // The code of a read that failed is never drawn, even when an older answer is still in memory.
  const url = door.isError ? '' : (door.data?.url ?? '');
  const image = useQrDataUrl(url);

  if (!canWrite) {
    return <DoorQrMessage title={t('property.qr.door.needsWriteTitle')}>{t('property.qr.door.needsWrite')}</DoorQrMessage>;
  }

  if (door.isError) {
    const status = getHttpStatus(door.error);
    if (status === 403) return <DoorQrMessage title={t('property.qr.door.needsWriteTitle')}>{t('property.qr.door.needsWrite')}</DoorQrMessage>;
    if (status === 404) return <DoorQrMessage title={t('property.qr.error')}>{t('property.qr.door.notFound')}</DoorQrMessage>;
    return (
      <DoorQrMessage title={t('property.qr.error')} onRetry={() => void door.refetch()}>
        {t('property.qr.door.loadFailed')}
      </DoorQrMessage>
    );
  }

  if (door.isPending || !image) {
    return <LoadingScreen message={t('property.qr.loading')} />;
  }

  const regenerate = async () => {
    try {
      await rotate.mutateAsync();
      toast.success(t('property.qr.door.rotated'));
    } catch (error) {
      // Whether the code was replaced is not known after a failed call: the page reads it again, so it shows the code that is in force.
      void door.refetch();
      toast.error(getHttpStatus(error) === 403 ? t('property.qr.door.needsWrite') : t('property.qr.door.rotateFailed'));
      throw error;
    }
  };

  return (
    <>
      <QrSheet
        propertyId={propertyId}
        image={image}
        title={t('property.qr.door.title')}
        instructions={t('property.qr.door.instructions')}
        hint={t('property.qr.door.hint')}
        extraAction={
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirming(true)}
            disabled={rotate.isPending || door.isFetching}
            data-testid="property-door-qr-rotate"
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            {t('property.qr.door.rotate')}
          </Button>
        }
      />
      <ConfirmationDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('property.qr.door.rotateTitle')}
        description={t('property.qr.door.rotateDescription')}
        confirmLabel={t('property.qr.door.rotateConfirm')}
        variant="destructive"
        isLoading={rotate.isPending}
        onConfirm={regenerate}
      />
    </>
  );
}

/**
 * Printable QR code for property entrance (NF-13, E06/F03/US01/T02, E22/F02/US01/T01).
 * With the identity verification on it is the code of the door of the property (the guest who arrives types the booking code and the arrival date, `/checkin/porta/:doorToken`), which the host
 * can replace; without it, it is the static code it always was (AC-NF13-7, AC-NF13-8).
 *
 * Which of the two it is depends on the flag, so the page waits for it: while the flags are read, or when they could not be read, it shows no code at all. Every flag is off in both of those
 * states, and the static code leads to a page that does not exist: a host could print it before the flag was known.
 */
export function PropertyQrCodePage() {
  const { t } = useTranslation();
  const { propertyId } = useParams<{ propertyId: string }>();
  const { flags, isLoading, isError } = useFeatureFlags();
  const queryClient = useQueryClient();

  if (!propertyId) return <MissingProperty />;
  if (isLoading) return <LoadingScreen message={t('property.qr.loading')} />;
  if (isError) {
    return (
      <DoorQrMessage title={t('property.qr.error')} onRetry={() => void queryClient.refetchQueries({ queryKey: FEATURE_FLAGS_QUERY_KEY })}>
        {t('property.qr.flagsUnreadable')}
      </DoorQrMessage>
    );
  }
  return isFeatureEnabled(flags, 'checkInIdentityVerification') ? <DoorEntranceQr propertyId={propertyId} /> : <EntranceQr propertyId={propertyId} />;
}
