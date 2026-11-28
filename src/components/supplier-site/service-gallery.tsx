import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Images } from 'lucide-react';
import { PhotoViewer } from '@/features/public-site/components/PhotoViewer';
import { SiteMedia } from './site-media';

const MAX_PHOTOS = 6;
const MOSAIC_PHOTOS = 3;

const PHOTO_CLASS = 'vd-g';
const MAIN_PHOTO_CLASS = 'vd-g vd-g--main';

interface ServiceGalleryProps {
  photos: string[];
  name: string;
  category: string;
}

export function ServiceGallery({ photos, name, category }: ServiceGalleryProps) {
  const { t } = useTranslation();
  const [viewer, setViewer] = useState<number | null>(null);
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const shown = photos.slice(0, MAX_PHOTOS);

  if (shown.length === 0) return <SiteMedia url={null} alt="" category={category} className="vd-nophoto" />;

  const open = (index: number, element: HTMLElement) => {
    setOpener(element);
    setViewer(index);
  };

  const photoButton = (url: string, index: number, className: string) => (
    <button
      key={url}
      type="button"
      className={className}
      aria-label={t('supplierSite.service.photoOpen', { index: index + 1, total: shown.length, name })}
      onClick={(event) => open(index, event.currentTarget)}
    >
      <img src={url} alt="" loading={index === 0 ? 'eager' : 'lazy'} decoding="async" />
    </button>
  );

  const inMosaic = shown.slice(0, MOSAIC_PHOTOS);
  return (
    <div className="vd-gallery" data-testid="supplier-site-gallery">
      <div className="vd-mosaic" data-count={inMosaic.length}>
        {inMosaic.map((url, index) => photoButton(url, index, index === 0 ? MAIN_PHOTO_CLASS : PHOTO_CLASS))}
        {shown.length > MOSAIC_PHOTOS ? (
          <button type="button" className="vd-all" onClick={(event) => open(0, event.currentTarget)}>
            <Images aria-hidden="true" />
            <span>{t('supplierSite.service.allPhotos', { count: shown.length })}</span>
          </button>
        ) : null}
      </div>
      <div className="vd-strip">{shown.map((url, index) => photoButton(url, index, PHOTO_CLASS))}</div>
      {viewer !== null ? (
        <PhotoViewer
          photos={shown}
          index={viewer}
          name={name}
          onIndexChange={setViewer}
          onClose={() => setViewer(null)}
          restoreFocusTo={() => opener}
        />
      ) : null}
    </div>
  );
}
