import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import type { FiscalDocumentSettings } from '@/types';

/** The user and the organization the draft of the wizard belongs to (the tests mock `useCurrentUser` with the same ones). */
export const SCOPE = { userId: 'user-1', orgId: 'org-1' };

/** The name of the organization, from which the name on the documents starts. */
export const ORG_NAME = 'Casa Mia Srl';

/**
 * `GET api/fiscal/documents/settings` as an organization that has chosen nothing yet gets it: CasaZen can issue, the channel manager is not
 * connected, the SDI has no channel, and the tax profile has neither a VAT number nor a fiscal code.
 */
export function settings(overrides: Partial<FiscalDocumentSettings> = {}): FiscalDocumentSettings {
  return {
    issuer: { countryCode: 'IT' },
    casazenIssuanceEnabled: true,
    octorateIssuesAllBookings: false,
    octorateConnected: false,
    sdi: { providerConfigured: false },
    missingFields: ['legalName', 'addressStreet', 'postalCode', 'city', 'province', 'regime', 'fiscalCode'],
    ...overrides,
  };
}

/** A setting CasaZen could issue with: complete data of a private person, as the server would have saved it. */
export function completedSetting(overrides: Partial<FiscalDocumentSettings> = {}): FiscalDocumentSettings {
  return settings({
    mode: 'CasaZenDirectOnly',
    regime: 'PrivatePerson',
    confirmedAt: '2026-11-01T10:00:00Z',
    issuer: {
      legalName: 'Mario Rossi',
      addressStreet: 'Via Roma',
      addressCivic: '12',
      postalCode: '20121',
      city: 'Milano',
      province: 'MI',
      countryCode: 'IT',
      fiscalCode: 'RSSMRA80A01H501U',
    },
    missingFields: [],
    ...overrides,
  });
}

/** The error of a request the server refused, as axios builds it (the code is what the app reads). */
export function problem(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}
