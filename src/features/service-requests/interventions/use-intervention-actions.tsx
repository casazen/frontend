import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { ClientPaymentStatus } from '@/features/public-booking/checkout-outcome';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import {
  useAcceptInterventionProposal,
  useConfirmInterventionAmount,
  useCreateInterventionPaymentSession,
  useMarkInterventionPaid,
  useRejectInterventionProposal,
  useRemindIntervention,
} from '@/queries/use-service-requests';
import type { ServicePaymentSession, ServiceRequest } from '@/types/service-request';
import { MarkPaidDialog } from '../components/mark-paid-dialog';
import { CancelInterventionDialog } from './cancel-intervention-dialog';
import { PayInterventionDialog } from './pay-intervention-dialog';

export interface InterventionSteps {
  remind: (request: ServiceRequest) => void;
  acceptProposal: (request: ServiceRequest) => void;
  rejectProposal: (request: ServiceRequest) => void;
  confirmAmount: (request: ServiceRequest) => void;
  markPaid: (request: ServiceRequest) => void;
  pay: (request: ServiceRequest) => void;
  cancel: (request: ServiceRequest) => void;
}

export interface InterventionActions {
  steps: InterventionSteps;
  /** A step is running: the buttons wait, so that a second tap cannot send it twice. */
  busy: boolean;
  paymentSent: boolean;
  dialogs: ReactNode;
}

type Dialog = { kind: 'cancel' | 'markPaid'; request: ServiceRequest };

export function useInterventionActions(): InterventionActions {
  const { t } = useTranslation();
  const remindMutation = useRemindIntervention();
  const acceptMutation = useAcceptInterventionProposal();
  const rejectMutation = useRejectInterventionProposal();
  const confirmMutation = useConfirmInterventionAmount();
  const paidMutation = useMarkInterventionPaid();
  const sessionMutation = useCreateInterventionPaymentSession();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [payment, setPayment] = useState<{ request: ServiceRequest; session: ServicePaymentSession } | null>(null);
  const [paymentSent, setPaymentSent] = useState(false);

  const { mutate: remindNow } = remindMutation;
  const { mutate: acceptNow } = acceptMutation;
  const { mutate: rejectNow } = rejectMutation;
  const { mutate: confirmNow } = confirmMutation;
  const { mutate: askSession } = sessionMutation;

  const remind = useCallback((request: ServiceRequest) => remindNow(request.id), [remindNow]);
  const acceptProposal = useCallback((request: ServiceRequest) => acceptNow(request.id), [acceptNow]);
  const rejectProposal = useCallback((request: ServiceRequest) => rejectNow(request.id), [rejectNow]);
  const confirmAmount = useCallback((request: ServiceRequest) => confirmNow(request.id), [confirmNow]);
  const markPaid = useCallback((request: ServiceRequest) => setDialog({ kind: 'markPaid', request }), []);
  const cancel = useCallback((request: ServiceRequest) => setDialog({ kind: 'cancel', request }), []);
  const pay = useCallback(
    (request: ServiceRequest) => askSession(request.id, { onSuccess: (session) => setPayment({ request, session }) }),
    [askSession],
  );

  const busy =
    remindMutation.isPending ||
    acceptMutation.isPending ||
    rejectMutation.isPending ||
    confirmMutation.isPending ||
    paidMutation.isPending ||
    sessionMutation.isPending;

  const onPaymentSubmitted = (status: ClientPaymentStatus) => {
    setPayment(null);
    setPaymentSent(true);
    if (status === 'succeeded' || status === 'processing') toast.success(t('interventions.pay.sent'));
  };

  const dialogs = (
    <>
      {dialog?.kind === 'cancel' ? <CancelInterventionDialog request={dialog.request} onClose={() => setDialog(null)} /> : null}

      {dialog?.kind === 'markPaid' ? (
        <MarkPaidDialog
          supplierName={dialog.request.supplierName}
          category={getServiceCategoryLabel(dialog.request.category, t)}
          isPending={paidMutation.isPending}
          onCancel={() => setDialog(null)}
          onConfirm={() => paidMutation.mutate(dialog.request.id, { onSuccess: () => setDialog(null) })}
        />
      ) : null}

      {payment ? (
        <PayInterventionDialog
          session={payment.session}
          supplierName={payment.request.supplierName}
          returnUrl={window.location.href}
          onClose={() => setPayment(null)}
          onSubmitted={onPaymentSubmitted}
        />
      ) : null}
    </>
  );

  const steps = useMemo<InterventionSteps>(
    () => ({ remind, acceptProposal, rejectProposal, confirmAmount, markPaid, pay, cancel }),
    [remind, acceptProposal, rejectProposal, confirmAmount, markPaid, pay, cancel],
  );

  return { steps, busy, paymentSent, dialogs };
}
