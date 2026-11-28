import { ApiClient } from './client';
import type { WelcomeConsentPayload, WelcomeConsentResult, WelcomeLink, WelcomePageData } from '@/types/welcome.types';

function linkPath(propertyId: string): string {
  return `/properties/${encodeURIComponent(propertyId)}/welcome-link`;
}

function publicPath(token: string): string {
  return `/public/welcome/${encodeURIComponent(token)}`;
}

export const welcomeApi = {
  getLink: (propertyId: string) => ApiClient.get<WelcomeLink>(linkPath(propertyId)),

  createLink: (propertyId: string) => ApiClient.post<WelcomeLink>(linkPath(propertyId)),

  rotateLink: (propertyId: string) => ApiClient.post<WelcomeLink>(`${linkPath(propertyId)}/rotate`),

  getPage: (token: string) => ApiClient.get<WelcomePageData>(publicPath(token), undefined, { public: true }),

  /**
   * The consent of the guest. 202 whatever was stored. 404 `welcome_link_invalid`; 422 `welcome_adult_required`, `welcome_channel_required`,
   * `welcome_email_invalid`, `welcome_phone_invalid`, `welcome_consent_unavailable`; 409 `welcome_consent_outdated` (the text changed since
   * the page was loaded); 429.
   */
  submitConsent: (token: string, payload: WelcomeConsentPayload) =>
    ApiClient.post<WelcomeConsentResult>(`${publicPath(token)}/consent`, payload, { public: true }),
};
