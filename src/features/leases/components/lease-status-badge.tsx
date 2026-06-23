import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { LEASE_STATUS_VARIANTS } from '../schemas/lease.schema';
import { getLeaseStatusLabel } from '@/lib/i18n-labels';
import type { LeaseStatus } from '@/types';

interface LeaseStatusBadgeProps {
  status: LeaseStatus;
  className?: string;
}

export function LeaseStatusBadge({ status, className }: LeaseStatusBadgeProps) {
  const { t } = useTranslation();
  const label = getLeaseStatusLabel(status, t);
  const variant = LEASE_STATUS_VARIANTS[status] ?? 'secondary';

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
