import { Building2 } from 'lucide-react';
import { displayableMediaUrls } from '@/lib/media-url';
import { cn } from '@/lib/utils';

interface PropertyThumbProps {
  /** `photoUrls` of the property: the first one that can be shown is the cover. */
  photoUrls: readonly string[] | undefined;
  /** The size and the shape, as classes (default: a 48 px square). */
  className?: string;
}

/**
 * The cover photo of a property, or a building when it has none. It is decoration: the name of the property is always next to
 * it, so a screen reader skips it.
 */
export function PropertyThumb({ photoUrls, className }: PropertyThumbProps) {
  const cover = displayableMediaUrls(photoUrls)[0];

  return (
    <div aria-hidden="true" className={cn('size-12 shrink-0 overflow-hidden rounded-md bg-muted', className)}>
      {cover ? (
        <img src={cover} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center text-foreground/60">
          <Building2 className="size-5" />
        </div>
      )}
    </div>
  );
}
