import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Download, Printer, QrCode } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { openQrPrintSheet, useQrDataUrl } from '@/lib/qr-print-sheet';

/** Opens a clean page with the QR code and the instructions, and prints it; says so when the browser blocked the window. */
function printSheet(title: string, instructions: string, image: string, popupBlocked: string) {
  if (!openQrPrintSheet({ title, lines: [instructions], image })) toast.error(popupBlocked);
}

/**
 * Printable QR code for property entrance (NF-13, E06/F03/US01/T02).
 * Directs guests to stay verification entry (booking code + email, AC-NF13-7).
 * Static QR per property, always available as verification fallback (AC-NF13-8).
 */
export function PropertyQrCodePage() {
  const { t } = useTranslation();
  const { propertyId } = useParams<{ propertyId: string }>();
  const origin = window.location.origin;

  // The QR directs to the guest verification entry page where they enter booking code + email
  const verificationUrl = propertyId ? `${origin}/guest/verify?property=${propertyId}` : '';
  const image = useQrDataUrl(verificationUrl);

  if (!propertyId) {
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

  if (!image) {
    return <LoadingScreen message={t('property.qr.loading')} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="max-w-2xl w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <QrCode className="size-8 text-primary" aria-hidden="true" />
          </div>
          <CardTitle>{t('property.qr.title')}</CardTitle>
          <CardDescription>{t('property.qr.instructions')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center rounded-md border bg-white p-6">
            <img
              src={image}
              alt={t('property.qr.title')}
              className="h-96 w-96"
              data-testid="property-qr-code"
            />
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Button
              type="button"
              onClick={() =>
                printSheet(
                  t('property.qr.title'),
                  t('property.qr.instructions'),
                  image,
                  t('property.qr.popupBlocked')
                )
              }
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

          <p className="text-sm text-muted-foreground">
            {t('property.qr.hint')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
