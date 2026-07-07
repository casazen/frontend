import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completeServiceRequest,
  createServiceRequest,
  fetchServiceRequest,
  fetchServiceRequests,
  fetchSuppliersByComune,
  fetchSuppliersByProperty,
  markServiceRequestPaid,
  matchSupplier,
  rejectServiceRequest,
  takeServiceRequest,
} from '@/api/service-requests.api';
import type { CreateServiceRequestDto, MatchSupplierDto } from '@/types/service-request';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

const SERVICE_REQUESTS_KEY = 'service-requests';

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

export function useMatchSupplier() {
  return useMutation({
    mutationFn: (payload: MatchSupplierDto) => matchSupplier(payload),
  });
}

export function useServiceRequest(id: string) {
  return useQuery({
    queryKey: [SERVICE_REQUESTS_KEY, id],
    queryFn: () => fetchServiceRequest(id),
    enabled: !!id,
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
    onError: () => toast.error(i18n.t('serviceRequest.createFailed')),
  });
}

export function useTakeServiceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => takeServiceRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      toast.success(i18n.t('serviceRequest.taken'));
    },
    onError: () => toast.error(i18n.t('serviceRequest.actionFailed')),
  });
}

export function useCompleteServiceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => completeServiceRequest(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      toast.success(i18n.t('serviceRequest.completed'));
    },
    onError: () => toast.error(i18n.t('serviceRequest.actionFailed')),
  });
}

export function useRejectServiceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectServiceRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_REQUESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      toast.success(i18n.t('serviceRequest.rejected'));
    },
    onError: () => toast.error(i18n.t('serviceRequest.actionFailed')),
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
    onError: () => toast.error(i18n.t('serviceRequest.actionFailed')),
  });
}
