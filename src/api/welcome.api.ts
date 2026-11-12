import { ApiClient } from './client';
import type { WelcomeConsentPayload, WelcomeConsentResult, WelcomeLink, WelcomePageData } from '@/types/welcome.types';

function linkPath(propertyId: string): string {
  return `/properties/${encodeURIComponent(propertyId)}/welcome-link`;
}

function publicPath(token: string): string {
  return `/public/welcome/${encodeURIComponent(token)}`;
}

/**
 * The welcome page of a property, behind the QR code in the house (E07/F04/US01/T03, NF-90, CRM-03). Two sides:
 * - the host's (`/properties/{id}/welcome-link`, permission `property.write`, behind the CRM flag: 404 while it is off): read, make and
 *   replace the link, the address that goes in the QR;
 * - the guest's (`/public/welcome/{token}`): anonymous, so no access token is sent; the random token of the link is the only proof and an
 *   unknown token and a revoked one are the same 404 `welcome_link_invalid`. It is not behind the flag: a code already printed keeps working.
 */
export const welcomeApi = {
  /** The active link of the property, or `{ active: false }`. 404 `property_not_found`; 403. */
  getLink: (propertyId: string) => ApiClient.get<WelcomeLink>(linkPath(propertyId)),

  /** Makes the link, or answers the one the property already has (it never changes the code of a link that exists). */
  createLink: (propertyId: string) => ApiClient.post<WelcomeLink>(linkPath(propertyId)),

  /** Replaces the code: the old link is revoked at once, so the QR printed with it stops working. */
  rotateLink: (propertyId: string) => ApiClient.post<WelcomeLink>(`${linkPath(propertyId)}/rotate`),

  /** What the page shows. 404 `welcome_link_invalid` for an unknown or revoked token; 429. */
  getPage: (token: string) => ApiClient.get<WelcomePageData>(publicPath(token), undefined, { public: true }),

  /**
   * The consent of the guest. 202 whatever was stored. 404 `welcome_link_invalid`; 422 `welcome_adult_required`, `welcome_channel_required`,
   * `welcome_email_invalid`, `welcome_phone_invalid`, `welcome_consent_unavailable`; 409 `welcome_consent_outdated` (the text changed since
   * the page was loaded); 429.
   */
  submitConsent: (token: string, payload: WelcomeConsentPayload) =>
    ApiClient.post<WelcomeConsentResult>(`${publicPath(token)}/consent`, payload, { public: true }),
};
