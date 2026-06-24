import { useTranslation } from 'react-i18next';
import { PaymentCard } from './payment-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard } from 'lucide-react';
import type { Payment } from '@/types';

interface PaymentsListProps {
  payments: Payment[];
  isLoading?: boolean;
  onEdit?: (payment: Payment) => void;
  onDelete?: (payment: Payment) => void;
  onView?: (payment: Payment) => void;
  onProcess?: (payment: Payment) => void;
  onRefund?: (payment: Payment) => void;
  onAdd?: () => void;
}

export function PaymentsList({
  payments,
  isLoading,
  onEdit,
  onDelete,
  onView,
  onProcess,
  onRefund,
  onAdd,
}: PaymentsListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-48 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!payments || payments.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title={t('payment.list.emptyTitle')}
        description={t('payment.list.emptyDescription')}
        action={onAdd ? { label: t('payment.list.addAction'), onClick: onAdd } : undefined}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {payments.map((payment) => (
        <PaymentCard
          key={payment.id}
          payment={payment}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
          onProcess={onProcess}
          onRefund={onRefund}
        />
      ))}
    </div>
  );
}
