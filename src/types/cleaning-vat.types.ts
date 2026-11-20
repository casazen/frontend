/**
 * The question of the VAT of a cleaning recharged to the owner (FIX/BE-CLEANING-VAT, decision 4 of 20/11/2026): the contract of `GET` and `POST api/service-requests/{id}/cleaning-vat`. The agency answers one question
 * for each cleaning of a company recharged at its cost, «La ditta di pulizie ha applicato l'IVA su questa fattura?», and the answer decides the VAT of the recharge row of its invoice to the owner.
 *
 * The API writes the enums by name, the day as `yyyy-MM-dd` and the instants as UTC ISO strings. Nothing personal travels here: ids, the name of the company, a country, a day and rates.
 */

/** What the agency answers: the company applied VAT (at the rate of the day of the cleaning), applied none, or the agency does not know. */
export type CleaningVatAnswer = 'Applied' | 'NotApplied' | 'Unknown';

/**
 * The question of a completed cleaning (`GET api/service-requests/{id}/cleaning-vat`) and, after an answer, the same question with the answer in it (`POST`). It is read in the caller's organization and scope: a request of
 * another one is the 404 of one that does not exist. The console carries the members it shows or acts on; the ids of the property, of the stay and of the company (`propertyId`, `bookingId`, `supplierOrgId`), what the
 * organization remembers for the company (`companyAppliesVat`) and the instant of the answer (`answeredAt`) are in the answer of the API and nothing here needs them.
 */
export interface CleaningVatQuestion {
  /** The cleaning request: the id the «Da fare» `StateCleaningVat` carries. */
  serviceRequestId: string;
  /** The name of the cleaning company. */
  supplierName: string | null;
  /** The country of the cleaning (its property), whose VAT the question is about: `CH` or `IT`. */
  country: string;
  /** The day of the cleaning (`yyyy-MM-dd`), whose rate «Sì» uses. */
  cleaningDate: string;
  /** The rate of the button «Sì» (8.1 in Switzerland, 22 in Italy); `null` when the table has none for that day: «Sì» is refused. */
  standardRatePercent: number | null;
  /** The answer given for this cleaning; `null` while nobody answered. */
  answer: CleaningVatAnswer | null;
  /** The rate the answer «Sì» used. */
  answerRatePercent: number | null;
  /** What the invoice of the agency uses: the answer of this cleaning, else the company's remembered one; `null` when nothing is stated. */
  statedAnswer: CleaningVatAnswer | null;
  /** The rate of `statedAnswer` when it is «Sì». */
  statedRatePercent: number | null;
  /** Whether `statedAnswer` is the company's remembered answer and not the one of this cleaning. */
  statedByCompany: boolean;
  /** Whether the caller may tick «Ricorda per questa ditta»: only a caller of the whole organization (the answer decides the cleanings of every property). */
  canRemember: boolean;
}

/** The answer to send (`POST api/service-requests/{id}/cleaning-vat`): «Ricorda» is never `true` unless the person ticked it, and never with «Non lo so». */
export interface CleaningVatAnswerCommand {
  answer: CleaningVatAnswer;
  remember: boolean;
}
