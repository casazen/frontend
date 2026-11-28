import { supplierShowcasePath } from '@/features/supplier/lib/showcase-paths';

export const supplierSitePaths = {
  home: (slug: string) => supplierShowcasePath(slug),
  services: (slug: string) => `${supplierShowcasePath(slug)}/servizi`,
  service: (slug: string, serviceSlug: string) => `${supplierShowcasePath(slug)}/servizi/${encodeURIComponent(serviceSlug)}`,
  about: (slug: string) => `${supplierShowcasePath(slug)}/chi-siamo`,
  booking: (slug: string) => `${supplierShowcasePath(slug)}/prenota`,
  confirm: (slug: string) => `${supplierShowcasePath(slug)}/conferma`,
  request: (slug: string) => `${supplierShowcasePath(slug)}/richiesta`,
  inquiry: (slug: string) => `${supplierShowcasePath(slug)}/preventivo`,
};
