/**
 * The guest register of a property in Switzerland (E31/F02/US02/T01, NF-130, decision D12b, casazen/backend#979): the table of the guests of the stays that arrived in a period, which
 * the host keeps and shows to the police if asked. `GET api/properties/{id}/swiss/guest-register?from=&to=&format=csv` is the file; `GET …/guest-register/info?from=&to=` says before the
 * download how many lines it has. Both are behind `Features:GuestRegistrationRegimes` and ask `guest.read`. CasaZen never stores the file and gives no legal advice.
 */

/** The first and the last day of the period, both included, by arrival day (`yyyy-MM-dd`): at most 366 days. */
export interface GuestRegisterPeriod {
  from: string;
  to: string;
}

/** What the register of a period holds, before it is downloaded: counts, a number of years and a code, no guest. */
export interface GuestRegisterInfo {
  propertyId: string;
  from: string;
  to: string;
  /** The lines of the register, the header not counted: the guests, adults and minors, of the stays that arrived in the period. */
  rowCount: number;
  /** How many years the regime of the property asks the host to keep the register; `null` when the sources do not say. */
  retentionYears: number | null;
  /** The regime of the property: `CH-TI`, `CH-ZH`… or `CH-UNKNOWN` while its municipality is not known. */
  regimeCode: string;
}
