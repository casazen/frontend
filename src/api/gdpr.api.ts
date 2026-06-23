import { ApiClient } from './client';

export const gdprApi = {
  exportData: (guestId: string) =>
    ApiClient.get(`/gdpr/guests/${guestId}/export`),

  deleteData: (guestId: string, reason: string) =>
    ApiClient.delete(`/gdpr/guests/${guestId}?reason=${encodeURIComponent(reason)}`),

  anonymizeData: (guestId: string) =>
    ApiClient.post(`/gdpr/guests/${guestId}/anonymize`),

  updateConsent: (guestId: string, marketingConsent: boolean) =>
    ApiClient.put(`/gdpr/guests/${guestId}/consent`, { marketingConsent }),
};
