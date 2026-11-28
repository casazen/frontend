import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

const QR_SIZE_PX = 640;

export function useQrDataUrl(url: string): string | null {
  const [dataUrl, setDataUrl] = useState<{ url: string; image: string } | null>(null);
  useEffect(() => {
    if (url === '') return;
    let cancelled = false;
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: QR_SIZE_PX }).then(
      (image) => {
        if (!cancelled) setDataUrl({ url, image });
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [url]);
  return url !== '' && dataUrl?.url === url ? dataUrl.image : null;
}

interface QrPrintSheet {
  title: string;
  lines: readonly string[];
  image: string;
}

export function openQrPrintSheet({ title, lines, image }: QrPrintSheet): boolean {
  const sheet = window.open('', '_blank', 'width=720,height=900');
  if (!sheet) return false;

  const doc = sheet.document;
  doc.title = title;
  doc.body.style.cssText = 'font-family: system-ui, sans-serif; text-align: center; margin: 48px;';
  const heading = doc.createElement('h1');
  heading.textContent = title;
  heading.style.cssText = 'font-size: 32px; margin-bottom: 16px;';
  const paragraphs = lines.map((line, index) => {
    const paragraph = doc.createElement('p');
    paragraph.textContent = line;
    paragraph.style.cssText = `font-size: 18px; color: #444; margin-bottom: ${index === lines.length - 1 ? 32 : 12}px;`;
    return paragraph;
  });
  const img = doc.createElement('img');
  img.src = image;
  img.alt = title;
  img.style.cssText = 'width: 480px; height: 480px; margin: 0 auto; display: block;';
  doc.body.append(heading, ...paragraphs, img);
  img.onload = () => sheet.print();
  return true;
}
