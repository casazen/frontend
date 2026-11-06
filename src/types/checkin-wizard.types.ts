import type { GuestGender, StayGuestType } from './public-checkin.types';

/**
 * Contract of the host wizard "Guest check-in" (E03/F01/US01/T04) and of the tourist tax of a stay (E03/F01/US07/T02). Enums are
 * strings, dates are `YYYY-MM-DD` (`DateOnly`) or ISO instants (`DateTime`), like the rest of the API.
 */

/** Where the guests of a stay are: expected, arrived, departed, a no-show, or no check-in is expected (pending or cancelled booking). */
export type StayAttendance = 'Expected' | 'Arrived' | 'Departed' | 'NoShow' | 'Inactive';

/** The steps of the wizard the server names in `suggestedStep`; `result` is "nothing left to do". */
export type CheckInSuggestedStep = 'guests' | 'documents' | 'checks' | 'tax' | 'send' | 'result';

export interface CheckInWizardBooking {
  bookingId: string;
  propertyId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  source: string;
  declaredGuests: number;
  status: string;
  /** When the host marked the stay as a no-show; null otherwise. */
  noShowAt?: string | null;
}

/** Who entered the data of a guest. */
export type StayGuestDataSource = 'NotRecorded' | 'GuestPortal' | 'Host';

/** A guest as the summary shows it: the document number masked, the exemption code of the tourist tax with the guest (host with `guest.read` only). */
export interface CheckInWizardGuest {
  /** False for the booker shown before any guest is registered (nothing saved yet). */
  saved: boolean;
  position: number;
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
  residenceInItaly?: boolean | null;
  residenceComuneCode?: string | null;
  residenceComuneName?: string | null;
  residenceProvince?: string | null;
  residenceCountryCode?: string | null;
  residenceCountryName?: string | null;
  documentType?: string | null;
  documentTypeCode?: string | null;
  /** The document number with all but the last characters masked; null without one. */
  documentNumberMasked?: string | null;
  documentIssuePlaceCode?: string | null;
  documentIssuePlaceName: string;
  documentIssuedOn?: string | null;
  documentExpiresOn?: string | null;
  tourismType?: string | null;
  travelWay?: string | null;
  educationLevel?: string | null;
  /** The host's exemption of the tourist tax (a reason code); null for none, and for a caller without `guest.read`. */
  taxExemptionCode?: string | null;
  dataSource: StayGuestDataSource;
}

/** Codes of an issue of the checks (`CheckInIssueCodes` of the API). */
export type CheckInIssueCode =
  | 'guest_field_missing'
  | 'guest_code_missing'
  | 'octorate_field_missing'
  | 'guest_field_required'
  | 'document_expired'
  | 'guests_count_mismatch';

/** Something the checks found: the code and the field the client says in plain words. A blocking one stops the confirmation. */
export interface CheckInIssue {
  /** The position of the guest; null for the stay as a whole. */
  position: number | null;
  code: string;
  /** The camelCase field of the guest; null for the stay. */
  field: string | null;
  blocking: boolean;
}

export type ComplianceSenderType = 'ChannelManager' | 'CasaZen' | 'Manual';

/** Who sends the police communications of the property. */
export interface CheckInWizardSender {
  alloggiatiSender: ComplianceSenderType;
  source: string;
  /** False for a property outside Italy. */
  applies: boolean;
}

export type OctorateSyncStatus = 'Pending' | 'Sent' | 'Failed';

/** One guest as sent to Octorate (no personal data). */
export interface OctorateGuestLink {
  position: number;
  status: OctorateSyncStatus;
  sentAsDraft: boolean;
  attempts: number;
  errorCode?: string | null;
  sentAt?: string | null;
}

export type OctorateStayStateName = 'CheckInEnd' | 'CheckOutEnd' | 'NoShow';

/** One state of the stay on Octorate; `status` is null when it was never pushed. */
export interface OctorateStayStateView {
  state: OctorateStayStateName;
  status?: OctorateSyncStatus | null;
  attempts: number;
  errorCode?: string | null;
  sentAt?: string | null;
  effectiveCheckin?: string | null;
  arrivalTime?: string | null;
}

/** The check-in on Octorate: each guest sent and the three states of the stay. */
export interface CheckInWizardOctorate {
  /** False when the booking is not on Octorate (then the lists are empty). */
  mirrored: boolean;
  guests: OctorateGuestLink[];
  states: OctorateStayStateView[];
}

/** The police communication of the stay (`status` is an `AlloggiatiWebStatus`, plus `NotDue` for a no-show). */
export interface CheckInWizardAlloggiati {
  status: string;
  dataComplete: boolean;
  deadlineAt: string;
  isOverdue: boolean;
  reportedAt?: string | null;
}

/** What the host can do now. */
export interface CheckInWizardCapabilities {
  /** The photo of a document can be read (`POST …/checkin-wizard/document-reading`; closed while the feature is off). */
  documentReading: boolean;
  canRegisterArrival: boolean;
  canMarkNoShow: boolean;
  /** The tourist tax values travel to Octorate with the guests. */
  octorateTaxValues: boolean;
}

export type TouristTaxQuoteStatus = 'Calculated' | 'RateUnavailable' | 'CategoryRequired' | 'ChildAgesRequired' | 'NightlyPriceRequired';
export type TouristTaxRateSource = 'None' | 'Official' | 'HostDeclared';
export type TouristTaxCollector = 'Channel' | 'Host';
export type TouristTaxCollectorSource = 'Default' | 'ChannelRule' | 'HostDeclared';
/** Why a guest pays no tourist tax: `Age` is applied by the calculator (never chosen), `Host` is a reason the host chose. */
export type TouristTaxExemptionKind = 'None' | 'Age' | 'Host';

/** The tax of one guest: a position of the stay, never a person. */
export interface StayTouristTaxGuest {
  position: number;
  nights: number;
  taxableNights: number;
  /** Null when the tax of the stay is not calculated. */
  amount: number | null;
  exemptionKind: TouristTaxExemptionKind;
  /** The reason of the exemption; null for a caller without `guest.read`. */
  exemptionCode?: string | null;
}

/** A reason the host may choose: the code and the i18n key of its plain-words label. */
export interface TouristTaxExemptionReason {
  code: string;
  labelKey: string;
}

/** The tourist tax of a stay guest by guest (`GET /bookings/{id}/tourist-tax`). When no rate is known `missingRate` is true and the amounts are null, never 0. */
export interface StayTouristTax {
  bookingId: string;
  status: TouristTaxQuoteStatus;
  rateSource: TouristTaxRateSource;
  missingRate: boolean;
  nights: number;
  taxableNights: number;
  ageRulesApply: boolean;
  categories: string[];
  total: number | null;
  /** What the host must collect: 0 when the channel collects it, the total otherwise. */
  amountDue: number | null;
  /** Null while unknown. */
  collector: TouristTaxCollector | null;
  collectorSource: TouristTaxCollectorSource;
  /** A channel stay with no rule and no declaration: ask the host who collected. */
  collectorNeeded: boolean;
  guests: StayTouristTaxGuest[];
  /** The reasons the host may choose (active, not automatic). */
  reasons: TouristTaxExemptionReason[];
  confirmedAt?: string | null;
  /** The confirmed tax no longer matches the stay. */
  stale: boolean;
}

/** Everything the six steps show (`GET /bookings/{id}/checkin-wizard`). */
export interface CheckInWizardState {
  booking: CheckInWizardBooking;
  attendance: StayAttendance;
  guests: CheckInWizardGuest[];
  /** The statistical fields the region requires (`TourismType`, `TravelWay`, `EducationLevel`); empty when none. */
  requiredGuestFields: string[];
  issues: CheckInIssue[];
  /** The tourist tax of the stay; null when it cannot be worked out now. */
  tax?: StayTouristTax | null;
  sender: CheckInWizardSender;
  octorate: CheckInWizardOctorate;
  alloggiati: CheckInWizardAlloggiati;
  capabilities: CheckInWizardCapabilities;
  /** The first step with something to do. */
  suggestedStep: CheckInSuggestedStep;
}

/** What the confirmation did with the guests on Octorate. */
export type OctorateCheckInSendState = 'NotMirrored' | 'NotApplicable' | 'NothingToSend' | 'Sent' | 'PartlyFailed' | 'Failed';

export type OctorateGuestSendOutcome = 'Created' | 'Updated' | 'Unchanged' | 'Failed';

export interface OctorateGuestSendResult {
  position: number;
  outcome: OctorateGuestSendOutcome;
  /** Why it failed (`octorate_auth`, `octorate_rate_limited`, `octorate_guest_rejected`…); null otherwise. */
  errorCode?: string | null;
}

/** What the police communication does next for the sender of the property. */
export type CheckInAlloggiatiNextStep = 'ChannelManagerSends' | 'Manual' | 'AlreadySent' | 'NotApplicable';

/** The answer of `POST /bookings/{id}/checkin-wizard/confirm`: one entry per element and the new state. */
export interface CheckInConfirmation {
  tax: {
    saved: boolean;
    /** Why the tax was not saved (`tax_not_calculable`…); null when it was. */
    reason?: string | null;
  };
  octorate: {
    state: OctorateCheckInSendState;
    /** A stable code when nothing was sent and the state says why (`sender_not_channel_manager`, `not_connected`…). */
    reason?: string | null;
    draft: boolean;
    /** Data already transmitted to the police changed: it may need a correction on the Alloggiati portal. */
    correctionAfterSend: boolean;
    guests: OctorateGuestSendResult[];
  };
  alloggiati: { step: CheckInAlloggiatiNextStep; sender: ComplianceSenderType };
  state: CheckInWizardState;
}

export type DocumentReadingMethod = 'None' | 'Mrz' | 'Ocr';

/** The fields read on a document photo (never stored): the host checks them before saving the guest. */
export interface DocumentReadingFields {
  documentType?: string | null;
  surname?: string | null;
  givenNames?: string | null;
  fullName?: string | null;
  documentNumber?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
  expirationDate?: string | null;
  sex?: string | null;
  issuingState?: string | null;
}

export interface DocumentReading {
  method: DocumentReadingMethod;
  confidence: number;
  checkDigitsValid?: boolean | null;
  requiresManualReview: boolean;
  fields?: DocumentReadingFields | null;
}

/** The answer of `POST /bookings/{id}/no-show`. */
export interface NoShowResult {
  bookingId: string;
  status: string;
  noShowAt?: string | null;
}

/** The rate an org declares for a comune with no official one (`GET /properties/{id}/tourist-tax-rate`). */
export interface OrgTouristTaxRate {
  ratePerPersonPerNight: number;
  maxNights?: number | null;
  minimumAge: number;
  /** `MM-dd`. */
  seasonStart?: string | null;
  seasonEnd?: string | null;
  effectiveFrom: string;
  sourceNote: string;
  updatedAt: string;
}

export interface MunicipalityRate {
  propertyId: string;
  istatCode?: string | null;
  city?: string | null;
  /** An official rate is in force in the comune today: no rate can be declared, the official one applies. */
  officialRateInForce: boolean;
  rate?: OrgTouristTaxRate | null;
}

/** Body of `PUT /properties/{id}/tourist-tax-rate`. */
export interface SaveMunicipalityRateRequest {
  ratePerPersonPerNight: number;
  maxNights?: number | null;
  minimumAge: number;
  seasonStart?: string | null;
  seasonEnd?: string | null;
  effectiveFrom?: string | null;
  sourceNote: string;
}

/** One exemption of the host: a position of the stay and a reason code (null clears it). */
export interface GuestExemption {
  position: number;
  code: string | null;
}
