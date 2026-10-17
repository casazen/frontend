/** The settings of the supplier (`GET /supplier/settings`, SP-16a). */
export interface SupplierSettings {
  /** Whether the public showcase takes bookings. Read-only: the showcase editor is the only place that changes it (SP-D29). */
  onlineBookingEnabled: boolean;
  /** The requests of the regular hosts (three jobs taken) are accepted by the server (SP-04d). Off for everybody by default. */
  autoAcceptRegulars: boolean;
  notifyNewRequests: boolean;
  notifyDayBeforeReminder: boolean;
  notifyPayments: boolean;
  /** Minutes a customer of the public showcase waits for an answer (15 to 10080). */
  respondWithinMinutes: number;
}

/** What `PUT /supplier/settings` takes: all five settings (one that is left out is a 422), never `onlineBookingEnabled`. */
export type SupplierSettingsInput = Omit<SupplierSettings, 'onlineBookingEnabled'>;
