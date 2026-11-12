import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkInWizardApi } from '@/api/checkin-wizard.api';
import { BOOKINGS_KEY } from '@/queries/use-bookings';
import { retryTransientErrors } from '@/lib/query-client';
import type {
  CheckInConfirmation,
  CheckInWizardState,
  GuestExemption,
  SaveMunicipalityRateRequest,
  StayTouristTax,
  TouristTaxCollector,
} from '@/types/checkin-wizard.types';
import type { StayGuestSubmit } from '@/types/public-checkin.types';

const WIZARD_KEY = 'checkin-wizard';
const TOURIST_TAX_KEY = 'stay-tourist-tax';
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
 */
export function useSaveCheckInGuests(bookingId: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshAfterGuestsChange(bookingId);

  return useMutation({
    mutationFn: (guests: StayGuestSubmit[]) => checkInWizardApi.saveGuests(bookingId, guests),
    onSuccess: (state) => {
      queryClient.setQueryData<CheckInWizardState>([WIZARD_KEY, bookingId], state);
      refresh();
    },
  });
}

/**
 * Reads the photo of a document. The photo is held for the request only: the mutation is not kept after it (`gcTime: 0`, and the caller
 * resets it as soon as it has the answer), and nothing of it goes to a draft, a storage or a log.
 */
export function useReadCheckInDocument(bookingId: string) {
  return useMutation({
    mutationFn: ({ photo, fileName }: { photo: Blob; fileName: string }) => checkInWizardApi.readDocument(bookingId, photo, fileName),
    gcTime: 0,
  });
}

/** Confirms the wizard. 422 `checkin_not_ready` is shown by the caller (it goes back to the checks); other failures too. */
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

/** The tourist tax of the stay, guest by guest. Read again whenever the tax step opens. */
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

/** Writes the answer of a change of the tax (exemptions, collector, rate) in the caches that show it. */
function useApplyTax(bookingId: string) {
  const queryClient = useQueryClient();
  return (tax: StayTouristTax) => {
    queryClient.setQueryData<StayTouristTax>([TOURIST_TAX_KEY, bookingId], tax);
    queryClient.setQueryData<CheckInWizardState | undefined>([WIZARD_KEY, bookingId], (state) => (state ? { ...state, tax } : state));
  };
}

/** The exemptions the host chooses for the guests of the stay. */
export function useSetTouristTaxExemptions(bookingId: string) {
  const apply = useApplyTax(bookingId);

  return useMutation({
    mutationFn: (exemptions: GuestExemption[]) => checkInWizardApi.setExemptions(bookingId, exemptions),
    onSuccess: apply,
  });
}

/** Who collected the tax of a channel stay with no channel rule. */
export function useSetTouristTaxCollector(bookingId: string) {
  const apply = useApplyTax(bookingId);

  return useMutation({
    mutationFn: (collector: TouristTaxCollector | null) => checkInWizardApi.setCollector(bookingId, collector),
    onSuccess: apply,
  });
}

/** The comune of a property for its tourist tax and the rate the org declared for it. */
export function useMunicipalityRate(propertyId: string, enabled = true) {
  return useQuery({
    queryKey: [MUNICIPALITY_RATE_KEY, propertyId],
    queryFn: () => checkInWizardApi.getMunicipalityRate(propertyId),
    enabled: !!propertyId && enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** Declares the org's rate for the comune of the property: the tax of the stay is worked out again with it. */
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
