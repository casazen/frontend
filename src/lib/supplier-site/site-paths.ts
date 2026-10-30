import { supplierShowcasePath } from '@/features/supplier/lib/showcase-paths';

/**
 * The addresses of the pages of a supplier's site: `/fornitori/:slug` and what hangs from it. The segments stay in Italian
 * (`prenota`, `preventivo`), as the e-mails of the backend already write them. Only paths: the absolute URL of the site is the
 * one the API gives (`publicUrl`).
 */
export const supplierSitePaths = {
  home: (slug: string) => supplierShowcasePath(slug),
  /** The booking, a page of its own (SP-12b): the finder and the cards send the customer here with the parameters they know. */
  booking: (slug: string) => `${supplierShowcasePath(slug)}/prenota`,
  /** The request on measure, with its chat (SP-12c). */
  inquiry: (slug: string) => `${supplierShowcasePath(slug)}/preventivo`,
};
