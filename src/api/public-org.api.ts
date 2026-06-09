import { ApiClient } from './client';
import type { PublicOrgDto, PublicPropertyDetailDto, PublicPropertyDto } from '@/types';

export const publicOrgApi = {
  getPublicOrg: (slug: string) => ApiClient.get<PublicOrgDto>(`/public/orgs/${slug}`),

  getOrgProperties: (slug: string) =>
    ApiClient.get<PublicPropertyDto[]>(`/public/orgs/${slug}/properties`),

  getOrgProperty: (slug: string, propertyId: string) =>
    ApiClient.get<PublicPropertyDetailDto>(`/public/orgs/${slug}/properties/${propertyId}`),
};
