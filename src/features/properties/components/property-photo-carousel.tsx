import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

interface PropertyPhotoCarouselProps {
  photoUrls: string[];
  name: string;
}

export function PropertyPhotoCarousel({ photoUrls, name }: PropertyPhotoCarouselProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const hasPhotos = photoUrls.length > 0;

  const goPrev = () => setIndex((i) => (i === 0 ? photoUrls.length - 1 : i - 1));
  const goNext = () => setIndex((i) => (i === photoUrls.length - 1 ? 0 : i + 1));

  return (
    <Card>
      <CardContent className="p-0">
        <div className="relative h-96 bg-muted rounded-lg overflow-hidden">
          {hasPhotos ? (
            <>
              <img
                src={photoUrls[index]}
                alt={`${name} - foto ${index + 1}`}
                className="h-full w-full object-cover"
              />
              {photoUrls.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2"
                    onClick={goPrev}
                    aria-label={t('property.photos.prev')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                    onClick={goNext}
                    aria-label={t('property.photos.next')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                    {index + 1} / {photoUrls.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <MapPin className="h-24 w-24 text-muted-foreground" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
