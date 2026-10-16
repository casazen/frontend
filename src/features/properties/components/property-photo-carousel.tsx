import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ImageOff, MapPin } from 'lucide-react';
import { displayableMediaUrls } from '@/lib/media-url';
import { cn } from '@/lib/utils';

interface PropertyPhotoCarouselProps {
  photoUrls: string[];
  name: string;
}

export function PropertyPhotoCarousel({ photoUrls, name }: PropertyPhotoCarouselProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  // Absolute storage URLs only: a legacy relative path would load the SPA's index.html on Vercel.
  const photos = displayableMediaUrls(photoUrls);
  const hasPhotos = photos.length > 0;
  const current = hasPhotos ? photos[index % photos.length] : undefined;
  const position = hasPhotos ? (index % photos.length) + 1 : 0;

  const goPrev = () => setIndex((i) => (i % photos.length === 0 ? photos.length - 1 : (i % photos.length) - 1));
  const goNext = () => setIndex((i) => ((i % photos.length) + 1) % photos.length);

  return (
    // No box around it: the photo is the picture of the page. The shape follows the screen (taller on a phone, wide on a
    // computer, never more than 24 rem) and a property without photos gets a short strip, not a screen of nothing.
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-xl bg-muted',
        hasPhotos ? 'aspect-[4/3] max-h-96 sm:aspect-video' : 'aspect-[3/1] max-h-40',
      )}
    >
      {current ? (
        <>
          {failedUrls.includes(current) ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-foreground/70">
              <ImageOff className="h-16 w-16" />
              <p className="text-sm">{t('property.photos.unavailable')}</p>
            </div>
          ) : (
            <img
              src={current}
              alt={t('property.photos.alt', { name, index: position })}
              className="h-full w-full object-cover"
              onError={() => setFailedUrls((urls) => (urls.includes(current) ? urls : [...urls, current]))}
            />
          )}
          {photos.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-3 top-1/2 -translate-y-1/2"
                onClick={goPrev}
                aria-label={t('property.photos.prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={goNext}
                aria-label={t('property.photos.next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                {position} / {photos.length}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="flex h-full items-center justify-center">
          <MapPin aria-hidden="true" className="h-12 w-12 text-foreground/70" />
        </div>
      )}
    </div>
  );
}
