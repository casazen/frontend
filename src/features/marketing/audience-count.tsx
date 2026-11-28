import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { usePreviewCondition, usePreviewCount } from '@/queries/campaigns';
import type { ConditionDefinition } from '@/types/campaign.types';

function CountText({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 text-foreground/80">
      <Users aria-hidden="true" className="size-4 shrink-0" />
      {t('marketingHub.count.guests', { count })}
    </span>
  );
}

export function ConditionCount({ condition, propertyId }: { condition: ConditionDefinition; propertyId?: string }) {
  const preview = usePreviewCondition(condition, propertyId);
  if (preview.isPending) return <Skeleton className="h-4 w-16" />;
  if (!preview.data) return null;
  return <CountText count={preview.data.count} />;
}

export function SegmentCount({ segmentId, propertyId }: { segmentId: string; propertyId?: string }) {
  const preview = usePreviewCount(segmentId, propertyId);
  if (preview.isPending) return <Skeleton className="h-4 w-16" />;
  if (!preview.data) return null;
  return <CountText count={preview.data.count} />;
}
