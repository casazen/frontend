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
  IdentityOpenRequest,
  IdentityOpenResponse,
  IdentityOperatorResponse,
  IdentityPresenceResponse,
  IdentitySelfieResponse,
  PresenceChallenge,
  PresenceSequence,
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

/** How long the upload of the sequence of the presence is given: the frames of a recording are a few megabytes, and a phone on a mobile network sends slowly. */
const PRESENCE_UPLOAD_TIMEOUT_MS = 45_000;

export interface SelfiePose { turnedSelfie: Blob; challengeToken: string }

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

  /**
   * Reads one identity-document photo. The photo is not stored. With the self-hosted flow on (E71/F01/US03/T01, NF-190) the answer also carries `fields` (the values read by zone, each with its side, zone,
   * confidence and source), `missing` (the fields the guest has still to type) and `source: "local"`; with it off none of the three is in the answer. The values go only to the guest who sent the photo:
   * the caller keeps them in memory for the step and nowhere else.
   */
  readDocument: async (token: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    const response = await axios.post<CheckInDocumentReadResult>(`/public/checkin/${token}/read-document`, body, {
      public: true,
      // The vision provider, MRZ and printed-field readers each have a separate deadline.
      timeout: 60_000,
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
   * The opening of the identity step of the self-hosted verification (E70/F02/US01/T01, NF-188): `noticeVersion` is the version of the text of the consent the page shows, as `getLegalTexts` served it. The server
   * records the opening once (the time, the version and the browser family), binds the verification to the guest who verifies and answers `{ state }`; later calls change nothing, so the page may repeat it.
   * 422 `notice_version_unknown` when the version is not the one in force (nothing is recorded), 409 `identity_already_closed` (with the state in the body) when the verification is over, 404 for a link that is
   * not open or while the flags are off. Only for a state that says `selfHosted`.
   */
  openIdentity: (token: string, noticeVersion: string) => {
    const request: IdentityOpenRequest = { noticeVersion };
    return ApiClient.post<IdentityOpenResponse>(`/public/checkin/${token}/identity/open`, request, { public: true });
  },

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
  startSelfieChallenge: (token: string) =>
    ApiClient.post<{ challengeToken: string; noseToRight: boolean; expiresAt: string }>(
      `/public/checkin/${token}/selfie-challenge`, undefined, { public: true }),

  postSelfie: (token: string, selfie: Blob, documentPhoto?: Blob | null, documentPhotoBack?: Blob | null, pose?: SelfiePose) => {
    const body = new FormData();
    body.append('selfie', selfie, 'selfie.jpg');
    if (pose) {
      body.append('turnedSelfie', pose.turnedSelfie, 'turned.jpg');
      body.append('challengeToken', pose.challengeToken);
    }
    if (documentPhoto) body.append('documentPhoto', documentPhoto, 'document.jpg');
    if (documentPhotoBack) body.append('documentPhotoBack', documentPhotoBack, 'document-back.jpg');
    return ApiClient.post<IdentitySelfieResponse>(`/public/checkin/${token}/selfie`, body, PUBLIC_MULTIPART);
  },

  /**
   * The challenge of the presence of a self-hosted verification (E72/F02/US01/T01, NF-192), which takes the place of `startSelfieChallenge`: the moves to follow and for how long, when it expires and how the frames
   * are to be taken. A challenge is consumed only by the server, when it closes the verification, so asking for another one is always fine. 409 `presence_challenge_unavailable` (the automatic check cannot be done
   * for this session: a person verifies, and the state in the body says why) and 409 `identity_already_closed` (the verification is over; unlike the one of the other steps this 409 carries NO state in the body, so the
   * caller reads the state of the link, `getContext`, to know how it ended). Never cached: it is private to the attempt.
   */
  startPresenceChallenge: (token: string) =>
    ApiClient.post<PresenceChallenge>(`/public/checkin/${token}/presence-challenge`, undefined, { public: true }),

  /**
   * The sequence of frames of the presence (E72/F02/US01/T01, NF-192, ADR-013-R11): the JPEG frames as `frames` parts in order, `timestamps` (a JSON array of whole numbers of milliseconds, the first 0) and the `challengeToken`
   * they answer; for a property that keeps no document (Ticino) the picture(s) of the document come again as `documentPhoto` and `documentPhotoBack`, as with the legacy selfie. `idempotencyKey` (8-64 of letters, digits and
   * hyphens) is made once for each recording and goes in the `Idempotency-Key` header: a request that reached the server and is sent again with the same key gets the stored answer, so a repeat never decides twice.
   * 400 `idempotency_key_required`; 409 `presence_challenge_required`, `presence_challenge_expired`, `identity_already_closed` (with the state); 413 `presence_sequence_too_large`; 422 `presence_sequence_invalid`.
   * The sequence of a phone on a slow network is a few megabytes, so the call waits longer than the default. `signal` is the guest stopping the upload (E72/F02/US01/T02): the request that is on its way is cancelled with it.
   */
  postPresence: (token: string, sequence: PresenceSequence, idempotencyKey: string, signal?: AbortSignal) => {
    const body = new FormData();
    sequence.frames.forEach((frame, index) => body.append('frames', frame, `frame-${index}.jpg`));
    body.append('timestamps', JSON.stringify(sequence.timestamps));
    body.append('challengeToken', sequence.challengeToken);
    if (sequence.documentPhoto) body.append('documentPhoto', sequence.documentPhoto, 'document.jpg');
    if (sequence.documentPhotoBack) body.append('documentPhotoBack', sequence.documentPhotoBack, 'document-back.jpg');
    return ApiClient.post<IdentityPresenceResponse>(`/public/checkin/${token}/presence`, body, {
      public: true,
      timeout: PRESENCE_UPLOAD_TIMEOUT_MS,
      headers: { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': idempotencyKey },
      ...(signal ? { signal } : {}),
    });
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
 *
 * The read keeps a 403 on its page (`localAuthRecovery`): the page tells that the permission is missing, as it does for the people the permission of the context already leaves out, instead of
 * the app opening «no access» for a read of a property the person may see but not write (a collaborator «Solo alcuni» without it).
 */
export const propertyDoorQrApi = {
  get: (propertyId: string) => ApiClient.get<DoorQr>(`/properties/${encodeURIComponent(propertyId)}/door-qr`, undefined, { localAuthRecovery: true }),

  rotate: (propertyId: string) => ApiClient.post<DoorQr>(`/properties/${encodeURIComponent(propertyId)}/door-qr/rotate`),
};
