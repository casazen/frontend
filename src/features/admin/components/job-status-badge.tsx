import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

type JobLastStatus = 'Succeeded' | 'Failed' | 'Processing' | 'Enqueued' | 'Unknown';

interface JobStatusBadgeProps {
  status: JobLastStatus;
}

const STATUS_KEY: Record<JobLastStatus, string> = {
  Succeeded: 'succeeded',
  Failed: 'failed',
  Processing: 'processing',
  Enqueued: 'enqueued',
  Unknown: 'unknown',
};

const STATUS_VARIANT: Record<JobLastStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Succeeded: 'default',
  Failed: 'destructive',
  Processing: 'secondary',
  Enqueued: 'outline',
  Unknown: 'outline',
};

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const { t } = useTranslation();
  const key = STATUS_KEY[status] ?? 'unknown';
  const variant = STATUS_VARIANT[status] ?? 'outline';
  return <Badge variant={variant}>{t(`admin.badges.job.${key}`)}</Badge>;
}
