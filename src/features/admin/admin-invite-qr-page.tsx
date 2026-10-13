import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Copy, Download, Printer } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hostInviteUrl, sanitizeCampaign, supplierInviteUrl } from '@/lib/invite-links';

const QR_SIZE_PX = 640;

/** PNG (data URL) of the QR of `url`; error correction M: it still scans when printed small or a bit worn. */
function useQrDataUrl(url: string): string | null {
  const [dataUrl, setDataUrl] = useState<{ url: string; image: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: QR_SIZE_PX }).then((image) => {
      if (!cancelled) setDataUrl({ url, image });
    });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return dataUrl?.url === url ? dataUrl.image : null;
}

/** Opens a clean page with the code and the invitation, and prints it: the console around it never reaches the paper. */
function printSheet(title: string, subtitle: string, image: string, url: string, popupBlocked: string) {
  const sheet = window.open('', '_blank', 'width=720,height=900');
  if (!sheet) {
    toast.error(popupBlocked);
    return;
  }
  const doc = sheet.document;
  doc.title = title;
  doc.body.style.cssText = 'font-family: system-ui, sans-serif; text-align: center; margin: 48px;';
  const heading = doc.createElement('h1');
  heading.textContent = title;
  const sub = doc.createElement('p');
  sub.textContent = subtitle;
  sub.style.cssText = 'font-size: 20px; color: #444;';
  const img = doc.createElement('img');
  img.src = image;
  img.alt = title;
  img.style.cssText = 'width: 420px; height: 420px; margin: 24px auto; display: block;';
  const link = doc.createElement('p');
  link.textContent = url;
  link.style.cssText = 'font-size: 14px; color: #666; word-break: break-all;';
  doc.body.append(heading, sub, img, link);
  img.onload = () => sheet.print();
}

function InviteQrCard({
  testId,
  title,
  description,
  url,
  printSubtitle,
}: {
  testId: string;
  title: string;
  description: string;
  url: string;
  printSubtitle: string;
}) {
  const { t } = useTranslation();
  const image = useQrDataUrl(url);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('admin.inviteQr.copied'));
    } catch {
      toast.error(t('admin.inviteQr.copyError'));
    }
  };

  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center rounded-md border bg-white p-3">
          {image ? (
            <img src={image} alt={t('admin.inviteQr.qrAlt', { title })} className="h-56 w-56" data-testid={`${testId}-image`} />
          ) : (
            <div className="h-56 w-56 animate-pulse rounded bg-muted" aria-hidden />
          )}
        </div>
        <p className="break-all text-xs text-muted-foreground" data-testid={`${testId}-url`}>
          {url}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!image}
            onClick={() => image && printSheet(title, printSubtitle, image, url, t('admin.inviteQr.popupBlocked'))}
            data-testid={`${testId}-print`}
          >
            <Printer className="mr-2 h-4 w-4" aria-hidden />
            {t('admin.inviteQr.print')}
          </Button>
          <Button type="button" variant="outline" disabled={!image} asChild={!!image}>
            {image ? (
              <a href={image} download={`${testId}.png`} data-testid={`${testId}-download`}>
                <Download className="mr-2 h-4 w-4" aria-hidden />
                {t('admin.inviteQr.download')}
              </a>
            ) : (
              <span>{t('admin.inviteQr.download')}</span>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => void copy()} data-testid={`${testId}-copy`}>
            <Copy className="mr-2 h-4 w-4" aria-hidden />
            {t('admin.inviteQr.copy')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Printable QR codes of the two ways in: the supplier (registration in any comune) and the host (signup with the choice of
 * short or long rent). The codes hold public entry addresses only: no token, no personal data. A personal supplier invite
 * keeps travelling by email, bound to the invited address.
 */
export function AdminInviteQrPage() {
  const { t } = useTranslation();
  const [campaign, setCampaign] = useState('');
  const origin = window.location.origin;

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.inviteQr.title')} description={t('admin.inviteQr.description')} />

      <div className="max-w-md space-y-2">
        <Label htmlFor="qr-campaign">{t('admin.inviteQr.campaign')}</Label>
        <Input
          id="qr-campaign"
          value={campaign}
          maxLength={60}
          onChange={(event) => setCampaign(event.target.value)}
          placeholder={t('admin.inviteQr.campaignPlaceholder')}
          data-testid="qr-campaign-input"
        />
        <p className="text-xs text-muted-foreground">
          {t('admin.inviteQr.campaignHint', { value: sanitizeCampaign(campaign) || '—' })}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <InviteQrCard
          testId="qr-supplier"
          title={t('admin.inviteQr.supplier.title')}
          description={t('admin.inviteQr.supplier.description')}
          url={supplierInviteUrl(origin)}
          printSubtitle={t('admin.inviteQr.supplier.printSubtitle')}
        />
        <InviteQrCard
          testId="qr-host"
          title={t('admin.inviteQr.host.title')}
          description={t('admin.inviteQr.host.description')}
          url={hostInviteUrl(origin, campaign)}
          printSubtitle={t('admin.inviteQr.host.printSubtitle')}
        />
      </div>
    </div>
  );
}
