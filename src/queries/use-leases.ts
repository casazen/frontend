import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leasesApi, type LeaseListParams } from '@/api/leases.api';
import type {
  CedolareAdvisoryInput,
  ManualRegistrationInput,
  OfflineSignatureInput,
  QuesturaCommunicationInput,
} from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { useHeldKeys } from '@/lib/hold-for-undo';
import { isRliRegistrationInProgress } from '@/lib/rli-registration-state';

export const LEASES_KEY = 'leases';

/** What a draft that waits to be deleted is held under (`holdForUndo`, LR-10): the same key keeps it out of every list meanwhile. */
export const leaseDraftDeleteKey = (leaseId: string) => `lease-draft-delete:${leaseId}`;

/**
 * The leases of the org, narrowed by the server (`view`, `q`, `propertyId`). `keepPrevious`: while another view or search
 * loads, the rows of the last one stay on the screen (the list of leases does this). `refetchOnMount`: a list that other
 * screens change (a lease created, registered or paid) has to ask again when it is opened (`'always'`: even if it is not stale).
 * `enabled`: not for who may not read leases (a 403 on a read sends the person to the page of no access).
 *
 * A draft that waits for the six seconds of «Annulla» before it is deleted is already out of the list (until then the server still
 * has it, and nobody should open it); «Annulla» brings it back, as nothing was done to it.
 */
export function useLeases(
  params?: LeaseListParams,
  options: { keepPrevious?: boolean; refetchOnMount?: boolean | 'always'; enabled?: boolean } = {},
) {
  const { keepPrevious = false, refetchOnMount, enabled } = options;
  const held = useHeldKeys();
  return useQuery({
    queryKey: [LEASES_KEY, params],
    queryFn: () => leasesApi.getAll(params),
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    refetchOnMount,
    enabled,
    select: held.size === 0 ? undefined : (rows) => rows.filter((row) => !held.has(leaseDraftDeleteKey(row.id))),
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

/**
 * The step a lease is waiting for (LR-03b): the `nextStep` of its row in the list of leases, which is the only place that has it until
 * the detail carries it too (LR-01b-FU1). It is the plain list the app already reads (`useLeases()` with no parameter: the same
 * request and the same cache as the guide and the list of leases), narrowed to one lease by `select`, so a lease costs no call of its
 * own. `null` when the list has no row for it or the row has no step.
 *
 * The step moves under the person's hands (a signature uploaded, a registration declared, a rent paid): the list is read again every
 * time a sheet opens (the client does not read a list again on its own) and by every action that changes a lease, which invalidates
 * `[LEASES_KEY]`. It does not retry: a sheet without its step is the sheet it always was, and waiting for the retries of a failing
 * list would hold the whole page back.
 */
export function useLeaseNextStep(id: string) {
  return useQuery({
    queryKey: [LEASES_KEY, undefined],
    queryFn: () => leasesApi.getAll(),
    select: (rows) => rows.find((row) => row.id === id)?.nextStep ?? null,
    refetchOnMount: 'always',
    retry: false,
    enabled: !!id,
  });
}

/**
 * Where the lease stands on its path (`stage`, LR-01b), read from the same row of the list as its next step: the same request and the
 * same cache as `useLeaseNextStep`, so the guide knows the stage when the sheet appears and costs no call of its own. The server decides
 * the stage; `undefined` when the list has no row for the lease or does not answer (the guide then falls back to the status).
 */
export function useLeaseListStage(id: string) {
  return useQuery({
    queryKey: [LEASES_KEY, undefined],
    queryFn: () => leasesApi.getAll(),
    select: (rows) => rows.find((row) => row.id === id)?.stage,
    refetchOnMount: 'always',
    retry: false,
    enabled: !!id,
  });
}

/**
 * The draft of a canone concordato contract, which is prepared with the partner (ConcordatoFacile) — «Parto da zero» (E01/F02/US01,
 * CF-IMPORT): a real draft with only its property (`POST /leases/drafts/concordatofacile`, no APE, parties, dates or rent), an imported
 * draft marked as the partner's, typed as a concordato by the server. Resolves with it: its `id` is the leaseId the partner links its
 * practice to. The server makes one per property, so a retry or a second visit for the same property gets the draft already made and
 * never a second contract; a new contract on the same property comes once this one is imported.
 */
export function useCreateCfDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (propertyId: string) => leasesApi.createCfDraft(propertyId),
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

/**
 * Tax advisory of the lease (LT-08), recomputed with the data the landlord enters; the previous result stays shown meanwhile.
 * `enabled: false` for a lease the comparison means nothing for yet (a draft with no rent).
 */
export function useRliAdvisory(id: string, input?: CedolareAdvisoryInput, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [LEASES_KEY, id, 'rli', 'advisory', input ?? null],
    queryFn: () => leasesApi.getRliAdvisory(id, input),
    enabled: !!id && (options.enabled ?? true),
    placeholderData: keepPreviousData,
  });
}

/** `enabled: false`: not read (the list of the files of a lease asks it only for a lease with an extra-EU tenant, the only one with a Questura receipt). */
export function useRliChecklist(id: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [LEASES_KEY, id, 'rli', 'checklist'],
    queryFn: () => leasesApi.getRliChecklist(id),
    enabled: !!id && (options.enabled ?? true),
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

/** LT-07: delivery date of the property, from which the 48 hours of the Questura communication count. */
export function useDeclareQuesturaDeliveryDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, deliveryDate }: { id: string; deliveryDate: string | null }) =>
      leasesApi.declareQuesturaDeliveryDate(id, deliveryDate),
    onSuccess: () => {
      // The whole family, not only this lease: its row in the list is where the next step is read (`useLeaseNextStep`).
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
      toast.success(i18n.t('toast.questuraDeliveryDateSaved'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.questuraDeliveryDateFailed'));
    },
  });
}

/** LT-07: the landlord declares the Questura communication (date and optional receipt): only this ticks the item. */
export function useMarkQuesturaCommunicationDone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: QuesturaCommunicationInput }) =>
      leasesApi.markQuesturaCommunicationDone(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
      toast.success(i18n.t('toast.questuraMarkedDone'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.questuraMarkDoneFailed'));
    },
  });
}
