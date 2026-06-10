import { Badge } from '@/components/ui/badge';
import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';
import { ALLOGGIATI_STATUS_LABELS, ALLOGGIATI_STATUS_VARIANTS } from '../alloggiati-status.utils';

export interface AlloggiatiStatusBadgeProps {
  status: AlloggiatiWebStatus;
  isOverdue?: boolean;
}

export function AlloggiatiStatusBadge({ status, isOverdue = false }: AlloggiatiStatusBadgeProps) {
  if (isOverdue) {
    return (
      <Badge variant="destructive" data-testid="alloggiati-status-badge">
        Scaduto
      </Badge>
    );
  }

  const label = ALLOGGIATI_STATUS_LABELS[status] ?? ALLOGGIATI_STATUS_LABELS.Pending;
  const variant = ALLOGGIATI_STATUS_VARIANTS[status] ?? ALLOGGIATI_STATUS_VARIANTS.Pending;

  return (
    <Badge variant={variant} data-testid="alloggiati-status-badge">
      {label}
    </Badge>
  );
}
