import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { FiscalDocumentSettings, FiscalIssuerPreview, SaveFiscalDocumentSettingsRequest } from '@/types';
import { ApiClient } from './client';

const SETTINGS_PATH = '/fiscal/documents/settings';
const PREVIEW_PATH = '/fiscal/documents/issuer-preview';

/** A body that is not the setting (the SPA's `index.html` behind a wrong rewrite) is a load error, never an empty form. */
function ensureSettings(data: FiscalDocumentSettings | undefined): FiscalDocumentSettings {
  if (!data || typeof data !== 'object' || !data.issuer || !data.sdi || !Array.isArray(data.missingFields)) {
    throw new UnexpectedApiResponseError(SETTINGS_PATH);
  }
  return data;
}

/**
 * How the fiscal documents of the organization are issued (FIS-02, NF-82): who issues (`mode`, absent until the organization chooses), the
 * regime, the data of the issuer, what CasaZen may do in this environment (`casazenIssuanceEnabled`, `octorateConnected`, `sdi`) and what is
 * still missing for CasaZen to issue (`missingFields`). Always the setting of the caller's own organization.
 */
export async function getIssuerSettings(): Promise<FiscalDocumentSettings> {
  return ensureSettings(await ApiClient.get<FiscalDocumentSettings | undefined>(SETTINGS_PATH));
}

/**
 * Saves the answers of the wizard as a whole and answers with the setting as saved. 422 `issuer_field_invalid` (with the `field`),
 * `document_issuance_not_available` (CasaZen while the flag is off), `issuer_profile_incomplete` (with the `fields` that are missing) or
 * `octorate_not_connected`; 403 `fiscal_settings_need_whole_org` for a caller who reaches only some of the properties.
 */
export async function saveIssuerSettings(request: SaveFiscalDocumentSettingsRequest): Promise<FiscalDocumentSettings> {
  return ensureSettings(await ApiClient.put<FiscalDocumentSettings | undefined>(SETTINGS_PATH, request));
}

/** Who would issue the documents of a booking and why, as a stable code. It changes nothing. */
export async function getIssuerPreview(bookingId: string): Promise<FiscalIssuerPreview> {
  return ApiClient.get<FiscalIssuerPreview>(PREVIEW_PATH, { bookingId });
}
