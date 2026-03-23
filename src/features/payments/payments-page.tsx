import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { PaymentsList } from './components/payments-list';
import { ProcessPaymentDialog } from './components/process-payment-dialog';
import { RefundDialog } from './components/refund-dialog';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import {
  usePayments,
  useDeletePayment,
  useProcessPayment,
  useRefundPayment,
} from '@/queries/use-payments';
import { Plus, TrendingUp } from 'lucide-react';
import type { Payment, ProcessPaymentDto, RefundPaymentDto } from '@/types';

export function PaymentsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = usePayments();
  const deletePayment = useDeletePayment();
  const processPayment = useProcessPayment();
  const refundPayment = useRefundPayment();

  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [paymentToProcess, setPaymentToProcess] = useState<Payment | null>(null);
  const [paymentToRefund, setPaymentToRefund] = useState<Payment | null>(null);

  const handleEdit = (payment: Payment) => {
    navigate(`/payments/${payment.id}/edit`);
  };

  const handleView = (payment: Payment) => {
    navigate(`/payments/${payment.id}`);
  };

  const handleDelete = async () => {
    if (paymentToDelete) {
      await deletePayment.mutateAsync(paymentToDelete.id);
      setPaymentToDelete(null);
    }
  };

  const handleProcess = async (data: ProcessPaymentDto) => {
    if (paymentToProcess) {
      await processPayment.mutateAsync({ id: paymentToProcess.id, data });
    }
  };

  const handleRefund = async (data: RefundPaymentDto) => {
    if (paymentToRefund) {
      await refundPayment.mutateAsync({ id: paymentToRefund.id, data });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Payments"
          description="Manage payments and transactions"
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/payments/revenue')}>
                <TrendingUp className="mr-2 h-4 w-4" />
                Revenue Analytics
              </Button>
              <Button onClick={() => navigate('/payments/create')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Payment
              </Button>
            </div>
          }
        />

        <PaymentsList
          payments={data?.data || []}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={setPaymentToDelete}
          onView={handleView}
          onProcess={setPaymentToProcess}
          onRefund={setPaymentToRefund}
          onAdd={() => navigate('/payments/create')}
        />

        <ConfirmationDialog
          open={!!paymentToDelete}
          onOpenChange={(open) => !open && setPaymentToDelete(null)}
          title="Delete Payment"
          description="Are you sure you want to delete this payment? This action cannot be undone."
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={handleDelete}
          isLoading={deletePayment.isPending}
        />

        <ProcessPaymentDialog
          payment={paymentToProcess}
          open={!!paymentToProcess}
          onOpenChange={(open) => !open && setPaymentToProcess(null)}
          onConfirm={handleProcess}
          isLoading={processPayment.isPending}
        />

        <RefundDialog
          payment={paymentToRefund}
          open={!!paymentToRefund}
          onOpenChange={(open) => !open && setPaymentToRefund(null)}
          onConfirm={handleRefund}
          isLoading={refundPayment.isPending}
        />
      </div>
    </AppShell>
  );
}
