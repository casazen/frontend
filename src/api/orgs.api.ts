import axios from '@/lib/axios';
import { ApiClient } from '@/api/client';
import type {
  BrandingImageKind,
  Entitlement,
  OrgBranding,
  OrgSettings,
  OrgSiteDocumentKind,
  OrgSiteDocumentState,
  OrgSiteDocumentVersion,
  OrgSlugAvailability,
  PlanCatalogEntry,
  PublishOrgSiteDocumentRequest,
  UpdateOrgBrandingRequest,
  UpdateOrgSettingsRequest,
} from '@/types';
import type { OrgServiceRequestSettings } from '@/types/service-request';

export const OrgsApi = {
  getPlans: (): Promise<PlanCatalogEntry[]> =>
    ApiClient.get<PlanCatalogEntry[]>('/orgs/plans'),

  getMyEntitlement: (): Promise<Entitlement> =>
    ApiClient.get<Entitlement>('/orgs/me/entitlement'),

  getSettings: (): Promise<OrgSettings> =>
    ApiClient.get<OrgSettings>('/orgs/me/settings'),

  updateSettings: (payload: UpdateOrgSettingsRequest): Promise<OrgSettings> =>
    ApiClient.put<OrgSettings>('/orgs/me/settings', payload),

  getServiceRequestSettings: (): Promise<OrgServiceRequestSettings> =>
    ApiClient.get<OrgServiceRequestSettings>('/orgs/me/service-request-settings'),

  updateServiceRequestSettings: (payload: OrgServiceRequestSettings): Promise<OrgServiceRequestSettings> =>
    ApiClient.put<OrgServiceRequestSettings>('/orgs/me/service-request-settings', payload),

  checkSlugAvailability: (slug: string): Promise<OrgSlugAvailability> =>
    ApiClient.get<OrgSlugAvailability>('/orgs/me/settings/slug-availability', { slug }),

  getBranding: (): Promise<OrgBranding> =>
    ApiClient.get<OrgBranding>('/orgs/me/branding'),

  updateBranding: (payload: UpdateOrgBrandingRequest): Promise<OrgBranding> =>
    ApiClient.put<OrgBranding>('/orgs/me/branding', payload),

  uploadBrandingImage: async (kind: BrandingImageKind, file: File): Promise<OrgBranding> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.put<OrgBranding>(`/orgs/me/branding/${kind}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  removeBrandingImage: (kind: BrandingImageKind): Promise<OrgBranding> =>
    ApiClient.delete<OrgBranding>(`/orgs/me/branding/${kind}`),

  getSiteDocuments: (): Promise<OrgSiteDocumentState[]> =>
    ApiClient.get<OrgSiteDocumentState[]>('/orgs/me/site-documents'),

  getSiteDocumentVersion: (kind: OrgSiteDocumentKind, version: number): Promise<OrgSiteDocumentVersion> =>
    ApiClient.get<OrgSiteDocumentVersion>(`/orgs/me/site-documents/${kind}/versions/${version}`),

  publishSiteDocument: (kind: OrgSiteDocumentKind, payload: PublishOrgSiteDocumentRequest): Promise<OrgSiteDocumentState> =>
    ApiClient.put<OrgSiteDocumentState>(`/orgs/me/site-documents/${kind}`, payload),

  withdrawSiteDocument: (kind: OrgSiteDocumentKind): Promise<OrgSiteDocumentState> =>
    ApiClient.delete<OrgSiteDocumentState>(`/orgs/me/site-documents/${kind}`),
};
