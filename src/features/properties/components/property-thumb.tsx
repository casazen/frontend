import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { displayableMediaUrls } from '@/lib/media-url';
import { cn } from '@/lib/utils';

interface PropertyThumbProps {
  photoUrls: readonly string[] | undefined;
  className?: string;
}

export function PropertyThumb({ photoUrls, className }: PropertyThumbProps) {
  const [failedCover, setFailedCover] = useState<string>();
  const cover = displayableMediaUrls(photoUrls)[0];

  return (
    <div aria-hidden="true" className={cn('cz-media-frame h-12 w-16 shrink-0 rounded-lg bg-primary-soft', className)}>
      {cover && cover !== failedCover ? (
        <img src={cover} onError={() => setFailedCover(cover)} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center text-foreground/60">
          <Building2 className="size-5" />
        </div>
      )}
    </div>
  );
}
