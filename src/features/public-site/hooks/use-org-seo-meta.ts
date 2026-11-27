import { useTranslation } from 'react-i18next';
import { truncateDescription, useSeoMeta } from '@/lib/seo-meta';
import type { PublicOrgDto, PublicPropertyDetailDto } from '@/types';

function httpsImage(url: string | null | undefined): string | null {
  return url?.startsWith('https://') ? url : null;
}

export type OrgSitePage = 'landing' | 'property' | 'other';

export function classifyOrgSitePage(pathname: string): OrgSitePage {
  const rest = pathname.split('/').filter(Boolean).slice(2);
  if (rest.length === 0) return 'landing';
  if (rest.length === 2 && rest[0] === 'property') return 'property';
  return 'other';
}

export function useOrgSeoMeta(org: PublicOrgDto | undefined, pathname: string) {
  const { t } = useTranslation();
  const page = classifyOrgSitePage(pathname);

  useSeoMeta(
    !org || page === 'property'
      ? null
      : {
          title: t('publicSite.seo.orgTitle', { name: org.displayName }),
          description: truncateDescription(org.tagline) || t('publicSite.seo.orgDescription', { name: org.displayName }),
          canonicalUrl: page === 'landing' ? org.canonicalUrl : null,
          imageUrl: httpsImage(org.logoUrl) ?? httpsImage(org.heroImageUrl),
          noindex: page === 'other',
        },
  );
}

export function usePropertySeoMeta(org: PublicOrgDto | undefined, property: PublicPropertyDetailDto | undefined) {
  const { t } = useTranslation();

  useSeoMeta(
    org && property
      ? {
          title: t('publicSite.seo.propertyTitle', { name: property.name, city: property.city, org: org.displayName }),
          description: truncateDescription(property.description) || t('publicSite.seo.orgDescription', { name: org.displayName }),
          canonicalUrl: property.canonicalUrl,
          imageUrl: property.photoUrls.map(httpsImage).find((url) => url !== null) ?? null,
        }
      : null,
  );
}
