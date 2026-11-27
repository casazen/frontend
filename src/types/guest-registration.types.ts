/**
 * The registration of the guests of a property (E29/F02/US01/T01, NF-125, decisions D3, D5 and D12): what the place of the property asks of
 * whoever lodges guests, how sure the sources are, what CasaZen does for it and what the host decided. `GET` and `PUT
 * api/properties/{id}/guest-registration`, behind `Features:GuestRegistrationRegimes` (the key `guestRegistrationRegimes` of the flags).
 *
 * The enums are written by the member name (`Required`, `Ask`, `ReportToAuthority`...); a value this version does not know (the server is newer
 * than the app) is possible at run time, whatever the unions say, and the screens read it as a neutral line, never as the raw value.
 */
import type { SwissPlace } from './swiss-places.types';

/** What the law asks, as far as the sources say it. `Unknown` is the honest answer for a regime nobody read. */
export const GUEST_REGISTRATION_OBLIGATIONS = ['ReportToAuthority', 'KeepRegister', 'Optional', 'Unknown'] as const;
type GuestRegistrationObligation = (typeof GUEST_REGISTRATION_OBLIGATIONS)[number];

/** How the data reach the authority; `None` where nothing is transmitted (a register kept at home). */
export const GUEST_REGISTRATION_CHANNELS = ['PortalFileUpload', 'PortalForm', 'VendorInterface', 'EmailFile', 'Paper', 'None'] as const;
export type GuestRegistrationChannel = (typeof GUEST_REGISTRATION_CHANNELS)[number];

/** When the data are due; `None` where there is no deadline or the sources give none (the `deadlineNote` then says which). */
export const GUEST_REGISTRATION_DEADLINE_KINDS = ['Hours24FromArrival', 'DailyByTime', 'AtArrival', 'Weekly', 'None'] as const;
export type GuestRegistrationDeadlineKind = (typeof GUEST_REGISTRATION_DEADLINE_KINDS)[number];

/** Whether the rule covers who lets a private home: yes, in part, no, or the sources do not say. */
export const GUEST_REGISTRATION_PRIVATE_RENTALS = ['Yes', 'Partial', 'No', 'Unknown'] as const;
type GuestRegistrationPrivateRentals = (typeof GUEST_REGISTRATION_PRIVATE_RENTALS)[number];

/** How far the sources of a regime are to be trusted: read on an official source, reported by one that is not the authority, or not found. */
export const GUEST_REGISTRATION_CERTAINTIES = ['Verified', 'Partial', 'Unverified'] as const;
export type GuestRegistrationCertainty = (typeof GUEST_REGISTRATION_CERTAINTIES)[number];

/** What CasaZen does for a regime: the file for the portal, the register of the guests, the notification prepared for the host to make, or only the information. */
export const GUEST_REGISTRATION_SUPPORTS = ['FileExport', 'GuestRegister', 'AssistedNotification', 'InformationOnly'] as const;
type GuestRegistrationSupport = (typeof GUEST_REGISTRATION_SUPPORTS)[number];

/** What CasaZen treats as the duty of the property: raised, not raised, or left to the host (`Ask`, nothing in red). */
export const GUEST_REGISTRATION_DUTIES = ['Required', 'NotRequired', 'Ask'] as const;
export type GuestRegistrationDuty = (typeof GUEST_REGISTRATION_DUTIES)[number];

/** The host's own setting: `Required` or `NotRequired`; `null` follows the regime. */
export type GuestNotificationOverride = 'Required' | 'NotRequired';

/**
 * The id of the activation step of a Swiss property that holds the card (backend `PropertyComplianceStatusService.GuestRegistrationStepId`). It is also the `code`
 * of every item of the onboarding part «Guest registration»: where the wizard is reopened.
 */
export const GUEST_REGISTRATION_STEP_ID = 'guest-registration';

/**
 * What a property still lacks to be notified, as the stable reason codes of the backend (`GuestRegistrationReadiness`): the municipality (so the canton)
 * is not known, and a property of Ticino has no structure number. The same codes name the blockers of the activation step `guest-registration` and the
 * items of the onboarding part.
 */
export const GUEST_REGISTRATION_MISSING_CODES = ['swiss_municipality_missing', 'ticino_structure_id_missing'] as const;
export type GuestRegistrationMissingCode = (typeof GUEST_REGISTRATION_MISSING_CODES)[number];

/**
 * One regime as the card reads it: the same fields as the catalog of the backend, with the sentences already in the language of the request. `summary`
 * says what the rule is and what CasaZen does; `deadlineNote` says what the deadline is when its kind alone does not. `portalUrl` is the official portal
 * of the authority (https), `null` where there is none; `verifiedOn` is the day the entry was read on its sources (`yyyy-MM-dd`).
 */
export interface GuestRegistrationRegime {
  /** `IT`, `CH-<canton>` or `CH-UNKNOWN`. */
  code: string;
  countryCode: string;
  /** The two letters of the canton; `null` for Italy and for `CH-UNKNOWN`. */
  cantonCode: string | null;
  obligation: GuestRegistrationObligation;
  channel: GuestRegistrationChannel;
  deadlineKind: GuestRegistrationDeadlineKind;
  deadlineNote: string | null;
  /** The years the host keeps the data; `null` when the sources give no number for the host. */
  retentionYears: number | null;
  privateRentals: GuestRegistrationPrivateRentals;
  portalUrl: string | null;
  verifiedOn: string;
  certainty: GuestRegistrationCertainty;
  casaZenSupport: GuestRegistrationSupport;
  /** CasaZen keeps the photograph of the identity document: `false` for every Swiss regime. */
  retainDocumentImages: boolean;
  summary: string;
}

/** `GET api/properties/{id}/guest-registration`: the regime of the place of the property, the duty in effect, the host's setting and what is missing. */
export interface GuestRegistration {
  /** `null` only outside Italy and Switzerland, where the API answers 422 instead. */
  regime: GuestRegistrationRegime | null;
  effectiveDuty: GuestRegistrationDuty;
  /** The host's setting; `null` follows the regime. */
  override: GuestNotificationOverride | null;
  /** Where the one resolver puts a Swiss property; `null` outside Switzerland. */
  place: SwissPlace | null;
  /** The reasons the property cannot be notified yet (`GuestRegistrationMissingCode`); empty when nothing is missing. */
  identifierMissing: string[];
}

/** Body of `PUT api/properties/{id}/guest-registration`: the member must be there, and `null` says «follow the regime» (a body without it is a 400). */
export interface UpdateGuestRegistrationRequest {
  override: GuestNotificationOverride | null;
}
