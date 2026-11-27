import type { InvoiceDataText, InvoiceRecipientKind } from './invoice-data.types';

export type GuestCheckInSessionStatus =
  | 'Inviato'
  | 'InCompilazione'
  | 'Completo'
  | 'AlloggiatiInviato'
  | 'Scaduto';

export type GuestGender = 'Male' | 'Female' | 'Other';

/**
 * Genders a guest can submit: Alloggiati Web accepts only 1 = male and 2 = female
 * (tracciato record, field "Sesso"), so the API rejects `Other` on the public portal.
 */
export type AlloggiatiGender = Extract<GuestGender, 'Male' | 'Female'>;

/**
 * Kind of guest ("tipo alloggiato"): the five official categories of Alloggiati Web (RS-1). Values of the API enum
 * `StayGuestType`, never the table codes.
 */
export type StayGuestType = 'SingleGuest' | 'HeadOfFamily' | 'HeadOfGroup' | 'FamilyMember' | 'GroupMember';

export type AlloggiatiCodeTable = 'Comuni' | 'Stati' | 'Documenti' | 'TipiAlloggiato';

export type AlloggiatiCodeList = 'comuni' | 'stati' | 'documenti' | 'luoghi';

/** Document kinds offered when the official document table is not imported (`Other` has no Alloggiati value). */
export type AlloggiatiDocumentKind = 'Passport' | 'IdentityCard' | 'DriversLicense';

export interface PublicCheckInGuestPrefill {
  type: StayGuestType;
  firstName: string;
  lastName: string;
  gender?: GuestGender | null;
  dateOfBirth?: string | null;
  bornInItaly?: boolean | null;
  birthComuneCode?: string | null;
  birthComuneName: string;
  birthProvince?: string | null;
  birthCountryCode?: string | null;
  birthCountryName: string;
  citizenshipCode?: string | null;
  citizenshipName: string;
  documentType?: string | null;
  documentTypeCode?: string | null;
  documentNumberMasked?: string | null;
  documentIssuePlaceCode?: string | null;
  documentIssuePlaceName: string;
  documentIssuedOn?: string | null;
  documentExpiresOn?: string | null;
  residenceInItaly?: boolean | null;
  residenceComuneCode?: string | null;
  residenceComuneName?: string | null;
  residenceProvince?: string | null;
  residenceCountryCode?: string | null;
  residenceCountryName?: string | null;
  /**
   * The home of the guest (NF-132, E30/F01/US02): street and house number, postal code, town; null when not on file. Given back with the
   * guest so that a page that sends the guests whole does not clear them: the server takes the list as the whole truth.
   */
  residenceStreet?: string | null;
  residencePostalCode?: string | null;
  residenceCityName?: string | null;
  tourismType?: string | null;
  travelWay?: string | null;
  educationLevel?: string | null;
}

export interface PublicCheckInContextDto {
  houseRules?: string | null;
  houseRulesVersion?: string | null;
  completed: boolean;
  status: GuestCheckInSessionStatus;
  sessionId?: string;
  propertyName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  declaredGuests?: number;
  guests?: PublicCheckInGuestPrefill[];
  availableCodeTables?: AlloggiatiCodeTable[];
  /** Version of the privacy notice shown (art. 13 GDPR); absent when not configured. */
  privacyNoticeVersion?: string;
  privacyNoticeOrgSlug?: string;
  /**
   * Slug of the agency the link belongs to (NF-140): sent for every usable link, whether or not the agency has a published privacy notice. The check-in page of an agency's own domain is
   * shown only for the agency of that domain. Optional so that an answer of a backend that does not send it yet still types; the guard then reads `privacyNoticeOrgSlug`.
   */
  orgSlug?: string;
  marketingConsentVersion?: string;
  requiredGuestFields?: string[];
  askVehiclePlate?: boolean;
  language?: string;
  supportedLanguages?: string[];
  /**
   * The answer to «Ti serve la fattura?» is already yes (FIS-01, E06/F02/US01/T03): the step starts with the question answered. Open session only.
   * The invoice data itself is write-only from this page (the link is anonymous): the page never receives a fiscal code, a VAT number, an address or
   * a PEC, only this flag and `hasInvoiceData`.
   */
  invoiceRequested?: boolean;
  hasInvoiceData?: boolean;
  documentNotArchived?: boolean;
  identityVerification?: IdentityVerificationState;
}

export interface PublicCheckInLanguageResponse {
  language: string;
}

/**
 * One guest of `POST /public/checkin/{token}` and `PUT /alloggiati/{bookingId}/stay-guests` (API DTO
 * `StayGuestSubmitDto`). Every key is always sent (null or empty when not applicable), so the payload is stable.
 */
export interface StayGuestSubmit {
  type: StayGuestType;
  firstName: string;
  lastName: string;
  gender: AlloggiatiGender;
  dateOfBirth: string;
  bornInItaly: boolean;
  birthComuneName: string;
  birthComuneCode: string | null;
  birthProvince: string | null;
  birthCountryName: string;
  birthCountryCode: string | null;
  citizenshipName: string;
  citizenshipCode: string | null;
  documentType: string | null;
  documentTypeCode: string | null;
  documentNumber: string | null;
  documentIssuePlaceName: string | null;
  documentIssuePlaceCode: string | null;
  documentIssuedOn?: string | null;
  documentExpiresOn?: string | null;
  residenceInItaly?: boolean | null;
  residenceComuneName?: string | null;
  residenceComuneCode?: string | null;
  residenceProvince?: string | null;
  residenceCountryName?: string | null;
  residenceCountryCode?: string | null;
  /**
   * The home of the guest (NF-132): street and house number, postal code, town. Present only where the regime asks them (`requiredGuestFields`)
   * or, on the host's entries, where the host holds a value, so that a save never erases it: the server takes the list as the whole truth.
   * `null` is an empty field the guest left blank. Absent on every Italian request.
   */
  residenceStreet?: string | null;
  residencePostalCode?: string | null;
  residenceCityName?: string | null;
  /** Statistical fields (NF-40): present only when the region requires them (absent otherwise, never sent empty). */
  tourismType?: string | null;
  travelWay?: string | null;
  educationLevel?: string | null;
  taxExemptionCode?: string | null;
}

/**
 * The «Ti serve la fattura?» block of the check-in (API DTO `PublicCheckInInvoiceDto`, FIS-01, E06/F02/US01/T03): sent only for a «yes». Everything
 * but `needInvoice` is optional and write-only, a text the guest left empty is not sent, and the server checks the formats as a whole (422
 * `invoice_data_*` with the `field`, nothing saved, the check-in included). The kind of recipient and the country go with the texts, never
 * alone: a block with only a kind would ask for an identification the guest was not asked for.
 */
export interface PublicCheckInInvoiceRequest extends InvoiceDataText {
  needInvoice: boolean;
  recipientKind?: InvoiceRecipientKind;
}

/**
 * Body of `POST /public/checkin/{token}` (API DTO `PublicCheckInSubmitRequest`). No consent for the Alloggiati
 * registration (legal obligation, CO-15): only the optional marketing consent, offered when the context has its version.
 * NF-05 adds per-channel consent with a separate marketing email.
 */
export interface PublicCheckInSubmitRequest {
  houseRulesVersion?: string;
  privacyNoticeAcknowledged?: boolean;
  guests: StayGuestSubmit[];
  marketingConsentEmail: boolean;
  marketingConsentWhatsApp: boolean;
  marketingEmail?: string | null;
  /**
   * The optional answer to «Ti serve la fattura?» (FIS-01): present only when the guest said yes. A guest who skips the step, or says no, sends no
   * block at all, and the check-in is never blocked by it.
   */
  invoice?: PublicCheckInInvoiceRequest;
  vehiclePlate?: string;
}

export interface AlloggiatiCodeEntryDto {
  table: AlloggiatiCodeTable;
  code: string;
  description: string;
  province?: string | null;
  citizenshipLabel?: string | null;
}

/**
 * One value the zones of the card gave (`fields` of `read-document`, E71/F01/US03/T01, NF-190): what it is, the value, the side of the document it was read on, the zone of the format it came from and how far
 * it is trusted. Personal data that goes to the guest who sent the photo and nowhere else: the page holds it in memory for the length of the step, never in a storage, an address or a log.
 */
export interface CheckInZonedField {
  name: string;
  value: string;
  side: string;
  zone: string;
  confidence: number;
  source: string;
}

export type CheckInPrefillFieldName =
  | 'lastName'
  | 'firstName'
  | 'gender'
  | 'dateOfBirth'
  | 'birthPlace'
  | 'citizenship'
  | 'documentKind'
  | 'documentNumber'
  | 'issuePlace';

export interface CheckInDocumentReadResult {
  side?: 'front' | 'back' | 'single' | null;
  guestPosition?: number | null;
  confirmGuest?: boolean;
  read: boolean;
  reason?: string | null;
  /** The values read by zone, with their side, zone, confidence and source. Self-hosted flow only; absent otherwise. */
  fields?: CheckInZonedField[] | null;
  /** The fields of the check-in the photo did not give (see {@link CheckInPrefillFieldName}). Self-hosted flow only; absent otherwise. */
  missing?: string[] | null;
  /** `local` when the photo was read on the server and nowhere else. Self-hosted flow only; absent otherwise. */
  source?: string | null;
  guest?: {
    firstName?: string | null;
    lastName?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    bornInItaly?: boolean | null;
    birthPlace?: string | null;
    residenceStreet?: string | null;
    residencePostalCode?: string | null;
    residenceCityName?: string | null;
    residenceProvince?: string | null;
    residenceCountryName?: string | null;
    residenceInItaly?: boolean | null;
    birthProvince?: string | null;
    citizenship?: string | null;
    documentKind?: string | null;
    documentNumber?: string | null;
    issuePlace?: string | null;
    documentIssuedOn?: string | null;
    documentExpiresOn?: string | null;
  } | null;
}

export type CheckInLinkEmailStatus = 'NotRequested' | 'Queued' | 'Sent' | 'Failed';

export const CHECK_IN_LINK_EMAIL_ERRORS = [
  'no_recipient',
  'provider_not_configured',
  'queue_failed',
  'rejected',
  'not_delivered',
  'link_unavailable',
  'link_not_usable',
] as const;

export interface CheckInSessionStatusDto {
  sessionId?: string | null;
  status?: GuestCheckInSessionStatus | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  sentAt?: string | null;
  completedAt?: string | null;
  emailStatus?: CheckInLinkEmailStatus | null;
  emailError?: string | null;
  canIssueLink: boolean;
}

export interface CheckInLinkResponse {
  checkInLink: string;
  expiresAt: string;
  emailStatus: CheckInLinkEmailStatus;
  emailError?: string | null;
}

/**
 * The steps of the identity verification as the API names them (`IdentityVerificationSteps`). `presence` is the step of the self-hosted flow (E70-E74) that takes the place of `selfie`: the guest follows the moves
 * of a challenge while the browser records a timestamped sequence of frames (E72/F02/US01/T01). On a state that does not say `selfHosted`, and for any step of the future that is not named here, the page shows
 * the way to a person instead of a screen it does not have.
 */
export type IdentityVerificationStep = 'consent' | 'document' | 'selfie' | 'presence' | 'done' | 'operator';

type IdentityChoice = 'automatic' | 'assisted';

export type IdentityVerificationResultKind = 'ok' | 'retry' | 'operator';

/**
 * Where the identity verification of the session stands (E03/F04/US02/T04): only the guest who leaves the document (the single guest, the head of
 * family or the head of group, at `verifyingGuestPosition`) is asked for a selfie; `operatorPathOpen` is always true (GDPR art. 22).
 */
export interface IdentityVerificationState {
  step: IdentityVerificationStep;
  result?: IdentityVerificationResultKind | null;
  biometricOffered: boolean;
  consentRecorded: boolean;
  consentRefused: boolean;
  documentChecked: boolean;
  attemptsRemaining: number;
  operatorRequested: boolean;
  operatorPathOpen: boolean;
  documentNotArchived: boolean;
  verifyingGuestPosition: number;
  documentSides?: string[];
  documentSideNeeded?: DocumentSide | null;
  selfHosted?: boolean;
  opened?: boolean;
  noticeVersion?: string | null;
  choice?: IdentityChoice | null;
  formatId?: string | null;
  /** The one guided retry of a correctable defect is still available. Add-only field. */
  guidedRetryAvailable?: boolean;
  closed?: boolean;
  outcome?: IdentityVerificationResultKind | null;
}

export type DocumentSide = 'front' | 'back';

export interface BiometricConsentRequest {
  consentGiven: boolean;
  consentVersion?: string;
}

export interface BiometricConsentResponse {
  consentRecorded: boolean;
  result: 'consent_recorded' | 'operator';
  biometricOffered: boolean;
  operatorPathOpen: boolean;
  state: IdentityVerificationState;
}

export interface IdentityDocumentResponse {
  success: boolean;
  acceptable: boolean;
  guidanceCodes: string[];
  documentStored: boolean;
  documentNotArchived: boolean;
  side?: string;
  sides?: string[];
}

/**
 * Answer of `POST /api/public/checkin/{token}/selfie`: `ok`, `retry` or `operator`, the guidance codes, the attempts left and, only on `ok`, the lock
 * code of the property (null or absent when it has none). Nothing of the picture comes back.
 */
export interface IdentitySelfieResponse {
  result: IdentityVerificationResultKind;
  guidanceCodes: string[];
  attemptsRemaining: number;
  operatorPathOpen: boolean;
  lockCode?: string | null;
  /**
   * Why an `ok` came with no code although the property has one (E25/F01/US01/T01): `tourist_tax_due` while the organization asks for the tourist tax before the lock code and the
   * stay still owes one the guest can pay online. Absent otherwise.
   */
  lockCodeHeld?: string | null;
}

export interface IdentityOperatorResponse {
  result: string;
  operatorPathOpen: boolean;
  state: IdentityVerificationState;
}

export interface IdentityOpenRequest {
  noticeVersion: string;
}

/**
 * Answer of `POST /api/public/checkin/{token}/identity/open`: the state of the verification after the opening (`selfHosted`, `opened`, `noticeVersion`, `choice`, `closed`, `outcome` among the rest). The call is
 * idempotent: later calls change nothing. A verification that is closed answers 409 `identity_already_closed` instead, with the same `state` in the body.
 */
export interface IdentityOpenResponse {
  state: IdentityVerificationState;
}

export type PresenceMove = 'turn_left' | 'turn_right' | 'look_up' | 'look_down';

export interface PresenceChallenge {
  challengeToken: string;
  steps: PresenceMove[];
  stepMs: number;
  leadInMs: number;
  expiresAt: string;
  targetFps: number;
  maxFrames: number;
  maxFrameSide: number;
}

export interface PresenceSequence {
  frames: Blob[];
  timestamps: number[];
  challengeToken: string;
  documentPhoto?: Blob | null;
  documentPhotoBack?: Blob | null;
}

/**
 * Answer of `POST /api/public/checkin/{token}/presence`: `ok`, `retry` (with the codes of what to change, `presence_too_short`, `presence_timing`, `presence_quality`, `presence_single_face`,
 * `presence_challenge_not_followed`) or `operator`, whether the one guided retry is still there, and the state of the verification. The server keeps the answer of an `Idempotency-Key` it has already
 * processed and gives it again for the same key, also after the challenge has expired. Nothing of the frames comes back.
 */
export interface IdentityPresenceResponse {
  result: IdentityVerificationResultKind;
  guidance: string[];
  guidedRetryAvailable: boolean;
  state: IdentityVerificationState;
}

export type CheckInLegalTextKind = 'biometric-consent' | 'ticino-notice';

export interface CheckInLegalText {
  kind: CheckInLegalTextKind | string;
  version: string;
  language: string;
  isDraft: boolean;
  contentHtml: string;
}

export interface CheckInLegalTextsResponse {
  language: string;
  texts: CheckInLegalText[];
}

export interface DoorCheckInRequest {
  bookingCode?: string;
  surname?: string;
  arrivalDate: string;
}

export interface DoorCheckInResponse {
  token: string;
}

export interface DoorQr {
  url: string;
}

export type TouristTaxCollectionStatus =
  | 'ToCollect'
  | 'PaidOnline'
  | 'PaidAtProperty'
  | 'CollectedByChannel'
  | 'IncludedInBookingPayment'
  | 'NotDue';

export type TouristTaxNotPayableReason =
  | 'None'
  | 'StayNotActive'
  | 'PaidAtProperty'
  | 'ChannelCollects'
  | 'CollectorUnknown'
  | 'NotComputable'
  | 'AwaitingConfirmation'
  | 'NothingDue'
  | 'AlreadyPaidOnline';

export interface PublicTouristTaxGuest {
  position: number;
  taxableNights: number;
  amount: number | null;
  exempt: boolean;
}

export interface PublicTouristTax {
  status: TouristTaxCollectionStatus;
  reason: TouristTaxNotPayableReason;
  payable: number;
  amountDue: number | null;
  collectedAmount: number;
  currency: string;
  guests: PublicTouristTaxGuest[];
  requiredBeforeAccessCode: boolean;
}

/**
 * Answer of `POST /api/public/checkin/{token}/tourist-tax/payment-intent`: what the Payment Element needs. The intent is on the organization's connected account, so
 * Stripe.js is opened with `stripeAccountId`. `amount` and `currency` are what will be charged (never a figure of the browser).
 */
export interface TouristTaxPaymentIntent {
  paymentIntentId: string;
  clientSecret: string;
  publishableKey: string;
  stripeAccountId: string;
  amount: number;
  currency: string;
}
