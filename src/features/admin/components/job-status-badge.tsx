import { Badge } from '@/components/ui/badge';

type JobLastStatus = 'Succeeded' | 'Failed' | 'Processing' | 'Enqueued' | 'Unknown';

interface JobStatusBadgeProps {
  status: JobLastStatus;
}

const STATUS_MAP: Record<
  JobLastStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  Succeeded: { label: 'Completato', variant: 'default' },
  Failed: { label: 'Fallito', variant: 'destructive' },
  Processing: { label: 'In corso', variant: 'secondary' },
  Enqueued: { label: 'In coda', variant: 'outline' },
  Unknown: { label: 'Sconosciuto', variant: 'outline' },
};

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const { label, variant } = STATUS_MAP[status] ?? STATUS_MAP.Unknown;
  return <Badge variant={variant}>{label}</Badge>;
}
