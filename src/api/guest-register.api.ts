import { ApiClient } from './client';
import { fileApi, type DownloadedFile } from './file.api';
import type { GuestRegisterInfo, GuestRegisterPeriod } from '@/types/guest-register.types';

const registerPath = (propertyId: string) => `/properties/${encodeURIComponent(propertyId)}/swiss/guest-register`;

/**
 * The guest register of a property in Switzerland (E31/F02/US02/T01, NF-130): the table of the guests of the stays that arrived in a period. Both calls are behind
 * `Features:GuestRegistrationRegimes` (404 `not_found` while it is off), ask `guest.read` and answer `private, no-store`: another org's property is a 404 `property_not_found`, a property
 * that is not in Switzerland a 404 `guest_register_not_available`, a period that is not a period (the end before the start, more than 366 days) a 400 `swiss_period_invalid` or
 * `swiss_period_too_long`.
 */
export const guestRegisterApi = {
  /** What the register of the period holds before it is downloaded: how many lines, how long the host keeps it, the regime. No file is made and no guest is in the answer. */
  getInfo: (propertyId: string, period: GuestRegisterPeriod) => ApiClient.get<GuestRegisterInfo>(`${registerPath(propertyId)}/info`, { from: period.from, to: period.to }),

  /**
   * The file: the CSV of the register (UTF-8 with its byte order mark, `;`, one header line, an empty signature column), in the language of the page (`Accept-Language`: the API writes
   * the header and the words of the file in the language of the request). Bytes, never JSON: it holds guest data, so the caller saves it and lets it go. A refusal is a JSON problem
   * (the body of a blob is read before it is thrown).
   */
  download: (propertyId: string, period: GuestRegisterPeriod, language: string): Promise<DownloadedFile> =>
    fileApi.get(registerPath(propertyId), { from: period.from, to: period.to, format: 'csv' }, { 'Accept-Language': language }),
};
