import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';
import { AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';

export interface ReportStatusProps {
  /** Report status from the API. */
  status: AlloggiatiWebStatus;
  /** Deadline timestamp for the report. */
  deadlineAt?: string;
  /** Hours until deadline. */
  hoursUntilDeadline?: number;
  /** Whether the report is overdue. */
  isOverdue?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Status badge for Alloggiati Web reports (ADR-015).
 * Shows status with appropriate color and deadline indicators.
 */
export function ReportStatus({
  status,
  deadlineAt,
  hoursUntilDeadline,
  isOverdue,
  className,
}: ReportStatusProps) {
  const { t } = useTranslation();

  // Map status to color classes and icons
  const statusConfig: Record<
    AlloggiatiWebStatus,
    { colors: string; Icon: typeof Clock }
  > = {
    DaInviare: {
      colors: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      Icon: Clock,
    },
    DaInviareManualmente: {
      colors: 'bg-orange-100 text-orange-800 border-orange-200',
      Icon: AlertCircle,
    },
    SentReceiptPending: {
      colors: 'bg-blue-100 text-blue-800 border-blue-200',
      Icon: Clock,
    },
    InviatoManualmente: {
      colors: 'bg-green-100 text-green-800 border-green-200',
      Icon: CheckCircle,
    },
    Inviato: {
      colors: 'bg-green-100 text-green-800 border-green-200',
      Icon: CheckCircle,
    },
    Rifiutato: {
      colors: 'bg-red-100 text-red-800 border-red-200',
      Icon: XCircle,
    },
    Errore: {
      colors: 'bg-red-100 text-red-800 border-red-200',
      Icon: XCircle,
    },
  };

  const config = statusConfig[status];
  const { Icon } = config;

  // Get label from i18n
  const label = t(`alloggiati.status.${status.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase()}`);

  // Determine if we should show deadline alert
  const showDeadlineAlert = isOverdue || (hoursUntilDeadline !== undefined && hoursUntilDeadline < 6);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        data-testid="report-status-badge"
        data-status={status}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
          config.colors
        )}
      >
        <Icon className="h-3 w-3" />
        {label}
      </span>
      {showDeadlineAlert && deadlineAt && (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium',
            isOverdue ? 'text-red-600' : 'text-orange-600'
          )}
        >
          <AlertCircle className="h-3 w-3" />
          {isOverdue
            ? t('alloggiati.status.overdue')
            : t('alloggiati.status.deadline_soon', { hours: hoursUntilDeadline })}
        </span>
      )}
    </div>
  );
}
