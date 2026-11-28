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
  serviceRequestId: string;
  supplierName: string | null;
  /** The country of the cleaning (its property), whose VAT the question is about: `CH` or `IT`. */
  country: string;
  cleaningDate: string;
  standardRatePercent: number | null;
  answer: CleaningVatAnswer | null;
  answerRatePercent: number | null;
  statedAnswer: CleaningVatAnswer | null;
  statedRatePercent: number | null;
  statedByCompany: boolean;
  canRemember: boolean;
}

/** The answer to send (`POST api/service-requests/{id}/cleaning-vat`): «Ricorda» is never `true` unless the person ticked it, and never with «Non lo so». */
export interface CleaningVatAnswerCommand {
  answer: CleaningVatAnswer;
  remember: boolean;
}
