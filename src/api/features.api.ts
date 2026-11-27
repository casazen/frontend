import { ApiClient } from './client';

export const featuresApi = {
  getFeatures: () => ApiClient.get<unknown>('/public/features', undefined, { public: true }),
};
