import { Badge } from '@/components/ui/badge';
import type { LegalReviewStatus } from '@/types/seo.types';

interface SeoReviewStatusBadgeProps {
  status: LegalReviewStatus;
}

const STATUS_MAP: Record<
  LegalReviewStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  Reviewed: { label: 'Revisionato', variant: 'default' },
  Draft: { label: 'Bozza', variant: 'secondary' },
};

export function SeoReviewStatusBadge({ status }: SeoReviewStatusBadgeProps) {
  const mapped = STATUS_MAP[status] ?? STATUS_MAP.Draft;
  return (
    <Badge variant={mapped.variant} data-testid={`seo-review-status-${status.toLowerCase()}`}>
      {mapped.label}
    </Badge>
  );
}
