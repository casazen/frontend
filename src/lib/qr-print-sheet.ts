import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

const QR_SIZE_PX = 640;

/**
 * PNG (data URL) of the QR of `url`, or null until it is made (and for an empty address, which has no code); error correction M: it still
 * scans when printed small or a bit worn.
 */
export function useQrDataUrl(url: string): string | null {
  const [dataUrl, setDataUrl] = useState<{ url: string; image: string } | null>(null);
  useEffect(() => {
    if (url === '') return;
    let cancelled = false;
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: QR_SIZE_PX }).then(
      (image) => {
        if (!cancelled) setDataUrl({ url, image });
      },
      // An address that cannot be a code leaves the image missing: the caller shows what it has for that.
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [url]);
  return url !== '' && dataUrl?.url === url ? dataUrl.image : null;
}

interface QrPrintSheet {
  /** The heading of the sheet, also the title of the window and the text of the image for a screen reader. */
  title: string;
  /** What is written under the heading, one paragraph each (a sign in two languages has one line per language). */
  lines: readonly string[];
  /** The QR as a data URL (see {@link useQrDataUrl}). */
  image: string;
}

/**
 * Opens a clean page with the heading, the lines and the QR code, and prints it (the sheet a host sticks to the door, or in the house).
 * Returns false when the browser blocked the window, so the caller can say it.
 */
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
    // The last line keeps the room the sheet always left above the code; the lines before it sit close together.
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
