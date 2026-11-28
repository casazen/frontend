import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { CfPracticeStatus } from '@/types/concordatofacile.types';

export interface CfStatusBadgeProps {
  status: CfPracticeStatus;
  className?: string;
}

export function CfStatusBadge({ status, className }: CfStatusBadgeProps) {
  const { t } = useTranslation();

  const colorClasses = {
    Received: 'bg-blue-100 text-blue-800 border-blue-200',
    DraftSent: 'bg-blue-100 text-blue-800 border-blue-200',
    SignedReceived: 'bg-blue-100 text-blue-800 border-blue-200',
    SentToAssociation: 'bg-blue-100 text-blue-800 border-blue-200',

    InProgress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    AwaitingUser: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Attested: 'bg-yellow-100 text-yellow-800 border-yellow-200',

    Registered: 'bg-green-100 text-green-800 border-green-200',

    ClosedWithoutAttestation: 'bg-red-100 text-red-800 border-red-200',

    Suspended: 'bg-gray-100 text-gray-800 border-gray-200',

    Unknown: 'bg-gray-50 text-gray-700 border-gray-300',
  };

  const colors = colorClasses[status] || colorClasses.Unknown;

  const label = status === 'Unknown'
    ? t('concordatofacile.status.unknownStatus')
    : t(`concordatofacile.status.statusLabels.${status}`);

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
