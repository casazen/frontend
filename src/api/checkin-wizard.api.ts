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
  TouristTaxCollector,
} from '@/types/checkin-wizard.types';
import type { StayGuestSubmit } from '@/types/public-checkin.types';

/** The host wizard "Guest check-in" of a booking and the tourist tax of the stay (backend `CheckInWizardController`, `StayTouristTaxController`). */
export const checkInWizardApi = {
  /** Everything the six steps show: the guests (document numbers masked), the issues, the tax, the sender, Octorate and Alloggiati. */
  getState: (bookingId: string) => ApiClient.get<CheckInWizardState>(`/bookings/${bookingId}/checkin-wizard`),

  /** Replaces the guests of the stay with the host as author: the list is the whole truth (the exemption codes included). Answers the new state. */
  saveGuests: (bookingId: string, guests: StayGuestSubmit[]) =>
    ApiClient.put<CheckInWizardState>(`/bookings/${bookingId}/checkin-wizard/guests`, { guests }),

  /** Reads the photo of a document (JPEG or PNG, 10 MB at most): in memory on the server, never stored. */
  readDocument: (bookingId: string, photo: Blob, fileName: string) => {
    const body = new FormData();
    body.append('document', photo, fileName);
    return ApiClient.post<DocumentReading>(`/bookings/${bookingId}/checkin-wizard/document-reading`, body);
  },

  /** Confirms the wizard: 422 `checkin_not_ready` with the blocking issues, otherwise the tax is saved when calculable and the guests go to Octorate. */
  confirm: (bookingId: string) => ApiClient.post<CheckInConfirmation>(`/bookings/${bookingId}/checkin-wizard/confirm`),

  /** The guests never came: a confirmed booking from its check-in day. */
  markNoShow: (bookingId: string) => ApiClient.post<NoShowResult>(`/bookings/${bookingId}/no-show`),

  getTouristTax: (bookingId: string) => ApiClient.get<StayTouristTax>(`/bookings/${bookingId}/tourist-tax`),

  /** The exemptions the host chooses for the guests (a null code clears one). */
  setExemptions: (bookingId: string, exemptions: GuestExemption[]) =>
    ApiClient.put<StayTouristTax>(`/bookings/${bookingId}/tourist-tax/exemptions`, { exemptions }),

  /** Who collected the tax of a channel stay whose comune has no channel rule. */
  setCollector: (bookingId: string, collector: TouristTaxCollector | null) =>
    ApiClient.put<StayTouristTax>(`/bookings/${bookingId}/tourist-tax/collector`, { collector }),

  getMunicipalityRate: (propertyId: string) => ApiClient.get<MunicipalityRate>(`/properties/${propertyId}/tourist-tax-rate`),

  /** Declares the org's rate for the comune of the property (private to the org). */
  saveMunicipalityRate: (propertyId: string, rate: SaveMunicipalityRateRequest) =>
    ApiClient.put<MunicipalityRate>(`/properties/${propertyId}/tourist-tax-rate`, rate),
};
