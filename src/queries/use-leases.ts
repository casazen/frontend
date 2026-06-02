import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leasesApi } from '@/api/leases.api';
import type { CreateLeaseDto, LeaseStatus } from '@/types';
import { toast } from 'sonner';

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
      toast.success('Lease draft created successfully');
    },
    onError: () => {
      toast.error('Unable to create lease. Check property documents and try again.');
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
      toast.success('Signing initiated — share the links with each party');
    },
    onError: () => {
      toast.error('Signing cannot be initiated for this lease.');
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
      toast.success('Registration submitted to provider');
    },
    onError: () => {
      toast.error('Unable to submit registration. Please try again.');
    },
  });
}
