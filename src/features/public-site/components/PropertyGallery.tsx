import { useMemo, useRef, useState } from 'react';
import type { UIEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Grid2x2, ImageOff } from 'lucide-react';
import { PhotoViewer } from '@/features/public-site/components/PhotoViewer';
import { displayableMediaUrls } from '@/lib/media-url';
import { cn } from '@/lib/utils';

interface PropertyGalleryProps {
  photoUrls: string[];
  /** Name of the property: the text alternative of every photo. */
  alt: string;
}

/**
 * Where each photo sits from `md` up: a big one on the left half and up to four on the right half (two rows of two, or fewer
 * photos taking more room each). The photos after the fifth are only in the viewer. Under `md` every photo is a slide.
 */
function tilePlacement(index: number, count: number): string {
  if (index === 0) return count === 1 ? 'md:col-span-4 md:row-span-2' : 'md:col-span-2 md:row-span-2';
  if (index > 4) return 'md:hidden';
  const small = Math.min(count, 5) - 1;
  if (small === 1) return 'md:col-span-2 md:row-span-2';
  if (small === 2) return 'md:col-span-2';
  if (small === 3 && index === 3) return 'md:col-span-2';
  return '';
}

/**
 * The photos of a property: a carousel across the width of the phone (a swipe, with the counter), a mosaic from 768 px (one
 * big photo and four small ones). Every photo opens the viewer. A photo that does not load is left out; without any, a
 * plain block says so.
 */
export function PropertyGallery({ photoUrls, alt }: PropertyGalleryProps) {
  const { t } = useTranslation();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [slide, setSlide] = useState(0);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const opener = useRef<HTMLElement | null>(null);
  const photos = useMemo(() => [...new Set(displayableMediaUrls(photoUrls))].filter((url) => !broken.has(url)), [photoUrls, broken]);

  if (photos.length === 0) {
    return (
      <div
        className="flex h-52 flex-col items-center justify-center gap-2 rounded-[var(--cz-public-radius)] border bg-[var(--cz-public-surface)] px-6 text-center md:h-60"
        data-testid="property-gallery-empty"
      >
        <ImageOff className="h-8 w-8 text-[var(--cz-public-muted)]" aria-hidden />
        <p className="text-sm text-[var(--cz-public-muted)]">{t('publicProperty.gallery.empty')}</p>
      </div>
    );
  }

  const open = (index: number, from: HTMLElement) => {
    opener.current = from;
    setViewerIndex(index);
  };
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const track = event.currentTarget;
    if (track.clientWidth > 0) setSlide(Math.round(track.scrollLeft / track.clientWidth));
  };
  const current = Math.min(slide, photos.length - 1);

  return (
    <section aria-label={t('publicSite.galleryLabel', { name: alt })} className="relative -mx-3 md:mx-0" data-testid="property-gallery">
      <div
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] md:grid md:h-[24rem] md:snap-none md:grid-cols-4 md:grid-rows-2 md:gap-2 md:overflow-hidden md:rounded-[var(--cz-public-radius)] lg:h-[28rem] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((url, index) => (
          <button
            key={url}
            type="button"
            aria-label={t('publicSite.openPhoto', { index: index + 1, total: photos.length })}
            onClick={(event) => open(index, event.currentTarget)}
            className={cn(
              'relative block aspect-[4/3] w-full shrink-0 snap-start overflow-hidden bg-[var(--cz-public-border)] focus-visible:z-10 focus-visible:outline-offset-[-3px]! md:aspect-auto md:h-full',
              tilePlacement(index, photos.length),
            )}
          >
            <img
              src={url}
              alt={t('publicSite.photoAlt', { name: alt, index: index + 1 })}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02] motion-reduce:transition-none"
              loading={index === 0 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : undefined}
              decoding="async"
              onError={() => setBroken((previous) => new Set(previous).add(url))}
            />
          </button>
        ))}
      </div>

      {photos.length > 1 ? (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1 text-xs font-medium tabular-nums text-white md:hidden"
          >
            {current + 1} / {photos.length}
          </span>
          <button
            type="button"
            onClick={(event) => open(0, event.currentTarget)}
            className="absolute bottom-3 right-3 hidden items-center gap-2 rounded-[var(--cz-public-radius)] bg-[var(--cz-public-surface)] px-4 py-2 text-sm font-medium text-[var(--cz-public-text)] shadow-[var(--cz-public-shadow-card)] hover:bg-[var(--cz-public-bg)] md:inline-flex pointer-coarse:min-h-11"
          >
            <Grid2x2 className="h-4 w-4" aria-hidden />
            {t('publicProperty.gallery.showAll', { total: photos.length })}
          </button>
        </>
      ) : null}

      {viewerIndex !== null ? (
        <PhotoViewer
          photos={photos}
          index={Math.min(viewerIndex, photos.length - 1)}
          name={alt}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          restoreFocusTo={() => (opener.current?.isConnected ? opener.current : null)}
        />
      ) : null}
    </section>
  );
}
