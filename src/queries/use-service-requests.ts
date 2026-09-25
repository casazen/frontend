import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completeServiceRequest,
  createLongRentServiceRequest,
  createServiceRequest,
  fetchLongRentServiceRequests,
  fetchLongRentSuppliers,
  fetchServiceRequest,
  fetchServiceRequests,
  fetchSuppliersByComune,
  fetchSuppliersByProperty,
  markLongRentServiceRequestPaid,
  markServiceRequestPaid,
  rejectServiceRequest,
  takeServiceRequest,
} from '@/api/service-requests.api';
import type { CreateLongRentServiceRequestDto, CreateServiceRequestDto } from '@/types/service-request';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

const SERVICE_REQUESTS_KEY = 'service-requests';
/** Supplier dashboard KPIs (every period): a supplier transition changes them (SU-11). */
const SUPPLIER_KPIS_KEY = ['supplier', 'dashboard', 'kpis'];

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

export function useServiceRequest(id: string) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, id],
    queryFn: () => fetchServiceRequest(id),
    enabled: !!id,
  });
}

/** Long-rent requests (D2) of a property, or of every property in scope without `propertyId`. */
export function useLongRentServiceRequests(propertyId?: string) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, 'long-rent', propertyId ?? null],
    queryFn: () => fetchLongRentServiceRequests({ propertyId, pageSize: 50 }),
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

export function useSuppliersByComune(comune?: string, category?: string) {
  return useQuery({
    queryKey: ['suppliers', comune, category],
    queryFn: () => fetchSuppliersByComune(comune!, category),
    enabled: !!comune,
  });
}

export function useSuppliersByProperty(propertyId?: string, category?: string) {
  return useQuery({
    queryKey: ['suppliers', 'property', propertyId, category],
    queryFn: () => fetchSuppliersByProperty(propertyId!, category),
    enabled: !!propertyId,
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
      queryClient.invalidateQueries({ queryKey: SUPPLIER_KPIS_KEY });
      toast.success(i18n.t('serviceRequest.taken'));
    },
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('serviceRequest.actionFailed')),
  });
}

export function useCompleteServiceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => completeServiceRequest(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: SUPPLIER_KPIS_KEY });
      toast.success(i18n.t('serviceRequest.completed'));
    },
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('serviceRequest.actionFailed')),
  });
}

export function useRejectServiceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectServiceRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: SUPPLIER_KPIS_KEY });
      toast.success(i18n.t('serviceRequest.rejected'));
    },
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('serviceRequest.actionFailed')),
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
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('serviceRequest.actionFailed')),
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
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('serviceRequest.actionFailed')),
  });
}
