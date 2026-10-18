import { ImageOff } from 'lucide-react';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import type { SupplierService } from '@/types/supplier-services';

interface ServiceThumbProps {
  service: Pick<SupplierService, 'photoUrls'>;
  /** The size and the shape, as classes (default: a 48 px square). */
  className?: string;
}

/** The cover photo of a service, or a picture with a line through it when it has none. It is decoration: the name is always next to it. */
export function ServiceThumb({ service, className }: ServiceThumbProps) {
  const cover = service.photoUrls.find(isDisplayableMediaUrl);
  return (
    <div aria-hidden="true" className={cn('size-12 shrink-0 overflow-hidden rounded-md bg-muted', className)}>
      {cover ? (
        <img src={cover} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center text-foreground/60">
          <ImageOff className="size-5" />
        </div>
      )}
    </div>
  );
}
