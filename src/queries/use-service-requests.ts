import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  acceptLongRentProposal,
  cancelLongRentServiceRequest,
  cancelServiceRequest,
  completeServiceRequest,
  confirmLongRentFinalAmount,
  createLongRentPaymentSession,
  createLongRentServiceRequest,
  createServiceRequest,
  fetchAllLongRentServiceRequests,
  fetchLongRentServiceRequest,
  fetchLongRentServiceRequests,
  fetchLongRentSuppliers,
  fetchMarketplaceSupplier,
  fetchMarketplaceSuppliers,
  fetchServiceRequests,
  fetchSuppliersByProperty,
  markLongRentServiceRequestPaid,
  markServiceRequestPaid,
  recordOfflineServiceRequestPayment,
  rejectLongRentProposal,
  rejectServiceRequest,
  remindLongRentServiceRequest,
  requestServiceRequestPayment,
  sendServiceRequestQuote,
  takeServiceRequest,
  withdrawServiceRequestQuote,
} from '@/api/service-requests.api';
import type {
  CreateLongRentServiceRequestDto,
  CreateServiceRequestDto,
  SendServiceRequestQuoteDto,
  ServiceRequest,
  ServiceRequestHostView,
  SupplierPickerSort,
} from '@/types/service-request';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { isAxiosError } from 'axios';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';

const SERVICE_REQUESTS_KEY = 'service-requests';
/** What the dashboard reads about the work (the KPIs of every period, the three numbers of the home): a supplier transition changes it (SU-11). */
const SUPPLIER_DASHBOARD_KEY = ['supplier', 'dashboard'];

/** 422 code of a supplier action refused because the supplier is suspended or not active (SU-12). */
const SUPPLIER_NOT_ACTIVE_CODE = 'service_request_supplier_not_active';

/** 422 code of a reminder for the payment refused because one went out less than a day ago (SP-15a): a rule, not a failure. */
const PAYMENT_REQUEST_TOO_SOON_CODE = 'service_payment_request_too_soon';

/**
 * Toast of a failed supplier action. When the API says the supplier is not active (an admin suspended it while the page
 * was open) the supplier profile is reloaded, so the console shows the suspension banner and disables the actions.
 */
function onSupplierActionError(queryClient: QueryClient, error: unknown) {
  if (isAxiosError(error) && getProblemCode(error.response?.data) === SUPPLIER_NOT_ACTIVE_CODE) {
    void queryClient.invalidateQueries({ queryKey: ['supplier', 'profile'] });
  }
  toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('serviceRequest.actionFailed'));
}

/**
 * Short-rent requests (D2): `bookingId` for one stay, `propertyId` for a property, `listAll` for every request in
 * scope. Nothing is fetched without one of them.
 */
export function useServiceRequests(params?: {
  propertyId?: string;
  bookingId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  listAll?: boolean;
}) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, params],
    queryFn: () => fetchServiceRequests(params),
    enabled: !!params?.listAll || !!params?.propertyId || !!params?.bookingId,
  });
}

/** Long-rent requests (D2) of a property, or of every property in scope without `propertyId`. */
export function useLongRentServiceRequests(propertyId?: string) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, 'long-rent', propertyId ?? null],
    queryFn: () => fetchLongRentServiceRequests({ propertyId, pageSize: 50 }),
  });
}

/** How often a request waiting for the payment to be confirmed is read again, in milliseconds. */
const PAYMENT_POLL_MS = 4000;

/**
 * Every long-rent request in scope (LR-08b): the open ones, the closed ones or all, newest first. The list searches and sorts
 * them itself, so it has them all. Read again when the page opens: the requests change on other screens and the query client does
 * not read a list again on mount by itself.
 */
export function useAllLongRentServiceRequests(view?: ServiceRequestHostView) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, 'long-rent', 'all', view ?? 'all'],
    queryFn: () => fetchAllLongRentServiceRequests(view),
    refetchOnMount: 'always',
  });
}

/**
 * One long-rent request (LR-08b). `poll`: read again every few seconds until it is paid, for a payment sent to Stripe that Stripe
 * confirms to the backend a little later.
 */
export function useLongRentServiceRequest(id: string, options: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, 'long-rent', 'detail', id],
    queryFn: () => fetchLongRentServiceRequest(id),
    enabled: id !== '',
    refetchOnMount: 'always',
    refetchInterval: (query) => (options.poll && query.state.data?.status !== 'Pagato' ? PAYMENT_POLL_MS : false),
  });
}

/**
 * A step the landlord takes on one request (remind, answer a proposed time, confirm the final amount, cancel). The answer is the
 * request as it is now: the page shows it at once and the lists read it again. When the step is refused (the supplier answered
 * meanwhile, another tab acted) the request is read again and the reason is said.
 */
function useLongRentHostAction<Variables>({ run, doneKey }: { run: (variables: Variables) => Promise<ServiceRequest>; doneKey: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (request) => {
      queryClient.setQueryData([SERVICE_REQUESTS_KEY, 'long-rent', 'detail', request.id], request);
      void queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      toast.success(i18n.t(doneKey));
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('serviceRequest.actionFailed'));
    },
  });
}

/** The landlord cancels a long-rent request, with the reason the supplier is told. */
export function useCancelLongRentServiceRequest() {
  return useLongRentHostAction({
    run: ({ id, reason }: { id: string; reason: string }) => cancelLongRentServiceRequest(id, reason),
    doneKey: 'longRentRequests.toast.cancelled',
  });
}

/** The landlord reminds the supplier to answer: an e-mail to the supplier, only when this is called. */
export function useRemindLongRentServiceRequest() {
  return useLongRentHostAction({ run: (id: string) => remindLongRentServiceRequest(id), doneKey: 'longRentRequests.toast.reminded' });
}

export function useAcceptLongRentProposal() {
  return useLongRentHostAction({ run: (id: string) => acceptLongRentProposal(id), doneKey: 'longRentRequests.toast.proposalAccepted' });
}

export function useRejectLongRentProposal() {
  return useLongRentHostAction({ run: (id: string) => rejectLongRentProposal(id), doneKey: 'longRentRequests.toast.proposalRejected' });
}

export function useConfirmLongRentFinalAmount() {
  return useLongRentHostAction({ run: (id: string) => confirmLongRentFinalAmount(id), doneKey: 'longRentRequests.toast.amountConfirmed' });
}

/** The session to pay a request inside CasaZen: asked when the landlord presses «Paga» and used at once by the Payment Element. */
export function useCreateLongRentPaymentSession() {
  return useMutation({
    mutationFn: (id: string) => createLongRentPaymentSession(id),
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('longRentRequests.pay.sessionError')),
  });
}

/** Active suppliers for a property, searched in the long-rent context. */
export function useLongRentSuppliers(propertyId?: string, category?: string) {
  return useQuery({
    queryKey: ['suppliers', 'long-rent', propertyId, category],
    queryFn: () => fetchLongRentSuppliers(propertyId!, category),
    enabled: !!propertyId,
  });
}

export function useSuppliersByProperty(propertyId?: string, category?: string) {
  return useQuery({
    queryKey: ['suppliers', 'property', propertyId, category],
    queryFn: () => fetchSuppliersByProperty(propertyId!, category),
    enabled: !!propertyId,
  });
}

/**
 * The suppliers of the marketplace for a property (SR-09a): `q` and `sort` are answered by the server, which also sends each
 * supplier's services, "from" price, measured response time and «Verificato». While the words or the order change the list that was
 * there stays (for the same property and the same category only: another property's suppliers, or the whole list under the page of a
 * category, are never shown as this one's). Read again when the page is opened and the answer is older than the stale time: the
 * suppliers of a comune change when one is activated or changes its prices.
 */
export function useMarketplaceSuppliers(params: {
  propertyId?: string;
  category?: string;
  q?: string;
  sort?: SupplierPickerSort;
}) {
  const { propertyId, category, q, sort } = params;
  return useQuery({
    queryKey: ['suppliers', 'marketplace', propertyId, category ?? '', q ?? '', sort ?? 'name'],
    queryFn: () => fetchMarketplaceSuppliers({ propertyId: propertyId!, category, q, sort }),
    enabled: !!propertyId,
    refetchOnMount: true,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === propertyId && previousQuery?.queryKey[3] === (category ?? '') ? previous : undefined,
  });
}

/**
 * One supplier of the area of a property, for its page in the marketplace (MKT): every published service, the "from" price, the
 * measured response time and «Verificato». Read again when the page is opened (a supplier changes its services and prices).
 */
export function useMarketplaceSupplier(propertyId: string | undefined, orgId: string) {
  return useQuery({
    queryKey: ['suppliers', 'marketplace-supplier', propertyId, orgId],
    queryFn: () => fetchMarketplaceSupplier({ orgId, propertyId: propertyId! }),
    enabled: !!propertyId && orgId !== '',
    refetchOnMount: true,
  });
}

export function useCreateServiceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateServiceRequestDto) => createServiceRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      toast.success(i18n.t('serviceRequest.created'));
    },
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('serviceRequest.createFailed')),
  });
}

/** Long-rent request for a property (D2). */
export function useCreateLongRentServiceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLongRentServiceRequestDto) => createLongRentServiceRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      toast.success(i18n.t('serviceRequest.created'));
    },
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('serviceRequest.createFailed')),
  });
}

export function useTakeServiceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => takeServiceRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: SUPPLIER_DASHBOARD_KEY });
      toast.success(i18n.t('serviceRequest.taken'));
    },
    onError: (error) => onSupplierActionError(queryClient, error),
  });
}

export function useCompleteServiceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => completeServiceRequest(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: SUPPLIER_DASHBOARD_KEY });
      toast.success(i18n.t('serviceRequest.completed'));
    },
    onError: (error) => onSupplierActionError(queryClient, error),
  });
}

export function useRejectServiceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectServiceRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: SUPPLIER_DASHBOARD_KEY });
      toast.success(i18n.t('serviceRequest.rejected'));
    },
    onError: (error) => onSupplierActionError(queryClient, error),
  });
}

/** The supplier cancels a job it took (before it starts), with the reason the other party sees. */
export function useCancelServiceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelServiceRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: SUPPLIER_DASHBOARD_KEY });
      toast.success(i18n.t('supplier.requests.cancel.done'));
    },
    onError: (error) => onSupplierActionError(queryClient, error),
  });
}

/** What a step of the supplier on a request reads again: the request and its lists, the home, the numbers. */
function refreshSupplierRequests(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
  void queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
  void queryClient.invalidateQueries({ queryKey: SUPPLIER_DASHBOARD_KEY });
}

/**
 * The supplier answers a new request with a quote (SP-04b), or replaces the one that waits. Nothing goes to the customer before this
 * is called: the host or the customer of the showcase is told by the server when the quote is saved.
 */
export function useSendServiceRequestQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quote }: { id: string; quote: SendServiceRequestQuoteDto }) => sendServiceRequestQuote(id, quote),
    onSuccess: () => {
      refreshSupplierRequests(queryClient);
      toast.success(i18n.t('supplier.requests.quote.sentToast'));
    },
    onError: (error) => onSupplierActionError(queryClient, error),
  });
}

/** The supplier takes its quote back: the request is «da rispondere» again and nobody is told. */
export function useWithdrawServiceRequestQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => withdrawServiceRequestQuote(id),
    onSuccess: () => {
      refreshSupplierRequests(queryClient);
      toast.success(i18n.t('supplier.requests.quote.withdrawnToast'));
    },
    onError: (error) => onSupplierActionError(queryClient, error),
  });
}

/**
 * The supplier asks the payer for the payment of a completed job, or reminds them (SP-15a, behind `SupplierOnlinePayments`): one e-mail
 * with a new link, and only when this is called. «Once a day» is told as a notice, not as a failure.
 */
export function useRequestServiceRequestPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requestServiceRequestPayment(id),
    onSuccess: () => {
      refreshSupplierRequests(queryClient);
      toast.success(i18n.t('supplier.requests.payment.remindedToast'));
    },
    onError: (error) => {
      // The payment may have moved meanwhile (paid from another tab, a reminder already sent): the panel shows it as it is now.
      void queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      if (isAxiosError(error) && getProblemCode(error.response?.data) === PAYMENT_REQUEST_TOO_SOON_CODE) {
        toast.info(getProblemMessage(error, i18n.t) ?? i18n.t('supplier.requests.payment.tooSoon'));
        return;
      }
      onSupplierActionError(queryClient, error);
    },
  });
}

/**
 * The supplier records that the job was paid outside CasaZen (SP-15a, not behind the flag): the request becomes paid, with no commission,
 * and the host is told. A request paid inside CasaZen needs the reason, which the server checks too.
 */
export function useRecordOfflineServiceRequestPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => recordOfflineServiceRequestPayment(id, reason),
    onSuccess: () => {
      refreshSupplierRequests(queryClient);
      toast.success(i18n.t('supplier.requests.payment.recordedToast'));
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      onSupplierActionError(queryClient, error);
    },
  });
}

export function useMarkServiceRequestPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markServiceRequestPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      toast.success(i18n.t('serviceRequest.markedPaid'));
    },
    onError: (error) => {
      // A 409/422 means the request changed meanwhile (already paid from another tab): show it as it is now.
      void queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('serviceRequest.actionFailed'));
    },
  });
}

export function useMarkLongRentServiceRequestPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markLongRentServiceRequestPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      toast.success(i18n.t('serviceRequest.markedPaid'));
    },
    onError: (error) => {
      // A 409/422 means the request changed meanwhile (already paid from another tab): show it as it is now.
      void queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('serviceRequest.actionFailed'));
    },
  });
}
