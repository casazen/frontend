import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Copy, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlignedCard, CardDescription, CardTitle } from '@/components/ui/card';

const QR_SIZE_PX = 640;

function useQrDataUrl(url: string): { image: string | null; failed: boolean } {
  const [dataUrl, setDataUrl] = useState<{ url: string; image: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: QR_SIZE_PX }).then((image) => {
      if (!cancelled) setDataUrl({ url, image });
    }).catch(() => {
      if (!cancelled) setDataUrl({ url, image: null });
    });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return { image: dataUrl?.url === url ? dataUrl.image : null, failed: dataUrl?.url === url && dataUrl.image === null };
}

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

export function InviteQrCard({
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
  const { image, failed } = useQrDataUrl(url);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('admin.inviteQr.copied'));
    } catch {
      toast.error(t('admin.inviteQr.copyError'));
    }
  };

  return (
    <AlignedCard rows={4} data-testid={testId}>
      <div className="mb-6 space-y-1.5">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
      <div className="mb-4 flex items-center justify-center rounded-xl border bg-white p-4">
        {image ? (
          <img src={image} alt={t('admin.inviteQr.qrAlt', { title })} className="aspect-square h-auto w-56 max-w-full" data-testid={`${testId}-image`} />
        ) : failed ? (
          <p role="alert" className="p-4 text-sm text-destructive">{t('admin.staffInvite.qrError')}</p>
        ) : (
          <div className="h-56 w-56 animate-pulse rounded bg-muted" aria-hidden />
        )}
      </div>
      <p className="mb-4 break-all rounded-lg bg-surface-2 p-3 font-mono text-xs text-foreground" data-testid={`${testId}-url`}>
        {url}
      </p>
      <div className="flex flex-wrap content-start gap-2">
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
    </AlignedCard>
  );
}

