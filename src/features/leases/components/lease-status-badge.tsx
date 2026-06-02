import { Badge } from '@/components/ui/badge';
import { LEASE_STATUS_LABELS } from '../schemas/lease.schema';
import type { LeaseStatus } from '@/types';

interface LeaseStatusBadgeProps {
  status: LeaseStatus;
  className?: string;
}

export function LeaseStatusBadge({ status, className }: LeaseStatusBadgeProps) {
  const config = LEASE_STATUS_LABELS[status] ?? {
    label: status,
    variant: 'secondary' as const,
  };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
