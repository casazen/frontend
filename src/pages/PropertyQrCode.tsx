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

function printSheet(title: string, instructions: string, image: string, popupBlocked: string) {
  if (!openQrPrintSheet({ title, lines: [instructions], image })) toast.error(popupBlocked);
}

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
  extraAction?: ReactNode;
}

function QrSheet({ propertyId, image, title, instructions, hint, extraAction }: QrSheetProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto grid min-h-[65vh] w-full max-w-5xl items-center px-3 py-6 sm:px-6">
      <Card className="grid w-full overflow-hidden md:grid-cols-2">
        <CardHeader className="justify-center gap-3 bg-muted/40 p-6 sm:p-10">
          <div className="mb-2 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <QrCode className="size-8 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <CardDescription>{instructions}</CardDescription>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col items-center gap-5 p-4 sm:p-8">
          <div className="grid w-full max-w-96 place-items-center rounded-2xl border bg-white p-4">
            <img src={image} alt={title} className="aspect-square h-auto w-full object-contain" data-testid="property-qr-code" />
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
          </div>

          {extraAction && <div className="w-full border-t pt-4 text-center">{extraAction}</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function EntranceQr({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const origin = window.location.origin;

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
