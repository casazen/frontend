import { useTranslation } from 'react-i18next';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';
import { ALLOGGIATI_ATTENTION_CLASS } from '../alloggiati-status.utils';

export interface AlloggiatiStatusBadgeProps {
  status: AlloggiatiWebStatus;
  isOverdue?: boolean;
}

const STATUS_STYLES: Record<AlloggiatiWebStatus, { variant: BadgeProps['variant']; className?: string }> = {
  DaInviare: { variant: 'secondary' },
  // CasaZen does not transmit: the host must send it. Orange, never green (A5-01).
  DaInviareManualmente: { variant: 'warning', className: ALLOGGIATI_ATTENTION_CLASS },
  // Declared by the host, no receipt held by CasaZen: neutral, distinct from the receipt's green.
  InviatoManualmente: { variant: 'outline' },
  Inviato: { variant: 'success' },
  Rifiutato: { variant: 'destructive' },
  Errore: { variant: 'destructive' },
};

export function AlloggiatiStatusBadge({ status, isOverdue = false }: AlloggiatiStatusBadgeProps) {
  const { t } = useTranslation();
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.DaInviare;

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={style.variant} className={style.className} data-testid="alloggiati-status-badge">
        {t(`alloggiati.statusLabel.${status}`)}
      </Badge>
      {isOverdue && (
        <Badge variant="destructive" data-testid="alloggiati-overdue-badge">
          {t('alloggiati.overdue')}
        </Badge>
      )}
    </span>
  );
}
