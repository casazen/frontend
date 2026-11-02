import { cn } from '@/lib/utils';
import { CategoryIcon } from './category-icon';

interface SiteMediaProps {
  /** The photo of the supplier; without one the block is a plain fill of the style with the icon of the trade. */
  url: string | null;
  /** Empty for a decorative picture. */
  alt: string;
  category?: string;
  /** The picture above the fold: loaded at once and at high priority; every other one is lazy. */
  priority?: boolean;
  className?: string;
  width?: number;
  height?: number;
}

/** A picture of a supplier's site: the photo, or (VT-D19) a neutral fill with the icon of the trade until the supplier uploads one. */
export function SiteMedia({ url, alt, category, priority = false, className, width, height }: SiteMediaProps) {
  return (
    <div className={cn('vz-media', className)}>
      {url ? (
        <img
          src={url}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
        />
      ) : (
        <div className="vz-fill" aria-hidden="true">
          <CategoryIcon category={category} />
        </div>
      )}
    </div>
  );
}
