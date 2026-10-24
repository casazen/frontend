import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { CfPracticeStatus } from '@/types/concordatofacile.types';

export interface CfStatusBadgeProps {
  /** Practice status from the API. */
  status: CfPracticeStatus;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Badge for ConcordatoFacile practice status (ADR-008-R18).
 * Maps status to semantic colors. Unknown statuses are displayed neutrally.
 */
export function CfStatusBadge({ status, className }: CfStatusBadgeProps) {
  const { t } = useTranslation();

  // Map status to color classes (ADR-008-R18)
  const colorClasses = {
    // Blue: initial/document stages
    Received: 'bg-blue-100 text-blue-800 border-blue-200',
    DraftSent: 'bg-blue-100 text-blue-800 border-blue-200',
    SignedReceived: 'bg-blue-100 text-blue-800 border-blue-200',
    SentToAssociation: 'bg-blue-100 text-blue-800 border-blue-200',

    // Yellow: in-progress/awaiting
    InProgress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    AwaitingUser: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Attested: 'bg-yellow-100 text-yellow-800 border-yellow-200',

    // Green: success
    Registered: 'bg-green-100 text-green-800 border-green-200',

    // Red: closed without success
    ClosedWithoutAttestation: 'bg-red-100 text-red-800 border-red-200',

    // Gray: suspended
    Suspended: 'bg-gray-100 text-gray-800 border-gray-200',

    // Unknown: neutral
    Unknown: 'bg-gray-50 text-gray-700 border-gray-300',
  };

  const colors = colorClasses[status] || colorClasses.Unknown;

  // Get label from i18n, or fallback to raw status for unknown
  const label = status === 'Unknown'
    ? t('concordatofacile.status.unknownStatus')
    : t(`concordatofacile.status.statusLabels.${status}`, { defaultValue: status });

  return (
    <span
      data-testid="cf-status-badge"
      data-status={status}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        colors,
        className
      )}
    >
      {label}
    </span>
  );
}
