import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CategoryIcon } from './category-icon';

interface SiteMediaProps {
  url: string | null;
  alt: string;
  category?: string;
  priority?: boolean;
  className?: string;
  width?: number;
  height?: number;
}

export function SiteMedia({ url, alt, category, priority = false, className, width, height }: SiteMediaProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <div className={cn('vz-media', className)}>
      {url && url !== failedUrl ? (
        <img
          src={url}
          onError={() => setFailedUrl(url)}
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
