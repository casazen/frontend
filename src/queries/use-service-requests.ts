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
const SUPPLIER_DASHBOARD_KEY = ['supplier', 'dashboard'];

/** 422 code of a supplier action refused because the supplier is suspended or not active (SU-12). */
const SUPPLIER_NOT_ACTIVE_CODE = 'service_request_supplier_not_active';

/** 422 code of a reminder for the payment refused because one went out less than a day ago (SP-15a): a rule, not a failure. */
const PAYMENT_REQUEST_TOO_SOON_CODE = 'service_payment_request_too_soon';

function onSupplierActionError(queryClient: QueryClient, error: unknown) {
  if (isAxiosError(error) && getProblemCode(error.response?.data) === SUPPLIER_NOT_ACTIVE_CODE) {
    void queryClient.invalidateQueries({ queryKey: ['supplier', 'profile'] });
  }
  toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('serviceRequest.actionFailed'));
}

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
    refetchOnMount: 'always',
  });
}

export function useLongRentServiceRequests(propertyId?: string) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, 'long-rent', propertyId ?? null],
    queryFn: () => fetchLongRentServiceRequests({ propertyId, pageSize: 50 }),
  });
}

const PAYMENT_POLL_MS = 4000;

export function useAllLongRentServiceRequests(view?: ServiceRequestHostView) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, 'long-rent', 'all', view ?? 'all'],
    queryFn: () => fetchAllLongRentServiceRequests(view),
    refetchOnMount: 'always',
  });
}

export function useLongRentServiceRequest(id: string, options: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, 'long-rent', 'detail', id],
    queryFn: () => fetchLongRentServiceRequest(id),
    enabled: id !== '',
    refetchOnMount: 'always',
    refetchInterval: (query) => (options.poll && query.state.data?.status !== 'Pagato' ? PAYMENT_POLL_MS : false),
  });
}

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

export function useCancelLongRentServiceRequest() {
  return useLongRentHostAction({
    run: ({ id, reason }: { id: string; reason: string }) => cancelLongRentServiceRequest(id, reason),
    doneKey: 'longRentRequests.toast.cancelled',
  });
}

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

export function useCreateLongRentPaymentSession() {
  return useMutation({
    mutationFn: (id: string) => createLongRentPaymentSession(id),
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('longRentRequests.pay.sessionError')),
  });
}

const REMIND_TOO_SOON_CODE = 'service_request_remind_too_soon';
const STATE_CHANGED_CODE = 'service_request_state_changed';

export function useInterventions(params: InterventionListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, 'host', 'list', params],
    queryFn: () => fetchInterventions(params),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    enabled: options.enabled ?? true,
  });
}

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

export function useIntervention(id: string, options: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, 'host', 'detail', id],
    queryFn: () => fetchIntervention(id),
    enabled: id !== '',
    refetchOnMount: 'always',
    refetchInterval: (query) => (options.poll && query.state.data?.status !== 'Pagato' ? PAYMENT_POLL_MS : false),
  });
}

export function useWorkPhoto(url: string) {
  return useQuery({
    queryKey: ['service-request-photo', url],
    queryFn: () => fetchServiceRequestPhoto(url),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });
}

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
      toast.error(
        getProblemMessage(error, i18n.t) ?? i18n.t(code === REMIND_TOO_SOON_CODE ? 'interventions.errors.remindTooSoon' : 'serviceRequest.actionFailed'),
      );
    },
  });
}

export function useCancelIntervention() {
  return useInterventionAction({
    run: ({ id, reason }: { id: string; reason: string }) => cancelServiceRequest(id, reason),
    doneKey: 'interventions.toast.cancelled',
  });
}

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

export function useMarkInterventionPaid() {
  return useInterventionAction({ run: (id: string) => markServiceRequestPaid(id), doneKey: 'serviceRequest.markedPaid' });
}

export function useCreateInterventionPaymentSession() {
  return useMutation({
    mutationFn: (id: string) => createServiceRequestPaymentSession(id),
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('interventions.pay.sessionError')),
  });
}

export function useLongRentSuppliers(propertyId?: string, category?: string) {
  return useQuery({
    queryKey: ['suppliers', 'long-rent', propertyId, category],
    queryFn: () => fetchLongRentSuppliers(propertyId!, category),
    enabled: !!propertyId,
  });
}

export function useSuppliersByProperty(propertyId?: string, category?: string, options: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: ['suppliers', 'property', propertyId, category],
    queryFn: () => fetchSuppliersByProperty(propertyId!, category),
    enabled: !!propertyId,
    ...(options.fresh ? { refetchOnMount: 'always' as const, staleTime: 0 } : {}),
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
  includeTrusted?: boolean;
  propertyId?: string;
  accountScope?: boolean;
  category?: string;
  q?: string;
  sort?: SupplierPickerSort;
}) {
  const { propertyId, accountScope, category, q, sort, includeTrusted } = params;
  const scopeKey = accountScope ? 'account' : propertyId;
  return useQuery({
    queryKey: ['suppliers', 'marketplace', scopeKey, category ?? '', q ?? '', sort ?? 'recommended', includeTrusted === true],
    queryFn: () => fetchMarketplaceSuppliers({ ...(accountScope ? { accountScope } : { propertyId }), ...(includeTrusted ? { includeTrusted } : {}), category, q, sort }),
    enabled: accountScope === true || !!propertyId,
    refetchOnMount: true,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === scopeKey && previousQuery?.queryKey[3] === (category ?? '') && previousQuery?.queryKey[6] === (includeTrusted === true) ? previous : undefined,
  });
}

export function useMarketplaceSupplier(orgId: string) {
  return useQuery({
    queryKey: ['suppliers', 'marketplace-supplier', 'account', orgId],
    queryFn: () => fetchMarketplaceSupplier(orgId),
    enabled: orgId !== '',
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

function refreshSupplierRequests(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
  void queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
  void queryClient.invalidateQueries({ queryKey: SUPPLIER_DASHBOARD_KEY });
}

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

export function useRequestServiceRequestPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requestServiceRequestPayment(id),
    onSuccess: () => {
      refreshSupplierRequests(queryClient);
      toast.success(i18n.t('supplier.requests.payment.remindedToast'));
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      if (isAxiosError(error) && getProblemCode(error.response?.data) === PAYMENT_REQUEST_TOO_SOON_CODE) {
        toast.info(getProblemMessage(error, i18n.t) ?? i18n.t('supplier.requests.payment.tooSoon'));
        return;
      }
      onSupplierActionError(queryClient, error);
    },
  });
}

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
      void queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('serviceRequest.actionFailed'));
    },
  });
}
