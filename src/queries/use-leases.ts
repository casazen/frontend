import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leasesApi } from '@/api/leases.api';
import type { CreateLeaseDto, LeaseStatus } from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

const LEASES_KEY = 'leases';

export function useLeases(params?: { propertyId?: string; status?: string }) {
  return useQuery({
    queryKey: [LEASES_KEY, params],
    queryFn: () => leasesApi.getAll(params),
  });
}

export function useLease(id: string) {
  return useQuery({
    queryKey: [LEASES_KEY, id],
    queryFn: () => leasesApi.getById(id),
    enabled: !!id,
  });
}

const REGISTRATION_STATUSES: LeaseStatus[] = [
  'SentToProvider',
  'RegistrationPending',
  'Registered',
  'Rejected',
];

export function useLeaseRegistration(id: string, leaseStatus?: LeaseStatus) {
  const shouldFetch = !!leaseStatus && REGISTRATION_STATUSES.includes(leaseStatus);
  const shouldPoll =
    leaseStatus === 'SentToProvider' || leaseStatus === 'RegistrationPending';

  return useQuery({
    queryKey: [LEASES_KEY, id, 'registration'],
    queryFn: () => leasesApi.getRegistration(id),
    enabled: !!id && shouldFetch,
    refetchInterval: shouldPoll ? 30_000 : false,
    retry: false,
  });
}

export function useCreateLease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLeaseDto) => leasesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
      toast.success(i18n.t('toast.leaseDraftCreated'));
    },
    onError: () => {
      toast.error(i18n.t('toast.leaseCreateFailed'));
    },
  });
}

export function useInitiateSigning() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => leasesApi.initiateSigning(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY, id] });
      toast.success(i18n.t('toast.signingInitiated'));
    },
    onError: () => {
      toast.error(i18n.t('toast.signingInitiateFailed'));
    },
  });
}

export function useTriggerRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => leasesApi.triggerRegistration(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY, id] });
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY, id, 'registration'] });
      toast.success(i18n.t('toast.registrationSubmitted'));
    },
    onError: () => {
      toast.error(i18n.t('toast.registrationSubmitFailed'));
    },
  });
}
