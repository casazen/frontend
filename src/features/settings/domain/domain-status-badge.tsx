import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { DomainVerificationStatus } from '@/types/domain.types';

interface DomainStatusBadgeProps {
  status: DomainVerificationStatus;
}

export function DomainStatusBadge({ status }: DomainStatusBadgeProps) {
  const { t } = useTranslation();

  const variant =
    status === 'Verified' ? 'default' : status === 'Failed' ? 'destructive' : 'secondary';

  return (
    <Badge variant={variant} data-testid="domain-status-badge">
      {t(`domain.status.${status}`)}
    </Badge>
  );
}
