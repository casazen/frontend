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

export const OrgsApi = {
  getPlans: (): Promise<PlanCatalogEntry[]> =>
    ApiClient.get<PlanCatalogEntry[]>('/orgs/plans'),

  getMyEntitlement: (): Promise<Entitlement> =>
    ApiClient.get<Entitlement>('/orgs/me/entitlement'),

  /** A1-22, A1-23: name, public slug and contact email opt-in. Org billing admin only. */
  getSettings: (): Promise<OrgSettings> =>
    ApiClient.get<OrgSettings>('/orgs/me/settings'),

  updateSettings: (payload: UpdateOrgSettingsRequest): Promise<OrgSettings> =>
    ApiClient.put<OrgSettings>('/orgs/me/settings', payload),

  /** A1-23: whether a slug can become the org's public address (advisory: the PUT checks again). */
  checkSlugAvailability: (slug: string): Promise<OrgSlugAvailability> =>
    ApiClient.get<OrgSlugAvailability>('/orgs/me/settings/slug-availability', { slug }),

  /** BK-12: public-site branding (logo, hero, color, tagline, theme). Org billing admin only. */
  getBranding: (): Promise<OrgBranding> =>
    ApiClient.get<OrgBranding>('/orgs/me/branding'),

  updateBranding: (payload: UpdateOrgBrandingRequest): Promise<OrgBranding> =>
    ApiClient.put<OrgBranding>('/orgs/me/branding', payload),

  /** Multipart field `file`; the backend checks type, size and pixel dimensions from the bytes. */
  uploadBrandingImage: async (kind: BrandingImageKind, file: File): Promise<OrgBranding> => {
    const formData = new FormData();
    formData.append('file', file);
    // Explicit multipart: the client's default JSON content type would serialize the FormData as JSON.
    const response = await axios.put<OrgBranding>(`/orgs/me/branding/${kind}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  removeBrandingImage: (kind: BrandingImageKind): Promise<OrgBranding> =>
    ApiClient.delete<OrgBranding>(`/orgs/me/branding/${kind}`),

  /** BK-14: the operator's privacy notice and booking terms (state of both kinds). Org billing admin only. */
  getSiteDocuments: (): Promise<OrgSiteDocumentState[]> =>
    ApiClient.get<OrgSiteDocumentState[]>('/orgs/me/site-documents'),

  /** One version with its text, to read it or start the next one from it. */
  getSiteDocumentVersion: (kind: OrgSiteDocumentKind, version: number): Promise<OrgSiteDocumentVersion> =>
    ApiClient.get<OrgSiteDocumentVersion>(`/orgs/me/site-documents/${kind}/versions/${version}`),

  /** Publishes a new version (shown right away). */
  publishSiteDocument: (kind: OrgSiteDocumentKind, payload: PublishOrgSiteDocumentRequest): Promise<OrgSiteDocumentState> =>
    ApiClient.put<OrgSiteDocumentState>(`/orgs/me/site-documents/${kind}`, payload),

  /** Stops showing the current version: the public site says the operator has not published it. */
  withdrawSiteDocument: (kind: OrgSiteDocumentKind): Promise<OrgSiteDocumentState> =>
    ApiClient.delete<OrgSiteDocumentState>(`/orgs/me/site-documents/${kind}`),
};
