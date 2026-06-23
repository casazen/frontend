import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';

export interface AlloggiatiStatusBadgeProps {
  status: AlloggiatiWebStatus;
  isOverdue?: boolean;
}

const STATUS_KEY_MAP: Record<AlloggiatiWebStatus, string> = {
  Pending: 'alloggiati.statusPending',
  Submitted: 'alloggiati.statusSubmitted',
  Confirmed: 'alloggiati.statusConfirmed',
  Failed: 'alloggiati.statusFailed',
};

const STATUS_VARIANTS: Record<
  AlloggiatiWebStatus,
  'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline'
> = {
  Pending: 'secondary',
  Submitted: 'warning',
  Confirmed: 'success',
  Failed: 'destructive',
};

export function AlloggiatiStatusBadge({ status, isOverdue = false }: AlloggiatiStatusBadgeProps) {
  const { t } = useTranslation();

  if (isOverdue) {
    return (
      <Badge variant="destructive" data-testid="alloggiati-status-badge">
        {t('alloggiati.expired')}
      </Badge>
    );
  }

  const label = t(STATUS_KEY_MAP[status] ?? STATUS_KEY_MAP.Pending);
  const variant = STATUS_VARIANTS[status] ?? STATUS_VARIANTS.Pending;

  return (
    <Badge variant={variant} data-testid="alloggiati-status-badge">
      {label}
    </Badge>
  );
}
