import type {
  GuestGender,
  StayGuestSubmit,
  StayGuestType,
  TouristTaxCollectionStatus,
  TouristTaxNotPayableReason,
} from './public-checkin.types';

type StayAttendance = 'Expected' | 'Arrived' | 'Departed' | 'NoShow' | 'Inactive';

/**
 * What a host's save of the guests sends (`PUT /bookings/{id}/checkin-wizard/guests`, `PUT /alloggiati/{bookingId}/stay-guests`): the whole list of
 * guests and, where the regime asks it (canton Ticino, NF-132), the plate of the car of the stay. Without `vehiclePlate` the server leaves the stored
 * plate as it is; an empty text clears it.
 */
export interface GuestsSave {
  guests: StayGuestSubmit[];
  vehiclePlate?: string;
}

type CheckInSuggestedStep = 'guests' | 'documents' | 'checks' | 'tax' | 'send' | 'result';

interface CheckInWizardBooking {
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
  vehiclePlate?: string | null;
}

export type StayGuestDataSource = 'NotRecorded' | 'GuestPortal' | 'Host';

export interface CheckInWizardGuest {
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
  residenceStreet?: string | null;
  residencePostalCode?: string | null;
  residenceCityName?: string | null;
  documentType?: string | null;
  documentTypeCode?: string | null;
  documentNumberMasked?: string | null;
  documentIssuePlaceCode?: string | null;
  documentIssuePlaceName: string;
  documentIssuedOn?: string | null;
  documentExpiresOn?: string | null;
  tourismType?: string | null;
  travelWay?: string | null;
  educationLevel?: string | null;
  taxExemptionCode?: string | null;
  dataSource: StayGuestDataSource;
}

export interface CheckInIssue {
  position: number | null;
  code: string;
  field: string | null;
  blocking: boolean;
}

export type ComplianceSenderType = 'ChannelManager' | 'CasaZen' | 'Manual';

interface CheckInWizardSender {
  alloggiatiSender: ComplianceSenderType;
  source: string;
  applies: boolean;
}

export type OctorateSyncStatus = 'Pending' | 'Sent' | 'Failed';

interface OctorateGuestLink {
  position: number;
  status: OctorateSyncStatus;
  sentAsDraft: boolean;
  attempts: number;
  errorCode?: string | null;
  sentAt?: string | null;
}

type OctorateStayStateName = 'CheckInEnd' | 'CheckOutEnd' | 'NoShow';

/** One state of the stay on Octorate; `status` is null when it was never pushed. */
interface OctorateStayStateView {
  state: OctorateStayStateName;
  status?: OctorateSyncStatus | null;
  attempts: number;
  errorCode?: string | null;
  sentAt?: string | null;
  effectiveCheckin?: string | null;
  arrivalTime?: string | null;
}

interface CheckInWizardOctorate {
  mirrored: boolean;
  guests: OctorateGuestLink[];
  states: OctorateStayStateView[];
}

interface CheckInWizardAlloggiati {
  status: string;
  dataComplete: boolean;
  deadlineAt: string;
  isOverdue: boolean;
  reportedAt?: string | null;
}

interface CheckInWizardCapabilities {
  documentReading: boolean;
  canRegisterArrival: boolean;
  canMarkNoShow: boolean;
  octorateTaxValues: boolean;
}

export type TouristTaxQuoteStatus = 'Calculated' | 'RateUnavailable' | 'CategoryRequired' | 'ChildAgesRequired' | 'NightlyPriceRequired';
type TouristTaxRateSource = 'None' | 'Official' | 'HostDeclared';
export type TouristTaxCollector = 'Channel' | 'Host';
type TouristTaxCollectorSource = 'Default' | 'ChannelRule' | 'HostDeclared';
type TouristTaxExemptionKind = 'None' | 'Age' | 'Host';

export interface StayTouristTaxGuest {
  position: number;
  nights: number;
  taxableNights: number;
  amount: number | null;
  exemptionKind: TouristTaxExemptionKind;
  exemptionCode?: string | null;
}

interface TouristTaxExemptionReason {
  code: string;
  labelKey: string;
}

export interface TouristTaxCollection {
  status: TouristTaxCollectionStatus;
  reason: TouristTaxNotPayableReason;
  toCollect: number;
  onlinePayable: number;
  refundDue: number;
  amountDue: number | null;
  includedInBooking: number;
  collectedAmount: number;
  refundedAmount: number;
  currency: string;
  collectedAt?: string | null;
  onlinePaymentAvailable: boolean;
}

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
  collector: TouristTaxCollector | null;
  collectorSource: TouristTaxCollectorSource;
  collectorNeeded: boolean;
  guests: StayTouristTaxGuest[];
  reasons: TouristTaxExemptionReason[];
  confirmedAt?: string | null;
  stale: boolean;
  collection?: TouristTaxCollection | null;
}

export interface CheckInWizardState {
  booking: CheckInWizardBooking;
  attendance: StayAttendance;
  guests: CheckInWizardGuest[];
  requiredGuestFields: string[];
  askVehiclePlate?: boolean;
  issues: CheckInIssue[];
  tax?: StayTouristTax | null;
  sender: CheckInWizardSender;
  octorate: CheckInWizardOctorate;
  alloggiati: CheckInWizardAlloggiati;
  capabilities: CheckInWizardCapabilities;
  suggestedStep: CheckInSuggestedStep;
}

export type OctorateCheckInSendState = 'NotMirrored' | 'NotApplicable' | 'NothingToSend' | 'Sent' | 'PartlyFailed' | 'Failed';

type OctorateGuestSendOutcome = 'Created' | 'Updated' | 'Unchanged' | 'Failed';

interface OctorateGuestSendResult {
  position: number;
  outcome: OctorateGuestSendOutcome;
  /** Why it failed (`octorate_auth`, `octorate_rate_limited`, `octorate_guest_rejected`…); null otherwise. */
  errorCode?: string | null;
}

type CheckInAlloggiatiNextStep = 'ChannelManagerSends' | 'Manual' | 'AlreadySent' | 'NotApplicable';

export interface CheckInConfirmation {
  tax: {
    saved: boolean;
    reason?: string | null;
  };
  octorate: {
    state: OctorateCheckInSendState;
    reason?: string | null;
    draft: boolean;
    /** Data already transmitted to the police changed: it may need a correction on the Alloggiati portal. */
    correctionAfterSend: boolean;
    guests: OctorateGuestSendResult[];
  };
  alloggiati: { step: CheckInAlloggiatiNextStep; sender: ComplianceSenderType };
  state: CheckInWizardState;
}

type DocumentReadingMethod = 'None' | 'Mrz' | 'Ocr';

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

export interface NoShowResult {
  bookingId: string;
  status: string;
  noShowAt?: string | null;
}

interface OrgTouristTaxRate {
  ratePerPersonPerNight: number;
  maxNights?: number | null;
  minimumAge: number;
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
  officialRateInForce: boolean;
  rate?: OrgTouristTaxRate | null;
}

export interface SaveMunicipalityRateRequest {
  ratePerPersonPerNight: number;
  maxNights?: number | null;
  minimumAge: number;
  seasonStart?: string | null;
  seasonEnd?: string | null;
  effectiveFrom?: string | null;
  sourceNote: string;
}

export interface GuestExemption {
  position: number;
  code: string | null;
}
