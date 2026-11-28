import { AxiosError } from 'axios';
import axios, { handleAccountStateForbidden } from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { acceptsRefusal } from './accept-refusal';
import type { CleaningVatAnswer, CleaningVatAnswerCommand, CleaningVatQuestion } from '@/types';

const ANSWERS: readonly CleaningVatAnswer[] = ['Applied', 'NotApplied', 'Unknown'];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const textOf = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);

const rateOf = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null);

const isAnswer = (value: unknown): value is CleaningVatAnswer => ANSWERS.includes(value as CleaningVatAnswer);

function questionOf(data: unknown, path: string): CleaningVatQuestion {
  if (!isRecord(data)) throw new UnexpectedApiResponseError(path);
  const serviceRequestId = textOf(data.serviceRequestId);
  const country = textOf(data.country);
  const cleaningDate = textOf(data.cleaningDate);
  if (!serviceRequestId || !country || !cleaningDate || !DAY.test(cleaningDate)) throw new UnexpectedApiResponseError(path);
  for (const answer of [data.answer, data.statedAnswer]) {
    if (answer !== null && answer !== undefined && !isAnswer(answer)) throw new UnexpectedApiResponseError(path);
  }

  return {
    serviceRequestId,
    supplierName: textOf(data.supplierName),
    country,
    cleaningDate,
    standardRatePercent: rateOf(data.standardRatePercent),
    answer: isAnswer(data.answer) ? data.answer : null,
    answerRatePercent: rateOf(data.answerRatePercent),
    statedAnswer: isAnswer(data.statedAnswer) ? data.statedAnswer : null,
    statedRatePercent: rateOf(data.statedRatePercent),
    statedByCompany: data.statedByCompany === true,
    canRemember: data.canRemember === true,
  };
}

const pathOf = (requestId: string) => `/service-requests/${encodeURIComponent(requestId)}/cleaning-vat`;

/**
 * The question of the VAT of a cleaning recharged to the owner (FIX/BE-CLEANING-VAT, decision 4 of 20/11/2026). Paths are relative to the API base URL, which already ends in `/api`. There is no flag: both calls exist
 * for the callers who may reach the property of the request. A request of another organization, of a property out of reach or of another category is the 404 `service_request_not_found` of one that does not exist.
 */
export const cleaningVatApi = {
  /**
   * The question of a completed cleaning request (`property.read` on its property): the country, the rate of «Sì» (`null` when the table has none for that day), the answer given, what the invoice uses and whether the
   * caller may remember. `null` when the server refuses it to this caller (403), which the dialog tells instead of the whole app going to the page of no access. Two 403 are not that refusal: the one of an account that was
   * deactivated and the one of a host who has not finished the onboarding. The interceptor of the client only sees the rejected responses, so the handler of their own page is run from here and the read fails like any other
   * (the person is on their way to that page).
   */
  get: async (requestId: string): Promise<CleaningVatQuestion | null> => {
    const path = pathOf(requestId);
    const response = await axios.get<unknown>(path, { validateStatus: acceptsRefusal });
    if (response.status === 403) {
      if (handleAccountStateForbidden(response.data)) {
        throw new AxiosError('Request failed with status code 403', AxiosError.ERR_BAD_REQUEST, response.config, response.request, response);
      }
      return null;
    }
    if (response.status !== 200) throw new UnexpectedApiResponseError(path);
    return questionOf(response.data, path);
  },

  /**
   * The answer (`property.write`), `{ answer, remember }` and nothing else: stored on the request, kept for the company with `remember` (only a caller of the whole organization: 403 `cleaning_vat_remember_forbidden`;
   * never with «Non lo so»: 422 `cleaning_vat_remember_unknown`), and the «Da fare» of the request closed. The same answer again changes nothing; another one replaces it. Answers the question with the answer in it. 404
   * `service_request_not_found`; 403; 409 `service_request_state_changed`; 422 `cleaning_vat_answer_invalid`, `cleaning_vat_not_completed`, `cleaning_vat_rate_unknown`, `cleaning_vat_remember_unknown`.
   *
   * It is a success only when the server says so and says what it stored: the 200 of the endpoint with the question and the answer that was sent. Anything else (another status, a body that is not the question, another
   * answer in it) is a call whose outcome is not known: it fails, and the person is asked to try again, which is safe because the same answer again changes nothing.
   */
  answer: async (requestId: string, command: CleaningVatAnswerCommand): Promise<CleaningVatQuestion> => {
    const path = pathOf(requestId);
    const response = await axios.post<unknown>(path, { answer: command.answer, remember: command.remember });
    if (response.status !== 200) throw new UnexpectedApiResponseError(path);
    const question = questionOf(response.data, path);
    if (question.answer !== command.answer) throw new UnexpectedApiResponseError(path);
    return question;
  },
};
