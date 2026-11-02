import type { PublicSupplierService } from '@/api/public-supplier.api';

/**
 * Filtering and ordering the list of a supplier's services (SP-09-FE-b). The choices live in the address (`?cat=&price=&sort=`) so
 * they can be shared and the Back button works; an unknown value is ignored, never an error. There is no filter for urgent
 * services: it was left out of the design on purpose.
 */
export type PriceKind = 'fixed' | 'hourly' | 'quote';
export const PRICE_KINDS: readonly PriceKind[] = ['fixed', 'hourly', 'quote'];

export type ServiceSort = 'recommended' | 'price' | 'duration' | 'slot';
export const SERVICE_SORTS: readonly ServiceSort[] = ['recommended', 'price', 'duration', 'slot'];

/** A price for the job, the set or the m² is fixed; for the hour it is hourly; without a price (or on quote) there is none. */
export function priceKindOf(service: PublicSupplierService): PriceKind {
  if (service.requiresQuote || service.priceFromCents === null) return 'quote';
  return service.priceUnit === 'PerHour' ? 'hourly' : 'fixed';
}

export interface ServiceListQuery {
  cat?: string | null;
  price?: string | null;
  sort?: string | null;
}

export interface ServiceListView {
  list: PublicSupplierService[];
  /** The categories there are among the services, in the order they appear. */
  categories: string[];
  /** The kinds of price there are among the services. */
  kinds: PriceKind[];
  /** What was asked for, once checked. */
  cat: string | null;
  price: PriceKind | null;
  sort: ServiceSort;
}

const FAR = Number.MAX_SAFE_INTEGER;

const byPrice = (service: PublicSupplierService) => (priceKindOf(service) === 'quote' ? FAR : (service.priceFromCents ?? FAR));
const byDuration = (service: PublicSupplierService) => service.durationMinutes ?? FAR;
const bySlot = (service: PublicSupplierService) => (service.nextSlotUtc ? new Date(service.nextSlotUtc).getTime() : FAR);

export function viewOfServices(services: readonly PublicSupplierService[], query: ServiceListQuery = {}): ServiceListView {
  const categories = [...new Set(services.map((service) => service.category))];
  const kinds = PRICE_KINDS.filter((kind) => services.some((service) => priceKindOf(service) === kind));
  const cat = query.cat && categories.includes(query.cat) ? query.cat : null;
  const price = PRICE_KINDS.find((kind) => kind === query.price && kinds.includes(kind)) ?? null;
  const sort = SERVICE_SORTS.find((candidate) => candidate === query.sort) ?? 'recommended';

  let list = services.filter((service) => (!cat || service.category === cat) && (!price || priceKindOf(service) === price));
  const key = sort === 'price' ? byPrice : sort === 'duration' ? byDuration : sort === 'slot' ? bySlot : null;
  // A stable order for equal keys (the order the supplier chose), and the services without the value always at the end.
  if (key) list = [...list].sort((a, b) => key(a) - key(b));
  return { list, categories, kinds, cat, price, sort };
}
