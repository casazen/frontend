import { ApiClient } from './client';
import type { GuestDataExport, GuestPrivacySummary } from '@/types';

export const gdprApi = {
  /** Consents with their versions, retention per category and status of the guest's data (CO-15). */
  getSummary: (guestId: string) => ApiClient.get<GuestPrivacySummary>(`/gdpr/guests/${guestId}`),

  /** Complete, versioned export (art. 15 and 20 GDPR), identity document in clear: audited by the API. */
  exportData: (guestId: string) => ApiClient.get<GuestDataExport>(`/gdpr/guests/${guestId}/export`),

  deleteData: (guestId: string, reason: string) =>
    ApiClient.delete(`/gdpr/guests/${guestId}?reason=${encodeURIComponent(reason)}`),

  anonymizeData: (guestId: string) =>
    ApiClient.post(`/gdpr/guests/${guestId}/anonymize`),

  /**
   * Withdraws the marketing consent on the guest's documented request (`note`: date and channel). The host can never
   * grant it: only the guest does, on the check-in portal (the API answers 422 to a grant).
   */
  withdrawMarketingConsent: (guestId: string, note: string) =>
    ApiClient.put(`/gdpr/guests/${guestId}/consent`, { marketingConsent: false, note }),

  exportOrgFiscal: () => ApiClient.get('/gdpr/org/export'),

  anonymizeOrgFiscal: () => ApiClient.post('/gdpr/org/anonymize'),
};
