import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leasesApi } from '@/api/leases.api';
import type {
  CedolareAdvisoryInput,
  CreateLeaseDto,
  ManualRegistrationInput,
  OfflineSignatureInput,
} from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { isRliRegistrationInProgress } from '@/lib/rli-registration-state';

const LEASES_KEY = 'leases';

export function useLeases(params?: { propertyId?: string; status?: string }) {
  return useQuery({
    queryKey: [LEASES_KEY, params],
    queryFn: () => leasesApi.getAll(params),
  });
}

/**
 * Lease detail (with its registration). While a provider works on the RLI registration the detail is polled, so the
 * outcome (registered or failed) shows up without a reload.
 */
export function useLease(id: string) {
  return useQuery({
    queryKey: [LEASES_KEY, id],
    queryFn: () => leasesApi.getById(id),
    enabled: !!id,
    refetchInterval: (query) => (isRliRegistrationInProgress(query.state.data?.status) ? 30_000 : false),
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
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.leaseCreateFailed'));
    },
  });
}

/** LT-02: the signature panel (persisted signers, provider availability, final contract availability). */
export function useLeaseSigning(id: string) {
  return useQuery({
    queryKey: [LEASES_KEY, id, 'signing'],
    queryFn: () => leasesApi.getSigningState(id),
    enabled: !!id,
  });
}

/** Provider path only: the API sends the contract to the e-signature provider and returns the signing links. */
export function useInitiateSigning() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => leasesApi.initiateSigning(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY, id] });
      // Links created, nothing signed yet: the toast says so.
      toast.success(i18n.t('toast.signingLinksCreated'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.signingInitiateFailed'));
    },
  });
}

/** LT-02 offline signature: upload of the contract signed by every party with the stipula date. */
export function useDeclareOfflineSignature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: OfflineSignatureInput }) =>
      leasesApi.declareOfflineSignature(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY, id] });
      toast.success(i18n.t('toast.offlineSignatureSaved'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.offlineSignatureFailed'));
    },
  });
}

/** LT-02: stipula date of a lease signed before CasaZen recorded it. */
export function useDeclareStipula() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, stipulaDate }: { id: string; stipulaDate: string }) =>
      leasesApi.declareStipula(id, stipulaDate),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY, id] });
      toast.success(i18n.t('toast.stipulaDeclared'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.stipulaDeclareFailed'));
    },
  });
}

export function useTriggerRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      tosVersion,
      attestationAccepted,
    }: {
      id: string;
      tosVersion: string;
      attestationAccepted: boolean;
    }) => leasesApi.triggerRegistration(id, { tosVersion, attestationAccepted }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY, id] });
      // Sent to the provider is not registered: the toast says so (A7-01).
      toast.success(i18n.t('toast.registrationSubmitted'));
    },
    onError: (error, { id }) => {
      // A provider failure is recorded by the server (registration failed, lease signed): show the new state.
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY, id] });
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.registrationSubmitFailed'));
    },
  });
}

/** LT-01: manual registration (number or protocol, date and receipt PDF declared by the landlord). */
export function useDeclareManualRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ManualRegistrationInput }) =>
      leasesApi.declareManualRegistration(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY, id] });
      toast.success(i18n.t('toast.manualRegistrationSaved'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.manualRegistrationFailed'));
    },
  });
}

/** Tax advisory of the lease (LT-08), recomputed with the data the landlord enters; the previous result stays shown meanwhile. */
export function useRliAdvisory(id: string, input?: CedolareAdvisoryInput) {
  return useQuery({
    queryKey: [LEASES_KEY, id, 'rli', 'advisory', input ?? null],
    queryFn: () => leasesApi.getRliAdvisory(id, input),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
}

export function useRliChecklist(id: string) {
  return useQuery({
    queryKey: [LEASES_KEY, id, 'rli', 'checklist'],
    queryFn: () => leasesApi.getRliChecklist(id),
    enabled: !!id,
  });
}

export function useExportRli() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => leasesApi.exportRli(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY, id, 'rli'] });
    },
  });
}
