/**
 * The steps of the stays of the organization (casazen/backend#978): which ones CasaZen does by itself and which ones the host does. Mirrors the backend DTOs of
 * `Casazen.Web/DTOs/BookingFlowSettingsDtos.cs` (`GET/PUT api/settings/booking-flow`), enums by name.
 */

/** Who does a step: CasaZen by itself, or the host. */
export type BookingFlowMode = 'Automatic' | 'Manual';

/** When CasaZen declares the property ready for the next guest: when the cleaning of the stay is done, or at the check-out. */
export type PropertyReadyTrigger = 'CleaningDone' | 'CheckOut';

export interface BookingFlowSettings {
  /** The online check-in link. */
  checkInLinkMode: BookingFlowMode;
  /** Days before the arrival the link goes, when automatic (0 = the arrival day). */
  checkInLinkDaysBefore: number;
  /** The most days allowed: the life of a link, so that it is still open on the arrival day. */
  maxCheckInLinkDaysBefore: number;
  /** The arrival: registered once the arrival day is over, unless the host marked a no-show. */
  arrivalMode: BookingFlowMode;
  /** The departure: registered at the check-out time of the property. */
  departureMode: BookingFlowMode;
  /** The property ready for the next guest. */
  propertyReadyMode: BookingFlowMode;
  propertyReadyTrigger: PropertyReadyTrigger;
  /** The organization never saved its settings: these are the defaults (every step automatic). */
  isDefault: boolean;
}

/** What the organization administrator sends: a member left out keeps its value. */
export type UpdateBookingFlowSettingsRequest = Partial<Omit<BookingFlowSettings, 'maxCheckInLinkDaysBefore' | 'isDefault'>>;
