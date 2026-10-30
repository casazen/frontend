import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import {
  useCancelServiceRequest,
  useCompleteServiceRequest,
  useRecordOfflineServiceRequestPayment,
  useRejectServiceRequest,
  useRequestServiceRequestPayment,
  useSendServiceRequestQuote,
  useTakeServiceRequest,
  useWithdrawServiceRequestQuote,
} from '@/queries/use-service-requests';
import { useSupplierSuspended } from '@/queries/supplier/use-profile';
import type { SupplierServiceRequest } from '@/types/service-request';
import { RejectServiceRequestDialog } from '../components/reject-service-request-dialog';
import { QuoteSheet } from './quote-sheet';
import { RecordPaymentDialog } from './record-payment-dialog';

export interface RequestActions {
  /** A suspended supplier performs no action (SU-12): the buttons stay, disabled, and the banner says why. */
  suspended: boolean;
  /** An action is going on: a second tap is ignored. */
  busy: boolean;
  /** Which request an action is going on for, to show the spinner on its button. */
  takingId: string | null;
  completingId: string | null;
  /** The request a reminder for the payment is going out for. */
  remindingId: string | null;
  take: (id: string) => void;
  complete: (id: string) => void;
  /** Opens the dialog that asks why, then refuses the request. */
  askReject: (id: string) => void;
  /** Opens the dialog that asks why, then cancels the job the supplier took and has not started (SP-16c-c). */
  askCancel: (id: string) => void;
  /** Opens the sheet of the quote (SP-04b): empty to answer a new request, filled to change the quote that waits (the new one replaces it). */
  askQuote: (request: SupplierServiceRequest) => void;
  /** Asks to confirm, then takes the quote back: the request is «da rispondere» again. */
  askWithdrawQuote: (id: string) => void;
  /** Asks the payer for the payment of a completed job again (SP-15a): one e-mail with a new link, at most one a day. */
  remindPayment: (id: string) => void;
  /** Opens the confirmation that records a payment received outside CasaZen (SP-15a). */
  askRecordPayment: (request: SupplierServiceRequest) => void;
  /** The dialog of the refusal, of the cancellation, of the quote or of the payment: render it once, anywhere in the page. */
  dialog: ReactNode;
}

/** What the supplier is being asked about, if anything: one dialog at a time. */
type Asking =
  | { kind: 'reject'; id: string }
  | { kind: 'cancel'; id: string }
  | { kind: 'withdrawQuote'; id: string }
  | { kind: 'quote'; request: SupplierServiceRequest }
  | { kind: 'recordPayment'; request: SupplierServiceRequest };

/**
 * What the supplier can do about a request (take, complete, refuse, cancel, answer with a quote, take the quote back, remind the payer,
 * record a payment received outside CasaZen), shared by the list, the drawer and the page of the request. `onChanged` runs when the
 * server refuses an action because the request changed meanwhile (409, 422: the customer cancelled while the supplier was taking it),
 * so that whoever shows the request reads it again.
 */
export function useRequestActions(onChanged?: () => void): RequestActions {
  const { t } = useTranslation();
  const take = useTakeServiceRequest();
  const complete = useCompleteServiceRequest();
  const reject = useRejectServiceRequest();
  const cancel = useCancelServiceRequest();
  const sendQuote = useSendServiceRequestQuote();
  const withdrawQuote = useWithdrawServiceRequestQuote();
  const remind = useRequestServiceRequestPayment();
  const recordPayment = useRecordOfflineServiceRequestPayment();
  const suspended = useSupplierSuspended();
  const [asking, setAsking] = useState<Asking | null>(null);
  // `mutate` of TanStack Query keeps its identity: with a caller that does not change `onChanged`, the actions are the same
  // functions on every render, so a list definition that holds them is not built again for nothing.
  const { mutate: mutateTake } = take;
  const { mutate: mutateComplete } = complete;
  const { mutate: mutateRemind } = remind;
  const takeRequest = useCallback((id: string) => mutateTake(id, { onError: onChanged }), [mutateTake, onChanged]);
  const completeRequest = useCallback((id: string) => mutateComplete({ id }, { onError: onChanged }), [mutateComplete, onChanged]);
  const remindPayment = useCallback((id: string) => mutateRemind(id, { onError: onChanged }), [mutateRemind, onChanged]);
  const askReject = useCallback((id: string) => setAsking({ kind: 'reject', id }), []);
  const askCancel = useCallback((id: string) => setAsking({ kind: 'cancel', id }), []);
  const askQuote = useCallback((request: SupplierServiceRequest) => setAsking({ kind: 'quote', request }), []);
  const askWithdrawQuote = useCallback((id: string) => setAsking({ kind: 'withdrawQuote', id }), []);
  const askRecordPayment = useCallback((request: SupplierServiceRequest) => setAsking({ kind: 'recordPayment', request }), []);
  const close = () => setAsking(null);

  let dialog: ReactNode = null;
  if (asking?.kind === 'reject') {
    const { id } = asking;
    dialog = (
      <RejectServiceRequestDialog
        key={id}
        open
        isPending={reject.isPending}
        onCancel={close}
        onConfirm={(reason) => reject.mutate({ id, reason }, { onSuccess: close, onError: onChanged })}
      />
    );
  } else if (asking?.kind === 'cancel') {
    const { id } = asking;
    dialog = (
      <RejectServiceRequestDialog
        key={`cancel-${id}`}
        mode="cancel"
        open
        isPending={cancel.isPending}
        onCancel={close}
        onConfirm={(reason) => cancel.mutate({ id, reason }, { onSuccess: close, onError: onChanged })}
      />
    );
  } else if (asking?.kind === 'quote') {
    const { request } = asking;
    dialog = (
      <QuoteSheet
        key={`quote-${request.id}`}
        request={request}
        isPending={sendQuote.isPending}
        onCancel={close}
        onSubmit={(quote) => sendQuote.mutate({ id: request.id, quote }, { onSuccess: close, onError: onChanged })}
      />
    );
  } else if (asking?.kind === 'withdrawQuote') {
    const { id } = asking;
    dialog = (
      <ConfirmationDialog
        key={`withdraw-${id}`}
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={t('supplier.requests.quote.withdraw.title')}
        description={t('supplier.requests.quote.withdraw.description')}
        confirmLabel={t('supplier.requests.quote.withdraw.confirm')}
        cancelLabel={t('supplier.requests.quote.withdraw.back')}
        consequences={[t('supplier.requests.quote.withdraw.again'), t('supplier.requests.quote.withdraw.silent')]}
        isLoading={withdrawQuote.isPending}
        onConfirm={() => withdrawQuote.mutate(id, { onError: onChanged })}
      />
    );
  } else if (asking?.kind === 'recordPayment') {
    const { request } = asking;
    dialog = (
      <RecordPaymentDialog
        key={`record-${request.id}`}
        online={request.paymentMode === 'Online'}
        isPending={recordPayment.isPending}
        onCancel={close}
        onConfirm={(reason) => recordPayment.mutate({ id: request.id, reason: reason || undefined }, { onError: onChanged })}
      />
    );
  }

  return {
    suspended,
    busy:
      take.isPending ||
      complete.isPending ||
      reject.isPending ||
      cancel.isPending ||
      sendQuote.isPending ||
      withdrawQuote.isPending ||
      remind.isPending ||
      recordPayment.isPending,
    takingId: take.isPending ? (take.variables ?? null) : null,
    completingId: complete.isPending ? (complete.variables?.id ?? null) : null,
    remindingId: remind.isPending ? (remind.variables ?? null) : null,
    take: takeRequest,
    complete: completeRequest,
    askReject,
    askCancel,
    askQuote,
    askWithdrawQuote,
    remindPayment,
    askRecordPayment,
    dialog,
  };
}
