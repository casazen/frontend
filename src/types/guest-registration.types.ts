/**
 * The registration of the guests of a property (E29/F02/US01/T01, NF-125, decisions D3, D5 and D12): what the place of the property asks of
 * whoever lodges guests, how sure the sources are, what CasaZen does for it and what the host decided. `GET` and `PUT
 * api/properties/{id}/guest-registration`, behind `Features:GuestRegistrationRegimes` (the key `guestRegistrationRegimes` of the flags).
 *
 * The enums are written by the member name (`Required`, `Ask`, `ReportToAuthority`...); a value this version does not know (the server is newer
 * than the app) is possible at run time, whatever the unions say, and the screens read it as a neutral line, never as the raw value.
 */
import type { SwissPlace } from './swiss-places.types';

export const GUEST_REGISTRATION_OBLIGATIONS = ['ReportToAuthority', 'KeepRegister', 'Optional', 'Unknown'] as const;
type GuestRegistrationObligation = (typeof GUEST_REGISTRATION_OBLIGATIONS)[number];

export const GUEST_REGISTRATION_CHANNELS = ['PortalFileUpload', 'PortalForm', 'VendorInterface', 'EmailFile', 'Paper', 'None'] as const;
export type GuestRegistrationChannel = (typeof GUEST_REGISTRATION_CHANNELS)[number];

export const GUEST_REGISTRATION_DEADLINE_KINDS = ['Hours24FromArrival', 'DailyByTime', 'AtArrival', 'Weekly', 'None'] as const;
export type GuestRegistrationDeadlineKind = (typeof GUEST_REGISTRATION_DEADLINE_KINDS)[number];

export const GUEST_REGISTRATION_PRIVATE_RENTALS = ['Yes', 'Partial', 'No', 'Unknown'] as const;
type GuestRegistrationPrivateRentals = (typeof GUEST_REGISTRATION_PRIVATE_RENTALS)[number];

export const GUEST_REGISTRATION_CERTAINTIES = ['Verified', 'Partial', 'Unverified'] as const;
export type GuestRegistrationCertainty = (typeof GUEST_REGISTRATION_CERTAINTIES)[number];

export const GUEST_REGISTRATION_SUPPORTS = ['FileExport', 'GuestRegister', 'AssistedNotification', 'InformationOnly'] as const;
type GuestRegistrationSupport = (typeof GUEST_REGISTRATION_SUPPORTS)[number];

export const GUEST_REGISTRATION_DUTIES = ['Required', 'NotRequired', 'Ask'] as const;
export type GuestRegistrationDuty = (typeof GUEST_REGISTRATION_DUTIES)[number];

export type GuestNotificationOverride = 'Required' | 'NotRequired';

export const GUEST_REGISTRATION_STEP_ID = 'guest-registration';

export const GUEST_REGISTRATION_MISSING_CODES = ['swiss_municipality_missing', 'ticino_structure_id_missing'] as const;
export type GuestRegistrationMissingCode = (typeof GUEST_REGISTRATION_MISSING_CODES)[number];

export interface GuestRegistrationRegime {
  code: string;
  countryCode: string;
  cantonCode: string | null;
  obligation: GuestRegistrationObligation;
  channel: GuestRegistrationChannel;
  deadlineKind: GuestRegistrationDeadlineKind;
  deadlineNote: string | null;
  retentionYears: number | null;
  privateRentals: GuestRegistrationPrivateRentals;
  portalUrl: string | null;
  verifiedOn: string;
  certainty: GuestRegistrationCertainty;
  casaZenSupport: GuestRegistrationSupport;
  retainDocumentImages: boolean;
  summary: string;
}

export interface GuestRegistration {
  regime: GuestRegistrationRegime | null;
  effectiveDuty: GuestRegistrationDuty;
  override: GuestNotificationOverride | null;
  place: SwissPlace | null;
  identifierMissing: string[];
}

export interface UpdateGuestRegistrationRequest {
  override: GuestNotificationOverride | null;
}
