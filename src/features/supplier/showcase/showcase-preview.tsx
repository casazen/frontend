import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { buildPreviewMessage, PREVIEW_READY_TYPE } from '@/lib/supplier-site/preview-channel';
import type { ShowcaseDocument } from '@/types/supplier-showcase';

/** The width of the screen the page is drawn for: the frame has this width, so the page lays out as it does on that device. */
const DEVICE_WIDTH = { desktop: 1280, tablet: 820, phone: 390 } as const;
type Device = keyof typeof DEVICE_WIDTH;

/** The height of the screen drawn, in pixels of the device. */
const SCREEN_HEIGHT = 760;

const PAGE_PATH = { home: '', services: '/servizi', about: '/chi-siamo' } as const;
type PreviewPage = keyof typeof PAGE_PATH;

/** The width of an element, followed as it changes. 0 until it is measured. */
function useElementWidth(element: HTMLElement | null): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return width;
}

interface ShowcasePreviewProps {
  /** `/fornitori/{slug}`. */
  publicPath: string;
  /** The draft: what the page draws instead of what is published. */
  doc: ShowcaseDocument;
  /** The pages of the services exist only while the list of services is public. */
  hasServices: boolean;
}

/**
 * The live preview of the editor (SP-13c/d): the real public page in a frame of the same origin (`?anteprima=1&frame=1`), at the true width
 * of the device chosen (the frame is made that wide and shrunk to fit, so the page lays out as it will on a phone, a tablet or a
 * computer), on the page chosen. The draft goes to the page with `postMessage` as it is written: first the page says it is ready, then
 * every change is sent (`lib/supplier-site/preview-channel.ts`); nothing is written or sent by the page in this mode.
 */
export function ShowcasePreview({ publicPath, doc, hasServices }: ShowcasePreviewProps) {
  const { t } = useTranslation();
  const [device, setDevice] = useState<Device>('desktop');
  const [page, setPage] = useState<PreviewPage>('home');
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const available = useElementWidth(box);

  const shown: PreviewPage = page === 'services' && !hasServices ? 'home' : page;
  const src = `${publicPath}${PAGE_PATH[shown]}?anteprima=1&frame=1`;
  const deviceWidth = DEVICE_WIDTH[device];
  const scale = available > 0 ? Math.min(1, available / deviceWidth) : 1;

  // The page says it is ready: from then on it gets the draft. (A page that is loaded again says it again.)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const data = event.data as { type?: unknown } | null;
      if (data?.type === PREVIEW_READY_TYPE) setReadyFor(src);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [src]);

  // The draft goes to the page as it changes.
  useEffect(() => {
    if (readyFor !== src) return;
    frame.current?.contentWindow?.postMessage(buildPreviewMessage(doc), window.location.origin);
  }, [doc, readyFor, src]);

  const devices: SegmentedOption<Device>[] = [
    { value: 'desktop', label: t('supplier.showcase.preview.desktop'), icon: Monitor },
    { value: 'tablet', label: t('supplier.showcase.preview.tablet'), icon: Tablet },
    { value: 'phone', label: t('supplier.showcase.preview.phone'), icon: Smartphone },
  ];
  const pages: SegmentedOption<PreviewPage>[] = [
    { value: 'home', label: t('supplier.showcase.preview.home') },
    ...(hasServices ? [{ value: 'services' as const, label: t('supplier.showcase.preview.services') }] : []),
    { value: 'about', label: t('supplier.showcase.preview.about') },
  ];

  return (
    <div className="space-y-3" data-testid="supplier-showcase-preview">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label={t('supplier.showcase.preview.deviceLabel')} options={devices} value={device} onValueChange={setDevice} />
        <Segmented label={t('supplier.showcase.preview.pageLabel')} options={pages} value={shown} onValueChange={setPage} />
      </div>
      <div ref={setBox} className="overflow-hidden rounded-xl border bg-muted/40">
        <div className="mx-auto" style={{ width: deviceWidth * scale, height: SCREEN_HEIGHT * scale }}>
          <iframe
            ref={frame}
            key={src}
            src={src}
            title={t('supplier.showcase.preview.frameTitle')}
            className="block border-0 bg-white"
            style={{ width: deviceWidth, height: SCREEN_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          />
        </div>
      </div>
      <p className="text-sm text-foreground/70">{t('supplier.showcase.preview.note')}</p>
    </div>
  );
}
