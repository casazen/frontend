import { ApiClient } from './client';
import { fileApi, type DownloadedFile } from './file.api';
import type { GuestRegisterInfo, GuestRegisterPeriod } from '@/types/guest-register.types';

const registerPath = (propertyId: string) => `/properties/${encodeURIComponent(propertyId)}/swiss/guest-register`;

export const guestRegisterApi = {
  getInfo: (propertyId: string, period: GuestRegisterPeriod) => ApiClient.get<GuestRegisterInfo>(`${registerPath(propertyId)}/info`, { from: period.from, to: period.to }),

  /**
   * The file: the CSV of the register (UTF-8 with its byte order mark, `;`, one header line, an empty signature column), in the language of the page (`Accept-Language`: the API writes
   * the header and the words of the file in the language of the request). Bytes, never JSON: it holds guest data, so the caller saves it and lets it go. A refusal is a JSON problem
   * (the body of a blob is read before it is thrown).
   */
  download: (propertyId: string, period: GuestRegisterPeriod, language: string): Promise<DownloadedFile> =>
    fileApi.get(registerPath(propertyId), { from: period.from, to: period.to, format: 'csv' }, { 'Accept-Language': language }),
};
