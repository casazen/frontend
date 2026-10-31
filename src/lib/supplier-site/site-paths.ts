import { supplierShowcasePath } from '@/features/supplier/lib/showcase-paths';

/**
 * The addresses of the pages of a supplier's site: `/fornitori/:slug` and what hangs from it. The segments stay in Italian
 * (`servizi`, `chi-siamo`, `prenota`, `preventivo`), as the e-mails of the backend already write them. Only paths: the absolute URL
 * of the site is the one the API gives (`publicUrl`).
 */
export const supplierSitePaths = {
  home: (slug: string) => supplierShowcasePath(slug),
  /** All the services, with the filters in the address. */
  services: (slug: string) => `${supplierShowcasePath(slug)}/servizi`,
  /** One service, by its slug. */
  service: (slug: string, serviceSlug: string) => `${supplierShowcasePath(slug)}/servizi/${encodeURIComponent(serviceSlug)}`,
  /** Who the supplier is: its story, the people, the guarantee. */
  about: (slug: string) => `${supplierShowcasePath(slug)}/chi-siamo`,
  /** The booking, a page of its own (SP-12b): the finder and the cards send the customer here with the parameters they know. */
  booking: (slug: string) => `${supplierShowcasePath(slug)}/prenota`,
  /** The page the link of the verification e-mail opens: `?hold=<id>` in the query, the token in the fragment (`#token=`). */
  confirm: (slug: string) => `${supplierShowcasePath(slug)}/conferma`,
  /** "La mia richiesta": the customer finds the booking again with its code and e-mail; the link of the e-mails carries `?code=XXXXX-XXXXX`. */
  request: (slug: string) => `${supplierShowcasePath(slug)}/richiesta`,
  /** The request on measure, with its chat (SP-12c). */
  inquiry: (slug: string) => `${supplierShowcasePath(slug)}/preventivo`,
};
