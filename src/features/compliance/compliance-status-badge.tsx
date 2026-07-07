import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import type { PropertyComplianceStatus } from '@/types/compliance.types';

const VARIANT: Record<PropertyComplianceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Active: 'default',
  Pending: 'secondary',
  Suspended: 'destructive',
};

interface ComplianceStatusBadgeProps {
  status: PropertyComplianceStatus;
  className?: string;
}

export function ComplianceStatusBadge({ status, className }: ComplianceStatusBadgeProps) {
  const { t } = useTranslation();

  return (
    <Badge
      variant={VARIANT[status] ?? 'outline'}
      className={className}
      data-testid="compliance-status-badge"
    >
      {t(`compliance.status.${status}`)}
    </Badge>
  );
}
