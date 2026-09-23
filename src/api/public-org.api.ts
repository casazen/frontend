import { ApiClient } from './client';
import type { PublicOrgDto, PublicPropertyDetailDto, PublicPropertyDto } from '@/types';

export const publicOrgApi = {
  getPublicOrg: (slug: string) =>
    ApiClient.get<PublicOrgDto>(`/public/orgs/${slug}`, undefined, { public: true }),

  getOrgProperties: (slug: string) =>
    ApiClient.get<PublicPropertyDto[]>(`/public/orgs/${slug}/properties`, undefined, { public: true }),

  getOrgProperty: (slug: string, propertyId: string) =>
    ApiClient.get<PublicPropertyDetailDto>(`/public/orgs/${slug}/properties/${propertyId}`, undefined, {
      public: true,
    }),
};
