/**
 * The external partners of the marketplace (spec «external-service-integrations», AC5): companies that run the operations of a
 * short-term rental, next to the CasaZen suppliers. ONE list, used by Scopri and by the guided request.
 *
 * CasaZen has no agreement with them and does not run them: a card says what the partner does and opens ITS OWN site. The
 * catalog is data: to add or take off a partner change this list and the line of `marketplace.partners.items.<code>` in both
 * languages. The sites were read on 2026-11-01; none of them states where it serves, so the page asks the host to check that the
 * partner serves the area (`marketplace.partners.description`). Sali Mietwäsche (linen, spec AC5) is left out: its site says it
 * delivers «deutschlandweit», in Germany only.
 */
export interface ExternalPartner {
  /** Stable code, lowercase (the one of the spec). */
  code: string;
  /** The name of the company: a brand, never translated. */
  name: string;
  /** The service categories of `GET api/service-categories` the partner works for. */
  categories: readonly string[];
  /** The public home page of the partner: an absolute `https` address. */
  url: string;
}

export const EXTERNAL_PARTNERS: readonly ExternalPartner[] = [
  { code: 'operto', name: 'Operto', categories: ['check-in'], url: 'https://operto.com/' },
  { code: 'turno', name: 'Turno', categories: ['cleaning'], url: 'https://turno.com/' },
  { code: 'properly', name: 'Properly', categories: ['cleaning'], url: 'https://getproperly.com/' },
  { code: 'doinn', name: 'Doinn', categories: ['cleaning'], url: 'https://doinn.co/' },
  { code: 'tidy', name: 'TIDY', categories: ['cleaning', 'maintenance'], url: 'https://www.tidy.com/' },
];
