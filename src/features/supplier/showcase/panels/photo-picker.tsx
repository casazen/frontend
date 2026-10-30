import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PROFILE_PATH, SERVICES_PATH } from '../showcase-model';
import type { PoolPhoto } from '../showcase-photos';

/** How a photo is named for a person who does not see it: "Foto 2 del profilo", "Pulizie: foto 1". */
function photoName(photo: PoolPhoto, t: (key: string, options?: Record<string, unknown>) => string): string {
  return photo.from.kind === 'profile'
    ? t('supplier.showcase.editor.photos.profilePhoto', { n: photo.number })
    : t('supplier.showcase.editor.photos.servicePhoto', { service: photo.from.name, n: photo.number });
}

interface PhotoPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the photo is for ("Copertina", "Foto del lavoro 2"). */
  title: string;
  photos: PoolPhoto[];
  loading: boolean;
  /** The photo chosen now, if any. */
  selected: string | null | undefined;
  onSelect: (url: string) => void;
}

/**
 * The photos the supplier already has (profile and services) as tiles to choose one from. The choice closes the sheet; with no photo
 * it says where they are added. (A new photo is uploaded from the profile or from a service: the upload from here is SP-13b.)
 */
export function PhotoPicker({ open, onOpenChange, title, photos, loading, selected, onSelect }: PhotoPickerProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="supplier-showcase-photo-picker">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('supplier.showcase.editor.photos.pickerHint')}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-foreground/70" role="status">
            {t('supplier.showcase.editor.photos.loading')}
          </p>
        ) : photos.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm">{t('supplier.showcase.editor.photos.none')}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to={PROFILE_PATH}>{t('supplier.showcase.editor.photos.addToProfile')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={SERVICES_PATH}>{t('supplier.showcase.editor.photos.addToService')}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label={title}>
            {photos.map((photo) => {
              const name = photoName(photo, t);
              const chosen = photo.url === selected;
              return (
                <li key={photo.url}>
                  <button
                    type="button"
                    aria-pressed={chosen}
                    aria-label={name}
                    onClick={() => {
                      onSelect(photo.url);
                      onOpenChange(false);
                    }}
                    className={cn(
                      'relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted ring-1 ring-border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      chosen && 'ring-2 ring-primary',
                    )}
                  >
                    <img src={photo.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    {chosen ? (
                      <span className="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
                        <Check className="size-4" />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
