import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ShowcaseMediaKind } from '@/types/supplier-showcase';
import type { PoolPhoto } from '../showcase-photos';
import { MediaUpload } from './media-upload';

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
  /** What the server stores an upload as: the cover, the photo of a job, or its "before" photo. */
  kind: Extract<ShowcaseMediaKind, 'cover' | 'work' | 'before'>;
  photos: PoolPhoto[];
  loading: boolean;
  /** The photo chosen now, if any. */
  selected: string | null | undefined;
  onSelect: (url: string) => void;
}

/**
 * Where the photo of the cover or of a job comes from (SP-13b): **a new one**, uploaded here (checked and made smaller by the editor, stored by the
 * server without its metadata), or one of the photos the supplier already has on its profile and its services, as tiles. Either choice closes the
 * sheet and puts the photo into the content.
 */
export function PhotoPicker({ open, onOpenChange, title, kind, photos, loading, selected, onSelect }: PhotoPickerProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-h-[90dvh] sm:overflow-y-auto" data-testid="supplier-showcase-photo-picker">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('supplier.showcase.editor.photos.pickerHint')}</DialogDescription>
        </DialogHeader>

        <MediaUpload
          kind={kind}
          title={t('supplier.showcase.media.photo.title')}
          buttonLabel={t('supplier.showcase.media.photo.button')}
          onStored={(media) => {
            onSelect(media.url);
            onOpenChange(false);
          }}
        />

        {loading ? (
          <p className="text-sm text-foreground/70" role="status">
            {t('supplier.showcase.editor.photos.loading')}
          </p>
        ) : photos.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">{t('supplier.showcase.media.photo.orPick')}</h3>
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
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
