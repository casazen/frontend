import { ApiClient } from './client';
import type {
  AdminAssistRequestDetail,
  AssistRequest,
  IstatCredentialsStatus,
  ReopenAssistRequest,
  RevealSupportVaultRequest,
  SetIstatCredentialsRequest,
  StoreSupportVaultSecretRequest,
  SupportVaultReveal,
  SupportVaultSecret,
} from '@/types/onboarding.types';

const assistUrl = (id: string) => `/admin/onboarding/assist-requests/${encodeURIComponent(id)}`;
const istatUrl = (propertyId: string) => `/properties/${encodeURIComponent(propertyId)}/istat-credentials`;

/**
 * What the support screens say to the «Do it for me» of CasaZen support (E20/F03/US01): the checklist of a request, the controlled opening of the support vault, the
 * credentials staff stores in it, the host's «Non funziona» and the regional ISTAT credentials of a property. The screens never call axios: they compose the hooks
 * of `src/queries`, which call these methods. The list, the update and the host's own requests are in `onboardingApi`.
 *
 * Every endpoint answers 404 while the backend flag `Features:OctorateOnboarding` is off (the web flag is `octorateOnboarding`). The staff ones are the platform
 * administrators' only (403 to anyone else); the host's ones are the organization administrator's (`OrgBillingAdmin`) and, for the ISTAT credentials, the property's
 * (`property.read` for the status, `property.write` to set or remove them).
 */
export const onboardingAssistApi = {
  /**
   * One request with the checklist of what support needs, per property (platform admin only): presence and dates, never a credential. 404
   * `assist_request_not_found`.
   */
  getRequestDetail: (id: string) => ApiClient.get<AdminAssistRequestDetail>(assistUrl(id)),

  /**
   * The controlled opening of the vault (platform admin only): the values of one credential, in clear, once, for an OPEN request of the same org and property, with a
   * reason of 10 to 300 characters; at most five a request an hour. The answer is the one place a value travels: it is never cached (`Cache-Control: no-store`) and
   * the caller shows it for a minute and drops it. 404 `assist_request_not_found`, `support_vault_secret_missing`; 409 `support_vault_request_not_open`; 422
   * `support_vault_kind_invalid`, `support_vault_kind_not_for_request`, `support_vault_reason_invalid`; 429 `support_vault_too_many_openings`.
   */
  revealSecret: (id: string, request: RevealSupportVaultRequest) => ApiClient.post<SupportVaultReveal>(`${assistUrl(id)}/reveal`, request),

  /**
   * Stores, or replaces, a credential of an org in the support vault (platform admin only); the answer is its presence, never the values. 404
   * `support_vault_org_not_found`, `property_not_found`; 422 `support_vault_kind_invalid`, `support_vault_value_invalid`.
   */
  storeVaultSecret: (request: StoreSupportVaultSecretRequest) => ApiClient.put<SupportVaultSecret>('/admin/onboarding/support-vault', request),

  reopenRequest: (id: string, note: string) =>
    ApiClient.post<AssistRequest>(`/onboarding/assist-requests/${encodeURIComponent(id)}/reopen`, { note } satisfies ReopenAssistRequest),

  /** Whether the property has ISTAT credentials, and since when (never the values). */
  getIstatCredentialsStatus: (propertyId: string) => ApiClient.get<IstatCredentialsStatus>(istatUrl(propertyId)),

  /** Sets or replaces the ISTAT credentials of the property: all the values that are asked, every time. The answer is the new status, never the values. */
  setIstatCredentials: (propertyId: string, data: SetIstatCredentialsRequest) => ApiClient.put<IstatCredentialsStatus>(istatUrl(propertyId), data),

  /** Removes the ISTAT credentials of the property (204, also when there were none). */
  removeIstatCredentials: (propertyId: string) => ApiClient.delete<void>(istatUrl(propertyId)),
};
