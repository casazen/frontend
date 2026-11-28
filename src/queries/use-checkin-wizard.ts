import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkInWizardApi } from '@/api/checkin-wizard.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { BOOKINGS_KEY } from '@/queries/use-bookings';
import { retryTransientErrors } from '@/lib/query-client';
import type {
  CheckInConfirmation,
  CheckInWizardState,
  GuestExemption,
  GuestsSave,
  SaveMunicipalityRateRequest,
  StayTouristTax,
  TouristTaxCollector,
} from '@/types/checkin-wizard.types';
import type { StayGuestSubmit } from '@/types/public-checkin.types';

const WIZARD_KEY = 'checkin-wizard';
export const TOURIST_TAX_KEY = 'stay-tourist-tax';
const MUNICIPALITY_RATE_KEY = 'municipality-tourist-tax-rate';

/**
 * The state of the wizard of a booking. It is read again every time the wizard opens (the guest may have completed the check-in since)
 * and is not kept once the wizard closes: it holds the data of the guests, and the form of the wizard is built from it once. A part of
 * the wizard that mounts while the state is already on screen asks `refetchOnMount: false`, so that it shares what is there instead of
 * asking the server again each time its step opens.
 */
export function useCheckInWizardState(bookingId: string, enabled = true, refetchOnMount: 'always' | false = 'always') {
  return useQuery({
    queryKey: [WIZARD_KEY, bookingId],
    queryFn: () => checkInWizardApi.getState(bookingId),
    enabled: !!bookingId && enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount,
    retry: retryTransientErrors(1),
  });
}

/** What changes when the guests of the stay change: the tax, the Alloggiati summary and status, the cockpit, the booking. */
function useRefreshAfterGuestsChange(bookingId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [TOURIST_TAX_KEY, bookingId] });
    void queryClient.invalidateQueries({ queryKey: ['alloggiati'] });
    void queryClient.invalidateQueries({ queryKey: ['compliance'] });
    void queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY, bookingId] });
  };
}

/**
 * Saves the guests of the stay as the host (the list is the whole truth). Field errors (400, keyed `Guests[i].Field`) are shown by the
 * caller on the fields; nothing is toasted here.
 *
 * What it is given is the personal data of the guests (names, birth, documents): the mutation is dropped as soon as nothing observes it
 * (`gcTime: 0`, not five minutes in the cache of the mutations) and a refusal is kept without the request that was sent (`withoutRequest`: the
 * status and the body of the answer stay, which is what the form turns into words on the fields).
 */
export function useSaveCheckInGuests(bookingId: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshAfterGuestsChange(bookingId);

  return useMutation({
    gcTime: 0,
    mutationFn: async (save: StayGuestSubmit[] | GuestsSave) => {
      const { guests, vehiclePlate } = Array.isArray(save) ? { guests: save, vehiclePlate: undefined } : save;
      try {
        return await (vehiclePlate === undefined
          ? checkInWizardApi.saveGuests(bookingId, guests)
          : checkInWizardApi.saveGuests(bookingId, guests, vehiclePlate));
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (state) => {
      queryClient.setQueryData<CheckInWizardState>([WIZARD_KEY, bookingId], state);
      refresh();
    },
  });
}

export function useReadCheckInDocument(bookingId: string) {
  return useMutation({
    mutationFn: ({ photo, fileName }: { photo: Blob; fileName: string }) => checkInWizardApi.readDocument(bookingId, photo, fileName),
    gcTime: 0,
  });
}

export function useConfirmCheckIn(bookingId: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshAfterGuestsChange(bookingId);

  return useMutation({
    mutationFn: () => checkInWizardApi.confirm(bookingId),
    onSuccess: (confirmation: CheckInConfirmation) => {
      queryClient.setQueryData<CheckInWizardState>([WIZARD_KEY, bookingId], confirmation.state);
      refresh();
    },
  });
}

/** The guests never came. The booking changes (the no-show mark), and so do the Alloggiati status and the cockpit. */
export function useMarkNoShow(bookingId: string) {
  const refresh = useRefreshAfterGuestsChange(bookingId);

  return useMutation({
    mutationFn: () => checkInWizardApi.markNoShow(bookingId),
    onSuccess: refresh,
  });
}

export function useStayTouristTax(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: [TOURIST_TAX_KEY, bookingId],
    queryFn: () => checkInWizardApi.getTouristTax(bookingId),
    enabled: !!bookingId && enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: retryTransientErrors(1),
  });
}

function useApplyTax(bookingId: string) {
  const queryClient = useQueryClient();
  return (tax: StayTouristTax) => {
    const key = [TOURIST_TAX_KEY, bookingId];
    const collection = tax.collection ?? queryClient.getQueryData<StayTouristTax>(key)?.collection;
    queryClient.setQueryData<StayTouristTax>(key, collection ? { ...tax, collection } : tax);
    queryClient.setQueryData<CheckInWizardState | undefined>([WIZARD_KEY, bookingId], (state) => (state ? { ...state, tax } : state));
    if (collection) void queryClient.invalidateQueries({ queryKey: key });
  };
}

export function useSetTouristTaxExemptions(bookingId: string) {
  const apply = useApplyTax(bookingId);

  return useMutation({
    mutationFn: (exemptions: GuestExemption[]) => checkInWizardApi.setExemptions(bookingId, exemptions),
    onSuccess: apply,
  });
}

export function useSetTouristTaxCollector(bookingId: string) {
  const apply = useApplyTax(bookingId);

  return useMutation({
    mutationFn: (collector: TouristTaxCollector | null) => checkInWizardApi.setCollector(bookingId, collector),
    onSuccess: apply,
  });
}

export function useRecordTouristTaxPaidAtProperty(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => checkInWizardApi.recordTouristTaxPaidAtProperty(bookingId),
    onSuccess: (collection) => {
      queryClient.setQueryData<StayTouristTax>([TOURIST_TAX_KEY, bookingId], (tax) => (tax ? { ...tax, collection } : tax));
      void queryClient.invalidateQueries({ queryKey: [TOURIST_TAX_KEY, bookingId] });
    },
  });
}

export function useMunicipalityRate(propertyId: string, enabled = true) {
  return useQuery({
    queryKey: [MUNICIPALITY_RATE_KEY, propertyId],
    queryFn: () => checkInWizardApi.getMunicipalityRate(propertyId),
    enabled: !!propertyId && enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useSaveMunicipalityRate(bookingId: string, propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rate: SaveMunicipalityRateRequest) => checkInWizardApi.saveMunicipalityRate(propertyId, rate),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [MUNICIPALITY_RATE_KEY, propertyId] });
      void queryClient.invalidateQueries({ queryKey: [TOURIST_TAX_KEY, bookingId] });
      void queryClient.invalidateQueries({ queryKey: [WIZARD_KEY, bookingId] });
    },
  });
}
