import { ImageOff } from 'lucide-react';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import type { SupplierService } from '@/types/supplier-services';

interface ServiceThumbProps {
  service: Pick<SupplierService, 'photoUrls'>;
  className?: string;
}

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
