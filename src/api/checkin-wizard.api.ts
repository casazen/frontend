import { ApiClient } from './client';
import type {
  CheckInConfirmation,
  CheckInWizardState,
  DocumentReading,
  GuestExemption,
  MunicipalityRate,
  NoShowResult,
  SaveMunicipalityRateRequest,
  StayTouristTax,
  TouristTaxCollection,
  TouristTaxCollector,
} from '@/types/checkin-wizard.types';
import type { StayGuestSubmit } from '@/types/public-checkin.types';

export const checkInWizardApi = {
  /** Everything the six steps show: the guests (document numbers masked), the issues, the tax, the sender, Octorate and Alloggiati. */
  getState: (bookingId: string) => ApiClient.get<CheckInWizardState>(`/bookings/${bookingId}/checkin-wizard`),

  saveGuests: (bookingId: string, guests: StayGuestSubmit[], vehiclePlate?: string) =>
    ApiClient.put<CheckInWizardState>(
      `/bookings/${bookingId}/checkin-wizard/guests`,
      vehiclePlate === undefined ? { guests } : { guests, vehiclePlate },
    ),

  readDocument: (bookingId: string, photo: Blob, fileName: string) => {
    const body = new FormData();
    body.append('document', photo, fileName);
    return ApiClient.post<DocumentReading>(`/bookings/${bookingId}/checkin-wizard/document-reading`, body);
  },

  /** Confirms the wizard: 422 `checkin_not_ready` with the blocking issues, otherwise the tax is saved when calculable and the guests go to Octorate. */
  confirm: (bookingId: string) => ApiClient.post<CheckInConfirmation>(`/bookings/${bookingId}/checkin-wizard/confirm`),

  markNoShow: (bookingId: string) => ApiClient.post<NoShowResult>(`/bookings/${bookingId}/no-show`),

  getTouristTax: (bookingId: string) => ApiClient.get<StayTouristTax>(`/bookings/${bookingId}/tourist-tax`),

  recordTouristTaxPaidAtProperty: (bookingId: string) =>
    ApiClient.post<TouristTaxCollection>(`/bookings/${bookingId}/tourist-tax/paid-at-property`),

  setExemptions: (bookingId: string, exemptions: GuestExemption[]) =>
    ApiClient.put<StayTouristTax>(`/bookings/${bookingId}/tourist-tax/exemptions`, { exemptions }),

  setCollector: (bookingId: string, collector: TouristTaxCollector | null) =>
    ApiClient.put<StayTouristTax>(`/bookings/${bookingId}/tourist-tax/collector`, { collector }),

  getMunicipalityRate: (propertyId: string) => ApiClient.get<MunicipalityRate>(`/properties/${propertyId}/tourist-tax-rate`),

  saveMunicipalityRate: (propertyId: string, rate: SaveMunicipalityRateRequest) =>
    ApiClient.put<MunicipalityRate>(`/properties/${propertyId}/tourist-tax-rate`, rate),
};
