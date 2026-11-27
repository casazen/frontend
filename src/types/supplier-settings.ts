export interface SupplierSettings {
  onlineBookingEnabled: boolean;
  autoAcceptRegulars: boolean;
  notifyNewRequests: boolean;
  notifyDayBeforeReminder: boolean;
  notifyPayments: boolean;
  respondWithinMinutes: number;
}

export type SupplierSettingsInput = Omit<SupplierSettings, 'onlineBookingEnabled'>;
