import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import type { LegalReviewStatus } from '@/types/seo.types';

interface SeoReviewStatusBadgeProps {
  status: LegalReviewStatus;
}

const STATUS_KEY: Record<LegalReviewStatus, string> = {
  Reviewed: 'reviewed',
  Draft: 'draft',
};

const STATUS_VARIANT: Record<LegalReviewStatus, 'default' | 'secondary' | 'destructive'> = {
  Reviewed: 'default',
  Draft: 'secondary',
};

export function SeoReviewStatusBadge({ status }: SeoReviewStatusBadgeProps) {
  const { t } = useTranslation();
  const key = STATUS_KEY[status] ?? 'draft';
  const variant = STATUS_VARIANT[status] ?? 'secondary';
  return (
    <Badge variant={variant} data-testid={`seo-review-status-${status.toLowerCase()}`}>
      {t(`admin.badges.seo.${key}`)}
    </Badge>
  );
}
