import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface PropertyGalleryProps {
  photoUrls: string[];
  alt: string;
}

export function PropertyGallery({ photoUrls, alt }: PropertyGalleryProps) {
  const { t } = useTranslation();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const photos = photoUrls.length > 0 ? photoUrls : [];

  if (photos.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-[var(--cz-public-radius)] bg-[var(--cz-public-surface)] text-5xl">
        🏠
      </div>
    );
  }

  return (
    <>
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible md:snap-none"
        aria-label={t('publicSite.galleryLabel', { name: alt })}
        role="region"
      >
        {photos.map((url, index) => (
          <button
            key={`${url}-${index}`}
            type="button"
            className="public-site-card min-w-[85%] shrink-0 snap-center overflow-hidden md:min-w-0"
            onClick={() => setLightboxIndex(index)}
            aria-label={t('publicSite.openPhoto', { index: index + 1, total: photos.length })}
          >
            <img
              src={url}
              alt={t('publicSite.photoAlt', { name: alt, index: index + 1 })}
              className="aspect-[4/3] w-full object-cover"
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          </button>
        ))}
      </div>

      <Dialog open={lightboxIndex !== null} onOpenChange={(open) => !open && setLightboxIndex(null)}>
        <DialogContent className="max-w-4xl border-0 bg-black p-2">
          {lightboxIndex !== null ? (
            <img src={photos[lightboxIndex]} alt={alt} className="max-h-[80vh] w-full object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
