import { useTranslation } from 'react-i18next';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';
import { ALLOGGIATI_ATTENTION_CLASS } from '../alloggiati-status.utils';

export interface AlloggiatiStatusBadgeProps {
  status: AlloggiatiWebStatus;
  isOverdue?: boolean;
  /**
   * An archived receipt covers the stay (the server says so): the badge says «Ricevuta archiviata», in the green only a receipt earns. Never set for a stay without one:
   * an entrusted stay is yellow until the receipt is archived.
   */
  receiptArchived?: boolean;
}

/** Long labels wrap inside the pill instead of pushing the page sideways. */
const WRAPPING = 'h-auto max-w-full whitespace-normal py-1 text-left';

const STATUS_STYLES: Record<AlloggiatiWebStatus, { variant: BadgeProps['variant']; className?: string }> = {
  DaInviare: { variant: 'secondary' },
  // CasaZen does not transmit: the host must send it. Orange, never green (A5-01).
  DaInviareManualmente: { variant: 'warning', className: ALLOGGIATI_ATTENTION_CLASS },
  // Declared by the host, no receipt held by CasaZen: neutral, distinct from the receipt's green.
  InviatoManualmente: { variant: 'outline' },
  // Sent successfully, awaiting receipt retrieval (ADR-015).
  Sending: { variant: 'secondary' },
  PartiallyAccepted: { variant: 'warning' },
  ToVerify: { variant: 'warning' },
  SentReceiptPending: { variant: 'secondary' },
  Inviato: { variant: 'success' },
  Rifiutato: { variant: 'destructive' },
  Errore: { variant: 'destructive' },
  // A no-show owes no communication: neutral, neither the green of a receipt nor the orange of a task.
  NotDue: { variant: 'outline' },
  // The guests are on the channel manager, which sends them: yellow, waiting for the receipt (E20/F01/US02). Never the green of a receipt.
  EntrustedToChannelManager: { variant: 'warning', className: WRAPPING },
  // A guest could not be written to the channel manager: the host corrects or retries.
  ChannelManagerWriteFailed: { variant: 'destructive', className: WRAPPING },
};

export function AlloggiatiStatusBadge({ status, isOverdue = false, receiptArchived = false }: AlloggiatiStatusBadgeProps) {
  const { t } = useTranslation();
  const style = receiptArchived ? { variant: 'success' as const, className: WRAPPING } : (STATUS_STYLES[status] ?? STATUS_STYLES.DaInviare);

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={style.variant} className={style.className} data-testid="alloggiati-status-badge">
        {receiptArchived ? t('alloggiati.channelManager.receiptArchivedLabel') : t(`alloggiati.statusLabel.${status}`)}
      </Badge>
      {isOverdue && (
        <Badge variant="destructive" data-testid="alloggiati-overdue-badge">
          {t('alloggiati.overdue')}
        </Badge>
      )}
    </span>
  );
}
