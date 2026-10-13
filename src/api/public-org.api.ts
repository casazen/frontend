import { ApiClient } from './client';
import type { OrgSiteDocumentKind, PublicOrgDocument, PublicOrgDto, PublicPropertyDetailDto, PublicPropertyDto } from '@/types';

export const publicOrgApi = {
  getPublicOrg: (slug: string) =>
    ApiClient.get<PublicOrgDto>(`/public/orgs/${slug}`, undefined, { public: true }),

  getOrgProperties: (slug: string) =>
    ApiClient.get<PublicPropertyDto[]>(`/public/orgs/${slug}/properties`, undefined, { public: true }),

  getOrgProperty: (slug: string, propertyId: string) =>
    ApiClient.get<PublicPropertyDetailDto>(`/public/orgs/${slug}/properties/${propertyId}`, undefined, {
      public: true,
    }),

  /** BK-14: the operator's privacy notice or terms; `published: false` when the operator has not published it. */
  getOrgDocument: (slug: string, kind: OrgSiteDocumentKind) =>
    ApiClient.get<PublicOrgDocument>(`/public/orgs/${slug}/documents/${kind}`, undefined, { public: true }),
};
