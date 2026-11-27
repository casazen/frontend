import type { InvoiceDataText, InvoiceRecipientKind } from './invoice-data.types';

export type GuestCheckInSessionStatus =
  | 'Inviato'
  | 'InCompilazione'
  | 'Completo'
  | 'AlloggiatiInviato'
  | 'Scaduto';

/** Values of the API `Gender` enum. */
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

/** Official Alloggiati code tables (API enum `AlloggiatiCodeTable`). */
export type AlloggiatiCodeTable = 'Comuni' | 'Stati' | 'Documenti' | 'TipiAlloggiato';

/** Lists the forms search: `luoghi` = comuni and states (place of issue of a document). */
export type AlloggiatiCodeList = 'comuni' | 'stati' | 'documenti' | 'luoghi';

/** Document kinds offered when the official document table is not imported (`Other` has no Alloggiati value). */
export type AlloggiatiDocumentKind = 'Passport' | 'IdentityCard' | 'DriversLicense';

/** A guest on file (at least the booker), to prefill the form. The document number is never returned in full. */
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
  /** Document number on file with only its last characters visible (e.g. `*****567`), never the full number. */
  documentNumberMasked?: string | null;
  documentIssuePlaceCode?: string | null;
  documentIssuePlaceName: string;
  /** Day the document was issued (`YYYY-MM-DD`), when on file (NF-40). */
  documentIssuedOn?: string | null;
  /** Day the document expires (`YYYY-MM-DD`), when on file (NF-40). */
  documentExpiresOn?: string | null;
  /** Residence (NF-40): in Italy the comune and the province, abroad the state. Null until the guest says. */
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
  /** Statistical fields (NF-40), codes of the closed lists, asked only where the region requires them. */
  tourismType?: string | null;
  travelWay?: string | null;
  educationLevel?: string | null;
}

/**
 * Context of `GET /public/checkin/{token}`. Once the guest has submitted (`completed`), the API returns only
 * `completed`, `status` and `orgSlug` (public data): no booking data and no guest data.
 */
export interface PublicCheckInContextDto {
  houseRules?: string | null;
  houseRulesVersion?: string | null;
  completed: boolean;
  status: GuestCheckInSessionStatus;
  sessionId?: string;
  propertyName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  /** Guests declared on the booking: the form starts with as many. */
  declaredGuests?: number;
  /** Guests on file in record order (head of family or group first). */
  guests?: PublicCheckInGuestPrefill[];
  /** Official tables imported: only these offer codes in the form. */
  availableCodeTables?: AlloggiatiCodeTable[];
  /** Version of the privacy notice shown (art. 13 GDPR); absent when not configured. */
  privacyNoticeVersion?: string;
  privacyNoticeOrgSlug?: string;
  /**
   * Slug of the agency the link belongs to (NF-140): sent for every usable link, whether or not the agency has a published privacy notice. The check-in page of an agency's own domain is
   * shown only for the agency of that domain. Optional so that an answer of a backend that does not send it yet still types; the guard then reads `privacyNoticeOrgSlug`.
   */
  orgSlug?: string;
  /** Version of the optional marketing consent text; absent when the consent is not offered. */
  marketingConsentVersion?: string;
  /**
   * The guest fields the regime of the property requires: the page asks these and no other (NF-40, data minimization), as names of the
   * properties of a guest. The statistical fields the region requires (`TourismType`, `TravelWay`, `EducationLevel`; none when the region
   * requires none) and, for a property in canton Ticino (NF-132), `DocumentType` and `DocumentNumber` (of every adult), `ResidenceStreet`,
   * `ResidencePostalCode`, `ResidenceCityName` and `ResidenceCountryName` (the home and the state of residence: asked, optional).
   */
  requiredGuestFields?: string[];
  /**
   * The page asks the plate of the car, once for the stay and optional (NF-132): the property is in canton Ticino. Open session only; absent
   * (false) everywhere else, and then nothing about a plate is shown or sent.
   */
  askVehiclePlate?: boolean;
  /** The language to open the page in (`it`, `en`, `de`, `fr`, `es`): the guest's earlier choice, else the browser's, else `it`. Open session only. */
  language?: string;
  /** The languages the guest can choose. Open session only. */
  supportedLanguages?: string[];
  /**
   * The answer to «Ti serve la fattura?» is already yes (FIS-01, E06/F02/US01/T03): the step starts with the question answered. Open session only.
   * The invoice data itself is write-only from this page (the link is anonymous): the page never receives a fiscal code, a VAT number, an address or
   * a PEC, only this flag and `hasInvoiceData`.
   */
  invoiceRequested?: boolean;
  /** The booking already has the data of an invoice recipient (the host wrote it, or the channel manager had it); never its content. Open session only. */
  hasInvoiceData?: boolean;
  /**
   * The property keeps no identity document (canton Ticino, ADR-013-R6, R15): the page says «Il documento non sarà archiviato» and the selfie
   * step sends the photo of the document again. Sent with an open session while the identity verification is on (E03/F04/US02/T04).
   */
  documentNotArchived?: boolean;
  /**
   * Where the identity verification of the session stands. Sent with an open session only while the verification is on (the feature flag of
   * the API): absent, the page has no identity step and nothing of it changes.
   */
  identityVerification?: IdentityVerificationState;
}

/** Answer of `PUT /public/checkin/{token}/language`: the language now saved on the session. */
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
  /** Optional (NF-40): sent with the document, `null` when not given. */
  documentIssuedOn?: string | null;
  documentExpiresOn?: string | null;
  /** Optional residence (NF-40): in Italy comune and province, abroad the state; `null` when not said. */
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
  /**
   * The tourist tax exemption the host chose (a reason code, NF-46): sent by the host's entries only. The guest portal never sends it, and the
   * server ignores it there.
   */
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
  /** Guest ticked the email marketing channel (NF-05). */
  marketingConsentEmail: boolean;
  /** Guest ticked the WhatsApp marketing channel (NF-05). */
  marketingConsentWhatsApp: boolean;
  /** Marketing email address (required when any channel is ticked, NF-05). */
  marketingEmail?: string | null;
  /**
   * The optional answer to «Ti serve la fattura?» (FIS-01): present only when the guest said yes. A guest who skips the step, or says no, sends no
   * block at all, and the check-in is never blocked by it.
   */
  invoice?: PublicCheckInInvoiceRequest;
  /**
   * The plate of the car of the stay (NF-132), once for the stay: sent only when the guest typed one, where the context says `askVehiclePlate`.
   * Absent keeps the plate the server holds (the page never reads it back); the text is as typed, the server removes the spaces and upper-cases it.
   */
  vehiclePlate?: string;
}

/** One entry of an official Alloggiati table. */
export interface AlloggiatiCodeEntryDto {
  table: AlloggiatiCodeTable;
  code: string;
  description: string;
  province?: string | null;
  /** Citizenship adjective (Italiano). Absent for a place. */
  citizenshipLabel?: string | null;
}

/**
 * One value the zones of the card gave (`fields` of `read-document`, E71/F01/US03/T01, NF-190): what it is, the value, the side of the document it was read on, the zone of the format it came from and how far
 * it is trusted. Personal data that goes to the guest who sent the photo and nowhere else: the page holds it in memory for the length of the step, never in a storage, an address or a log.
 */
export interface CheckInZonedField {
  /** What the value is: `surname`, `givenNames`, `birthDate`, `birthPlace`, `sex`, `nationality`, `documentNumber`, `issueDate`, `expiryDate` or `fiscalCode`. */
  name: string;
  /** The value as the server reads it: names and places in upper case, dates as `yyyy-MM-dd`, `sex` as `M`, `F` or `X`, `nationality` as the three letters of the country. */
  value: string;
  /** The side it was read on: `front`, `back` or `single`. */
  side: string;
  /** The zone of the format it was read from (the name of a field zone, or `mrz`). */
  zone: string;
  /** How far the reading is trusted, 0 to 1. A hint for the page; it decides nothing. */
  confidence: number;
  /** Where the value comes from: `mrz` (the lines of letters and numbers, with their check digits) or `viz` (the printed zone). */
  source: string;
}

/**
 * The fields of the check-in the photo of a document can fill, in the words of the answer's `missing` (E71/F01/US03/T01): what the guest types when the photo did not give it. A name the page does not know is
 * not an error: it is asked under a general label.
 */
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

/**
 * Answer of `POST /public/checkin/{token}/read-document`. The photo is not returned. With the self-hosted flow on (E71/F01/US03/T01, NF-190) it also carries `fields` (what the zones of the card gave),
 * `missing` (the fields the guest has still to type) and `source: "local"` (nothing left the server); with it off none of the three is in the answer, which is then exactly the one of before.
 */
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

/** Delivery of the check-in link by email (API enum `GuestCheckInLinkEmailStatus`, CO-09). */
export type CheckInLinkEmailStatus = 'NotRequested' | 'Queued' | 'Sent' | 'Failed';

/** Stable reasons of a failed link email (API `GuestCheckInLinkEmailErrors`). */
export const CHECK_IN_LINK_EMAIL_ERRORS = [
  'no_recipient',
  'provider_not_configured',
  'queue_failed',
  'rejected',
  'not_delivered',
  'link_unavailable',
  'link_not_usable',
] as const;

/**
 * The check-in link of a booking as the host sees it (`GET /bookings/{id}/checkin-session`). Every field but
 * `canIssueLink` is null when no link was ever issued; `status` is `Scaduto` once the link is past its expiry.
 */
export interface CheckInSessionStatusDto {
  sessionId?: string | null;
  status?: GuestCheckInSessionStatus | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  /** When the email was handed to the provider; null when it was not. */
  sentAt?: string | null;
  completedAt?: string | null;
  /** Null for links issued before the email outcome was recorded. */
  emailStatus?: CheckInLinkEmailStatus | null;
  emailError?: string | null;
  /** The booking accepts a new link (confirmed or checked in, check-in not completed by the guest). */
  canIssueLink: boolean;
}

/**
 * A link the host just generated (`POST /bookings/{id}/checkin/link`) or sent (`POST .../checkin/resend-link`): the
 * link is always returned, with the real state of its email.
 */
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

/** What the guest chose when the identity step opened (API `IdentityChoices`): the automatic verification, or a person (the assisted path). */
export type IdentityChoice = 'automatic' | 'assisted';

/** What the guest is told after an attempt (API `IdentityVerificationGuestResults`): passed, try again, or a person verifies. */
export type IdentityVerificationResultKind = 'ok' | 'retry' | 'operator';

/**
 * Where the identity verification of the session stands (E03/F04/US02/T04): only the guest who leaves the document (the single guest, the head of
 * family or the head of group, at `verifyingGuestPosition`) is asked for a selfie; `operatorPathOpen` is always true (GDPR art. 22).
 */
export interface IdentityVerificationState {
  step: IdentityVerificationStep;
  result?: IdentityVerificationResultKind | null;
  /** The face check is offered: not when the organization switched it off, the guest is a minor or refused the consent. */
  biometricOffered: boolean;
  consentRecorded: boolean;
  consentRefused: boolean;
  documentChecked: boolean;
  attemptsRemaining: number;
  /** A person was asked to verify (the guest asked, the consent was refused, a review, the attempts are used). */
  operatorRequested: boolean;
  operatorPathOpen: boolean;
  documentNotArchived: boolean;
  verifyingGuestPosition: number;
  /**
   * The pictures of the document the server holds a read of (E22/F01/US01/T02): `['single']`, or `front` and `back` for those that were sent; empty before the first one. Add-only
   * field: an older API omits it.
   */
  documentSides?: string[];
  /** The side of a document of two sides still to photograph (`front` or `back`), so a page that is opened again asks for it; null (or absent) when none is missing. */
  documentSideNeeded?: DocumentSide | null;
  /**
   * The session follows the self-hosted flow (E70/F02/US01/T01, NF-188; backend flag `CheckInIdentitySelfHosted`). False, or absent while the API is older, on the legacy path: every member below keeps its default
   * and the page is the one it always was. Add-only field.
   */
  selfHosted?: boolean;
  /** The identity step was opened and bound to one guest of the session. Add-only field. */
  opened?: boolean;
  /** The version of the notice (the text of the consent) recorded at the opening; null before it. Add-only field. */
  noticeVersion?: string | null;
  /** What the guest chose: `automatic` (a consent) or `assisted` (a refusal, or the request for a person); null before the choice. Add-only field. */
  choice?: IdentityChoice | null;
  /** The format of the registry the document was read as (the Italian electronic identity card first); null before it was recognised. Add-only field. */
  formatId?: string | null;
  /** The one guided retry of a correctable defect is still available. Add-only field. */
  guidedRetryAvailable?: boolean;
  /** The verification is closed: no document or presence step is accepted any more (409 `identity_already_closed`), and the request for a person stays open. Add-only field. */
  closed?: boolean;
  /** What the guest sees of a closed verification: `ok` (approved) or `operator` (a person has it); null before it is decided. Add-only field. */
  outcome?: IdentityVerificationResultKind | null;
}

/** The side of an identity document a picture is of: a card has the face on the front and, on the Italian electronic identity card, the lines of letters (MRZ) on the back. */
export type DocumentSide = 'front' | 'back';

/**
 * The guest's answer to the biometric consent (`POST /api/public/checkin/{token}/biometric-consent`, ADR-013-R9): explicit, separate from the
 * privacy notice and refusable. `consentVersion` (the version of the text shown, at most 50 characters) is required with a consent.
 */
export interface BiometricConsentRequest {
  consentGiven: boolean;
  consentVersion?: string;
}

/** What the answer to the consent did: `consent_recorded` (go on with the document) or `operator` (refused, not offered, or already with a person). */
export interface BiometricConsentResponse {
  consentRecorded: boolean;
  result: 'consent_recorded' | 'operator';
  biometricOffered: boolean;
  operatorPathOpen: boolean;
  state: IdentityVerificationState;
}

/**
 * Answer of `POST /api/public/checkin/{token}/document` for the capture guidance: whether the photo can be compared and, when it cannot, the codes of
 * what to change. The API also sends the fields it read (`fields`): the identity step never uses them, so they are not part of this type.
 */
export interface IdentityDocumentResponse {
  success: boolean;
  /** The MRZ was read and the agent found nothing to change: the photo can be compared. */
  acceptable: boolean;
  /** What to change in the photo (`show_whole_document`, `avoid_glare`, `hold_still`, `more_light`, ...): codes the page translates. */
  guidanceCodes: string[];
  documentStored: boolean;
  /** The property keeps no document (Ticino): the selfie request carries the photo again (both sides of a document of two sides). */
  documentNotArchived: boolean;
  /** The side that was just read (`single`, `front` or `back`). Add-only field: an older API omits it. */
  side?: string;
  /** The pictures of the attempt the server has a read of (`['single']`, or `front` and `back`). Add-only field. */
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

/** Answer of `POST /api/public/checkin/{token}/request-operator`: the guest asked for a person and the operators are told. */
export interface IdentityOperatorResponse {
  result: string;
  operatorPathOpen: boolean;
  state: IdentityVerificationState;
}

/**
 * What `POST /api/public/checkin/{token}/identity/open` is sent (E70/F02/US01/T01, NF-188): the version of the text of the consent the page shows, as `GET .../legal-texts` served it. Any other version is
 * 422 `notice_version_unknown` and nothing is recorded.
 */
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

/**
 * The moves of the challenge of the presence (API `PresenceMoves`, E72/F01/US01/T01): the guest is asked for them one after the other, in the order the challenge names them. A move the page has no
 * words and no drawing for is not a move of the challenge: the challenge is not used.
 */
export type PresenceMove = 'turn_left' | 'turn_right' | 'look_up' | 'look_down';

/**
 * Answer of `POST /api/public/checkin/{token}/presence-challenge` (E72/F02/US01/T01, NF-192): the short challenge of the presence, bound to the session and to the attempt, that expires at `expiresAt`. The
 * guest looks at the camera for `leadInMs`, then follows each of `steps` for `stepMs`; the browser takes a frame about `targetFps` times a second (at most `maxFrames`, each no larger than `maxFrameSide` px on its
 * long side) and sends the sequence back with `challengeToken`. 409 `presence_challenge_unavailable` when the automatic check cannot be done for this session: a person verifies.
 */
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

/**
 * What `POST /api/public/checkin/{token}/presence` is sent (E72/F02/US01/T01): the frames of the sequence (JPEG, in memory only), the time of each in milliseconds from the first (a whole number, the first is 0, each one larger
 * than the one before), the token of the challenge they answer and, for a property that keeps no document (Ticino), the picture(s) of the document again, as the selfie of the legacy path does.
 */
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

/** What a legal text of the identity step is for (API `CheckInLegalTextKinds`): the consent to the face check, and the notice for a property that keeps no document (Ticino). */
export type CheckInLegalTextKind = 'biometric-consent' | 'ticino-notice';

/**
 * One legal text of the identity step as the registry serves it (`GET /api/public/checkin/{token}/legal-texts`, E22/F01/US02/T02): its `version` is the id the consent posts back, `language`
 * the one of the file served (the closest the registry has), `isDraft` that it is not approved yet (served outside production only), and `contentHtml` its text, already sanitized by the server.
 */
export interface CheckInLegalText {
  kind: CheckInLegalTextKind | string;
  version: string;
  language: string;
  isDraft: boolean;
  contentHtml: string;
}

/** Answer of `GET /api/public/checkin/{token}/legal-texts?lang=`: the language asked for and the texts of the stay (the consent, and the Ticino notice where it applies). */
export interface CheckInLegalTextsResponse {
  language: string;
  texts: CheckInLegalText[];
}

/**
 * What the guest types at the door (`POST /api/public/checkin/door/{doorToken}`, E22/F01/US02/T01): the booking code or, without one, the surname of the main guest, and the day the stay
 * begins (`yyyy-MM-dd`). The code wins when both are sent, so only one of them is ever sent.
 */
export interface DoorCheckInRequest {
  bookingCode?: string;
  surname?: string;
  arrivalDate: string;
}

/** Answer of the door: the token of the check-in link of the stay, and nothing else. It opens `/checkin/{token}`. */
export interface DoorCheckInResponse {
  token: string;
}

/** The address behind the QR code of the door of a property (`GET api/properties/{id}/door-qr` and `POST .../rotate`). */
export interface DoorQr {
  url: string;
}

/**
 * Where the collection of the tourist tax of a stay stands (`TouristTaxCollectionStatus` of the API, E25/F01/US01/T01, NF-119). The guest page and the host's view of the tax
 * read the same states: what is still to collect, what the guest paid online, what the channel or the price of the booking already covers.
 */
export type TouristTaxCollectionStatus =
  | 'ToCollect'
  | 'PaidOnline'
  | 'PaidAtProperty'
  | 'CollectedByChannel'
  | 'IncludedInBookingPayment'
  | 'NotDue';

/** Why nothing can be paid online now (`TouristTaxNotPayableReason` of the API); `None` when there is something to pay. */
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

/** The tax of one guest as the guest page shows it: a position of the stay, never a person, and never the reason of an exemption. */
export interface PublicTouristTaxGuest {
  position: number;
  taxableNights: number;
  /** Null when the tax of the stay is not calculated. */
  amount: number | null;
  exempt: boolean;
}

/**
 * Answer of `GET /api/public/checkin/{token}/tourist-tax` (flag `touristTaxOnlinePayment`): what the guest can pay online now, in the currency of the property, and where the
 * collection stands. Every amount is the API's: the page adds up nothing. 404 while the flag is off or for a link that reaches no stay; 409 `tourist_tax_payment_not_available`
 * while the organization does not offer the payment or its account does not take payments.
 */
export interface PublicTouristTax {
  status: TouristTaxCollectionStatus;
  reason: TouristTaxNotPayableReason;
  /** What the guest can pay online now (0 when nothing). */
  payable: number;
  /** The tax of the stay the host collects; null when it cannot be calculated (the host tells the amount). */
  amountDue: number | null;
  /** What the guest already paid online. */
  collectedAmount: number;
  /** `EUR` or `CHF`; empty when the API does not say: the amounts are then shown with no symbol. */
  currency: string;
  guests: PublicTouristTaxGuest[];
  /** The organization asks for the tax before the lock code: the step cannot be left until it is paid. */
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
