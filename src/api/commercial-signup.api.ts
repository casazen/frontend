import { ApiClient } from '@/api/client';
import type { CommercialAddon } from '@/features/onboarding/commercial-model';
export const CommercialSignupApi = {
  getCatalog: () => ApiClient.get<CommercialAddon[]>('/billing/commercial-catalog'),
};
