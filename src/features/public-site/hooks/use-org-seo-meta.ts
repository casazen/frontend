import { useTranslation } from 'react-i18next';
import { truncateDescription, useSeoMeta } from '@/lib/seo-meta';
import type { PublicOrgDto, PublicPropertyDetailDto } from '@/types';

/** `og:image` must be an absolute https URL: a relative, `data:` or `blob:` image is of no use to a link preview. */
function httpsImage(url: string | null | undefined): string | null {
  return url?.startsWith('https://') ? url : null;
}

/** Where a path under `/book/:orgSlug` leads: the landing page, a property page or any other (private) page. */
export type OrgSitePage = 'landing' | 'property' | 'other';

/**
 * Classifies `pathname` (`/book/:orgSlug[/rest]`): the landing page has no rest, a property page is
 * `property/:slugOrId`; the checkout, the guest's bookings, the outcome pages and the legacy links are `other`.
 */
export function classifyOrgSitePage(pathname: string): OrgSitePage {
  const rest = pathname.split('/').filter(Boolean).slice(2);
  if (rest.length === 0) return 'landing';
  if (rest.length === 2 && rest[0] === 'property') return 'property';
  return 'other';
}

/**
 * Title, description, canonical and Open Graph tags of an org booking site (BK-15, A3-20), for the people who read the
 * tab title and for the browsers that share the page. Crawlers get the same data from the backend (`api/seo.ts`).
 * The landing page is indexable; the pages of a booking in progress or of a guest are `noindex`. A property page sets
 * its own tags (`usePropertySeoMeta`): the shell does nothing there.
 */
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

/** Title (`{name} · {city} — {org}`), description (first 155 characters), canonical and Open Graph of a property page. */
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
