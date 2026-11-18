import axios from '@/lib/axios';
import { readPublicTouristTax, readTouristTaxPaymentIntent } from '@/features/checkin/lib/tourist-tax-model';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient, type ApiRequestOptions } from './client';
import type {
  AlloggiatiCodeEntryDto,
  AlloggiatiCodeList,
  BiometricConsentRequest,
  BiometricConsentResponse,
  CheckInDocumentReadResult,
  CheckInLegalTextsResponse,
  DocumentSide,
  DoorCheckInRequest,
  DoorCheckInResponse,
  DoorQr,
  IdentityDocumentResponse,
  IdentityOperatorResponse,
  IdentitySelfieResponse,
  PublicCheckInContextDto,
  PublicCheckInInvoiceRequest,
  PublicCheckInLanguageResponse,
  PublicCheckInSubmitRequest,
} from '@/types/public-checkin.types';

/**
 * The anonymous upload of a picture: `multipart/form-data` must be said, or the instance (JSON by default) turns the form into JSON and the API
 * gets no file. The browser adds the boundary.
 */
const PUBLIC_MULTIPART: ApiRequestOptions = { public: true, headers: { 'Content-Type': 'multipart/form-data' } };

export const publicCheckinApi = {
  requestInvoice: async (token: string, request: PublicCheckInInvoiceRequest) => {
    await axios.post(`/public/checkin/${token}/invoice`, request, { public: true });
  },
  /**
   * The context of the link: what the form starts from. For the invoice step (FIS-01) it carries two flags, `invoiceRequested` and
   * `hasInvoiceData`, and never the invoice data itself: that is write-only from this page, because the link is anonymous.
   */
  getContext: (token: string) =>
    ApiClient.get<PublicCheckInContextDto>(`/public/checkin/${token}`, undefined, { public: true }),

  /** Saves the language the guest chose on the page (`it`, `en`, `de`, `fr` or `es`); the page and the emails of the session use it. */
  setLanguage: (token: string, language: string) =>
    ApiClient.put<PublicCheckInLanguageResponse>(`/public/checkin/${token}/language`, { language }, { public: true }),

  /**
   * Sends the check-in. The optional `invoice` block («Ti serve la fattura?», FIS-01) is there only for a yes; the server saves it with the check-in
   * or, when its data is not valid, answers 422 `invoice_data_*` with the `field` (and the list of `errors`) and saves nothing.
   */
  submit: (token: string, data: PublicCheckInSubmitRequest) =>
    ApiClient.post<{ sessionId: string; message: string }>(`/public/checkin/${token}`, data, { public: true }),

  /** Official Alloggiati codes matching `q` (empty until an admin imports the tables). */
  searchCodes: (token: string, list: AlloggiatiCodeList, q: string) =>
    ApiClient.get<AlloggiatiCodeEntryDto[]>(`/public/checkin/${token}/codes`, { list, q }, { public: true }),

  /** Reads one identity-document photo. The photo is not stored. */
  readDocument: async (token: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    const response = await axios.post<CheckInDocumentReadResult>(`/public/checkin/${token}/read-document`, body, {
      public: true,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * The guest's answer to the biometric consent (E03/F04/US03/T01, ADR-013-R9): explicit, separate from the privacy notice, refusable. A refusal, or a
   * verification that is not offered, answers `result: operator`: a person verifies and the operators are told at once.
   */
  postBiometricConsent: (token: string, request: BiometricConsentRequest) =>
    ApiClient.post<BiometricConsentResponse>(`/public/checkin/${token}/biometric-consent`, request, { public: true }),

  /**
   * The legal texts of the identity step for the stay of the link (E22/F01/US02/T02): the consent to the face check and, for a property that keeps no document (Ticino), the notice, each with
   * the `version` the consent posts back and `isDraft` (a draft is served outside production only). `language` is the one of the page (`it`, `en`, `de`, `fr`, `es`); the server serves the closest
   * language it has and says which. 404 for a link that is not open. Behind the flag `checkInIdentityVerification`.
   */
  getLegalTexts: (token: string, language: string) =>
    ApiClient.get<CheckInLegalTextsResponse>(`/public/checkin/${token}/legal-texts`, { lang: language }, { public: true }),

  /**
   * The guest at the door of the property (E22/F01/US02/T01): the booking code (or the surname of the main guest) and the arrival date find the stay and answer the token of its check-in link.
   * The one answer for everything that does not open is the 404 `door_checkin_not_found`; 429 over five attempts a minute. The data is in the body, never in the address.
   */
  openDoor: (doorToken: string, request: DoorCheckInRequest) =>
    ApiClient.post<DoorCheckInResponse>(`/public/checkin/door/${encodeURIComponent(doorToken)}`, request, { public: true }),

  /**
   * The photo of the identity document of the guest who verifies: the answer carries the capture guidance (`acceptable`, `guidanceCodes`). The photo is
   * read in memory by the API; outside Ticino it is kept encrypted until the verification is over, in Ticino nothing is kept.
   *
   * A document of two sides (the Italian electronic identity card has the face on the front and the lines of letters on the back, E22/F01/US01/T02) is sent one side at a time with `side`
   * (`front`, then `back` when the answer asks for it with `document_back_needed`); a passport sent as `front` is complete with that one picture. Without `side` the call is what it always was
   * (`single`: one picture with the face and the lines of letters).
   */
  postDocument: (token: string, photo: Blob, side?: DocumentSide) => {
    const body = new FormData();
    body.append('document', photo, 'document.jpg');
    if (side) body.append('side', side);
    return ApiClient.post<IdentityDocumentResponse>(`/public/checkin/${token}/document`, body, PUBLIC_MULTIPART);
  },

  /**
   * The selfie of the guest who verifies (ADR-013-R1: compared in the request, ADR-013-R2: nothing of it is kept). For a property in Ticino the photo
   * of the document comes again with it (`documentPhoto`, and `documentPhotoBack` for a document of two sides). The answer is `ok` (with the lock code), `retry` or `operator`.
   */
  postSelfie: (token: string, selfie: Blob, documentPhoto?: Blob | null, documentPhotoBack?: Blob | null) => {
    const body = new FormData();
    body.append('selfie', selfie, 'selfie.jpg');
    if (documentPhoto) body.append('documentPhoto', documentPhoto, 'document.jpg');
    if (documentPhotoBack) body.append('documentPhotoBack', documentPhotoBack, 'document-back.jpg');
    return ApiClient.post<IdentitySelfieResponse>(`/public/checkin/${token}/selfie`, body, PUBLIC_MULTIPART);
  },

  /** The guest asks for a person, at any step, also after a retry or a failed attempt (GDPR art. 22, AC-NF51-11): the operators are told at once. */
  requestOperator: (token: string) =>
    ApiClient.post<IdentityOperatorResponse>(`/public/checkin/${token}/request-operator`, undefined, { public: true }),

  /**
   * The tourist tax of the stay of the link (E25/F01/US02/T01, NF-119): what the guest can pay online now, in the currency of the API, the tax guest by guest by position (no name,
   * never the reason of an exemption) and where the collection stands. Behind the flag `touristTaxOnlinePayment`: 404 while it is off or for a link that reaches no stay, 409
   * `tourist_tax_payment_not_available` while the organization does not offer the payment or its account does not take payments. An answer that is not the tax is an error, never a
   * tax of 0.
   */
  getTouristTax: async (token: string) => {
    const view = readPublicTouristTax(await ApiClient.get<unknown>(`/public/checkin/${token}/tourist-tax`, undefined, { public: true }));
    if (!view) throw new UnexpectedApiResponseError('/public/checkin/{token}/tourist-tax');
    return view;
  },

  /**
   * The PaymentIntent of what the guest can pay online now, on the organization's connected account (one per stay and amount: asking again for the same amount gives the same one):
   * the client secret, the platform's publishable key and the account the Payment Element is opened with, and the amount and the currency that will be charged. The payment is
   * recorded by the server from what the payment provider says, never by this call. 409 `tourist_tax_nothing_to_pay`, `tourist_tax_payment_in_progress` or
   * `tourist_tax_payment_not_available`.
   */
  createTouristTaxPaymentIntent: async (token: string) => {
    const intent = readTouristTaxPaymentIntent(
      await ApiClient.post<unknown>(`/public/checkin/${token}/tourist-tax/payment-intent`, undefined, { public: true }),
    );
    if (!intent) throw new UnexpectedApiResponseError('/public/checkin/{token}/tourist-tax/payment-intent');
    return intent;
  },
};

/**
 * The QR code of the door of a property, for the host (E22/F01/US02/T01): it leads the guest who arrives to `/checkin/porta/{doorToken}`. The token is made the first time it is asked and
 * is replaced by `rotate` («Rigenera»), after which the printed code stops working at once. `property.write` is needed (403 otherwise; 404 `property_not_found` for another org's property).
 * Behind the flag `checkInIdentityVerification` (404 while it is off). The answers hold the door token: private, never cached.
 */
export const propertyDoorQrApi = {
  get: (propertyId: string) => ApiClient.get<DoorQr>(`/properties/${encodeURIComponent(propertyId)}/door-qr`),

  rotate: (propertyId: string) => ApiClient.post<DoorQr>(`/properties/${encodeURIComponent(propertyId)}/door-qr/rotate`),
};
