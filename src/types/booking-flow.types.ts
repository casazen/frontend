export type BookingFlowMode = 'Automatic' | 'Manual';

export type PropertyReadyTrigger = 'CleaningDone' | 'CheckOut';

export interface BookingFlowSettings {
  checkInLinkMode: BookingFlowMode;
  checkInLinkDaysBefore: number;
  /** The most days allowed: the life of a link, so that it is still open on the arrival day. */
  maxCheckInLinkDaysBefore: number;
  /** The arrival: registered once the arrival day is over, unless the host marked a no-show. */
  arrivalMode: BookingFlowMode;
  departureMode: BookingFlowMode;
  propertyReadyMode: BookingFlowMode;
  propertyReadyTrigger: PropertyReadyTrigger;
  isDefault: boolean;
}

export type UpdateBookingFlowSettingsRequest = Partial<Omit<BookingFlowSettings, 'maxCheckInLinkDaysBefore' | 'isDefault'>>;
