/**
 * The guest register of a property in Switzerland (E31/F02/US02/T01, NF-130, decision D12b, casazen/backend#979): the table of the guests of the stays that arrived in a period, which
 * the host keeps and shows to the police if asked. `GET api/properties/{id}/swiss/guest-register?from=&to=&format=csv` is the file; `GET …/guest-register/info?from=&to=` says before the
 * download how many lines it has. Both are behind `Features:GuestRegistrationRegimes` and ask `guest.read`. CasaZen never stores the file and gives no legal advice.
 */

export interface GuestRegisterPeriod {
  from: string;
  to: string;
}

export interface GuestRegisterInfo {
  propertyId: string;
  from: string;
  to: string;
  rowCount: number;
  retentionYears: number | null;
  regimeCode: string;
}
