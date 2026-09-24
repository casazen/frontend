import { ApiClient } from './client';

export const featuresApi = {
  /** Anonymous: `{ "otaPartnerApi": false, ... }` (backend `PublicFeaturesController`). */
  getFeatures: () => ApiClient.get<unknown>('/public/features', undefined, { public: true }),
};
