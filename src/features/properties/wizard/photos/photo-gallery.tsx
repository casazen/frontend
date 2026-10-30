import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, GripVertical, ImageOff, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';

interface PhotoGalleryProps {
  propertyName: string;
  /** The photos the person sees, in display order (the first is the cover). */
  photos: readonly string[];
  /** A change is on its way: the controls wait for it. */
  busy: boolean;
  /** Moves the photo at `from` to the place `to` (both zero-based). */
  onMove: (from: number, to: number) => void;
  onSetCover: (url: string) => void;
  onDelete: (url: string) => void;
}

/**
 * The photos of the property in the wizard (SR-07b). The order is changed three ways, the same result: dragging a photo onto another
 * (mouse), «Sposta» before/after (keyboard, phone and screen reader: the page announces where the photo went) and, for the cover,
 * «Imposta come copertina». Deleting leaves the decision to the caller, who offers «Annulla».
 */
export function PhotoGallery({ propertyName, photos, busy, onMove, onSetCover, onDelete }: PhotoGalleryProps) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const endDrag = () => {
    setDragging(null);
    setOver(null);
  };

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy={busy} data-testid="property-wizard-photos">
      {photos.map((url, index) => {
        const position = index + 1;
        const displayable = isDisplayableMediaUrl(url);

        return (
          <li
            key={url}
            draggable={!busy}
            data-testid="property-wizard-photo"
            className={cn('min-w-0 space-y-2 rounded-md', dragging === index && 'opacity-50', over === index && dragging !== index && 'ring-2 ring-primary')}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              // Firefox does not start a drag that carries nothing.
              event.dataTransfer.setData('text/plain', String(index));
              setDragging(index);
            }}
            onDragOver={(event) => {
              if (dragging === null) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setOver(index);
            }}
            onDrop={(event) => {
              if (dragging === null) return;
              event.preventDefault();
              if (dragging !== index) onMove(dragging, index);
              endDrag();
            }}
            onDragEnd={endDrag}
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
              {displayable ? (
                <PhotoImage url={url} alt={t('property.photos.alt', { name: propertyName, index: position })} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-foreground/70">
                  <ImageOff aria-hidden="true" className="size-8" />
                  <p className="text-xs">{t('property.photos.legacy')}</p>
                </div>
              )}
              {index === 0 && displayable ? (
                <Badge className="absolute left-2 top-2" data-testid="property-wizard-photo-cover">
                  <Star aria-hidden="true" className="mr-1 size-3" />
                  {t('property.photos.cover')}
                </Badge>
              ) : null}
              <GripVertical aria-hidden="true" className="absolute right-1 top-1 size-5 rounded bg-background/80 text-foreground/70 max-sm:hidden" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onMove(index, index - 1)}
                  disabled={busy || index === 0}
                  aria-label={t('property.photos.moveEarlier', { index: position })}
                >
                  <ArrowLeft aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onMove(index, index + 1)}
                  disabled={busy || index === photos.length - 1}
                  aria-label={t('property.photos.moveLater', { index: position })}
                >
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  onClick={() => onDelete(url)}
                  disabled={busy}
                  aria-label={t('property.photos.delete', { index: position })}
                >
                  <Trash2 aria-hidden="true" className="size-4 text-destructive" />
                </Button>
              </div>
              {displayable && index > 0 ? (
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onSetCover(url)} disabled={busy}>
                  {t('property.photos.setCover')}
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The photo; if the file cannot be read (deleted from the storage, broken link) a plain notice takes its place. */
function PhotoImage({ url, alt }: { url: string; alt: string }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-foreground/70">
        <ImageOff aria-hidden="true" className="size-8" />
        <p className="text-xs">{t('property.photos.unavailable')}</p>
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" draggable={false} className="h-full w-full object-cover" onError={() => setFailed(true)} />;
}
