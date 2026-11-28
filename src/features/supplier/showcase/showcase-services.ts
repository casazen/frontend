import type { PublicShowcaseSections } from '@/api/public-supplier.api';
import type { SupplierService } from '@/types/supplier-services';

/**
 * The services of the catalog as the page will show them (`serviceOrder`, SP-13a): empty means every active service in the order of the
 * catalog; otherwise only the ones named, in that order. Only an `Active` service can be shown; a draft or a paused one is not offered.
 */
export interface ServicePlan {
  shown: SupplierService[];
  hidden: SupplierService[];
  inactive: SupplierService[];
}

const isActive = (service: SupplierService) => service.status === 'Active';

export function planServices(services: readonly SupplierService[], serviceOrder: readonly string[] | undefined): ServicePlan {
  const active = services.filter(isActive);
  const inactive = services.filter((service) => !isActive(service));
  const bySlug = new Map(active.map((service) => [service.slug, service]));

  const shown: SupplierService[] = [];
  for (const slug of serviceOrder ?? []) {
    const service = bySlug.get(slug);
    if (service && !shown.includes(service)) shown.push(service);
  }
  if (shown.length === 0) return { shown: active, hidden: [], inactive };
  return { shown, hidden: active.filter((service) => !shown.includes(service)), inactive };
}

/**
 * What goes into `serviceOrder` for a list of shown services: nothing when every active service is shown in the order of the catalog (the
 * page then follows the catalog, a service added later included); otherwise the slugs, in order.
 */
export function serviceOrderOf(services: readonly SupplierService[], shown: readonly SupplierService[]): string[] | null {
  const active = services.filter(isActive);
  const sameAsCatalog = shown.length === active.length && shown.every((service, index) => service.id === active[index].id);
  return sameAsCatalog ? null : shown.map((service) => service.slug);
}

export const SECTION_KEYS = ['trust', 'how', 'works', 'zones', 'certs', 'faq'] as const satisfies readonly (keyof PublicShowcaseSections)[];

/** The sections as the draft has them: every one is shown unless it says otherwise. */
export function sectionsOf(sections: Partial<PublicShowcaseSections> | undefined): PublicShowcaseSections {
  return { trust: true, how: true, works: true, zones: true, certs: true, faq: true, ...sections };
}
