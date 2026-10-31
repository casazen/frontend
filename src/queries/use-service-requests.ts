import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  acceptLongRentProposal,
  acceptServiceRequestAsBackup,
  acceptServiceRequestProposal,
  cancelLongRentServiceRequest,
  cancelServiceRequest,
  completeServiceRequest,
  confirmLongRentFinalAmount,
  confirmServiceRequestFinalAmount,
  createLongRentPaymentSession,
  createLongRentServiceRequest,
  createServiceRequest,
  createServiceRequestPaymentSession,
  fetchAllLongRentServiceRequests,
  fetchIntervention,
  fetchInterventionCounts,
  fetchInterventions,
  fetchLongRentServiceRequest,
  fetchLongRentServiceRequests,
  fetchLongRentSuppliers,
  fetchMarketplaceSupplier,
  fetchMarketplaceSuppliers,
  fetchServiceRequestPhoto,
  fetchServiceRequests,
  fetchSuppliersByProperty,
  fetchUsedSuppliers,
  markLongRentServiceRequestPaid,
  markServiceRequestPaid,
  recordOfflineServiceRequestPayment,
  rejectLongRentProposal,
  rejectServiceRequest,
  rejectServiceRequestProposal,
  remindLongRentServiceRequest,
  requestServiceRequestPayment,
  sendServiceRequestQuote,
  remindServiceRequest,
  takeServiceRequest,
  withdrawServiceRequestQuote,
} from '@/api/service-requests.api';
import type {
  CreateLongRentServiceRequestDto,
  CreateServiceRequestDto,
  SendServiceRequestQuoteDto,
  InterventionFilterParams,
  InterventionListParams,
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

/**
 * The long-rent requests made for one lease contract (LR-03c), newest first, for the tab of the jobs of its sheet: the most the API gives
 * in a page, a contract does not have more. Read again when the tab opens: the requests change on other screens.
 */
export function useLeaseServiceRequests(leaseId: string) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, 'long-rent', 'lease', leaseId],
    queryFn: () => fetchLongRentServiceRequests({ leaseId, pageSize: 100 }),
    refetchOnMount: 'always',
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

// ─── The host's interventions (SR-08a): the list with its chips, one request, and what the host does on it ───

/** 422 code of a reminder asked before the interval has passed; the request is read again and says from when (`hostAction.remindAvailableAt`). */
const REMIND_TOO_SOON_CODE = 'service_request_remind_too_soon';
/** 409 code of an action on a request that changed meanwhile (the supplier answered, another tab acted): the xmin of the request. */
const STATE_CHANGED_CODE = 'service_request_state_changed';

/**
 * The host's list of interventions for the state of the list (chip, filters, order, page), which the server answers. The rows that were
 * there stay, a little dimmed, while the next ones come. Read again when the page opens: the requests change on other screens.
 */
export function useInterventions(params: InterventionListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, 'host', 'list', params],
    queryFn: () => fetchInterventions(params),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    enabled: options.enabled ?? true,
  });
}

/** The numbers on the chips: the same filters, whatever the chip. They follow the list (any action invalidates both). */
export function useInterventionCounts(params: InterventionFilterParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, 'host', 'counts', params],
    queryFn: () => fetchInterventionCounts(params),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    enabled: options.enabled ?? true,
  });
}

/**
 * The latest hundred interventions of the host (the largest page the API gives): the suppliers among them are the choices of the filter
 * of the list. Kept apart from the list, so that a step on a request does not read them again.
 */
export function useLatestInterventions() {
  return useQuery({
    queryKey: ['latest-interventions'],
    queryFn: () => fetchInterventions({ view: 'all', sort: 'created:desc', page: 1, pageSize: 100 }),
    select: (response) => response.items,
    staleTime: 60_000,
    refetchOnMount: true,
  });
}

/**
 * One request as its host reads it (drawer and page). `poll`: read again every few seconds until it is paid, for a payment sent to Stripe
 * that Stripe confirms to the backend a little later.
 */
export function useIntervention(id: string, options: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, 'host', 'detail', id],
    queryFn: () => fetchIntervention(id),
    enabled: id !== '',
    refetchOnMount: 'always',
    refetchInterval: (query) => (options.poll && query.state.data?.status !== 'Pagato' ? PAYMENT_POLL_MS : false),
  });
}

/**
 * A photo of the work, as an address an image can show (`data:`). Its key is not under the one of the requests: a step on a request
 * reads the request again, not its photos, which do not change.
 */
export function useWorkPhoto(url: string) {
  return useQuery({
    queryKey: ['service-request-photo', url],
    queryFn: () => fetchServiceRequestPhoto(url),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * A step the host takes on one request (remind, answer a proposed time, confirm the final amount, cancel). The answer is the request as it
 * is now: the drawer and the page show it at once and the lists read it again. A step that is refused (the supplier answered meanwhile,
 * another tab acted: 409) says so in the words of the page and reads the request again, so the person sees the state as it is.
 */
function useInterventionAction<Variables>({ run, doneKey }: { run: (variables: Variables) => Promise<ServiceRequest>; doneKey: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (request) => {
      queryClient.setQueryData([SERVICE_REQUESTS_KEY, 'host', 'detail', request.id], request);
      void queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      toast.success(i18n.t(doneKey));
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
      if (code === STATE_CHANGED_CODE) {
        toast.error(i18n.t('interventions.errors.stateChanged'));
        return;
      }
      // A reminder that came too soon: the server says how often it can be done, and the row shows from when.
      toast.error(
        getProblemMessage(error, i18n.t) ?? i18n.t(code === REMIND_TOO_SOON_CODE ? 'interventions.errors.remindTooSoon' : 'serviceRequest.actionFailed'),
      );
    },
  });
}

/** The host cancels a request up to the work in progress, with the reason the supplier reads. Always free. */
export function useCancelIntervention() {
  return useInterventionAction({
    run: ({ id, reason }: { id: string; reason: string }) => cancelServiceRequest(id, reason),
    doneKey: 'interventions.toast.cancelled',
  });
}

/** The host reminds the supplier to answer: an e-mail to the supplier, only when this is called. */
export function useRemindIntervention() {
  return useInterventionAction({ run: (id: string) => remindServiceRequest(id), doneKey: 'interventions.toast.reminded' });
}

export function useAcceptInterventionProposal() {
  return useInterventionAction({ run: (id: string) => acceptServiceRequestProposal(id), doneKey: 'interventions.toast.proposalAccepted' });
}

export function useRejectInterventionProposal() {
  return useInterventionAction({ run: (id: string) => rejectServiceRequestProposal(id), doneKey: 'interventions.toast.proposalRejected' });
}

export function useConfirmInterventionAmount() {
  return useInterventionAction({ run: (id: string) => confirmServiceRequestFinalAmount(id), doneKey: 'interventions.toast.amountConfirmed' });
}

/** The host marks a finished request paid (outside CasaZen): irreversible, so the page asks first; the answer is the request as it is. */
export function useMarkInterventionPaid() {
  return useInterventionAction({ run: (id: string) => markServiceRequestPaid(id), doneKey: 'serviceRequest.markedPaid' });
}

/** The session to pay a request inside CasaZen: asked when the host presses «Paga» and used at once by the Payment Element. */
export function useCreateInterventionPaymentSession() {
  return useMutation({
    mutationFn: (id: string) => createServiceRequestPaymentSession(id),
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('interventions.pay.sessionError')),
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

/**
 * The suppliers the host already asked for a job (MKT, SR-09c), for «Le mie app» of the marketplace. A request made, cancelled or paid
 * changes it, and the requests are changed from other screens, so it is read again whenever the page opens.
 */
export function useUsedSuppliers() {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, 'suppliers'],
    queryFn: fetchUsedSuppliers,
    refetchOnMount: 'always',
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

/**
 * The request of the guided procedure «Richiedi un intervento» (SR-08b): the same `POST`, without the toasts, because the wizard
 * tells the outcome in its own words (a slot just taken, a supplier that is no longer available) and keeps the answers. The lists
 * of the interventions and the supplier's inbox are read again.
 */
export function useCreateIntervention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateServiceRequestDto) => createServiceRequest(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      void queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      void queryClient.invalidateQueries({ queryKey: ['latest-interventions'] });
    },
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

/**
 * A backup supplier says it would take the job if the primary supplier does not (SP-BKP): the request stays new and holds nothing of the
 * agenda. If the group closed meanwhile (the primary took the job) the server says so (409) and the lists are read again.
 */
export function useAcceptServiceRequestAsBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => acceptServiceRequestAsBackup(id),
    onSuccess: () => {
      refreshSupplierRequests(queryClient);
      toast.success(i18n.t('supplier.requests.backup.acceptedToast'));
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
