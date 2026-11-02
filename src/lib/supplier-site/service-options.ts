import type {
  PublicQuoteRequestBody,
  PublicSupplierService,
  PublicSupplierServiceDetail,
  PublicSupplierSupplement,
} from '@/api/public-supplier.api';
import type { BookingParams } from './booking-params';

/**
 * What the customer picks on the card of a service, and how it becomes the request of the estimate and the parameters of the booking.
 * The total is **never** computed here: the server adds up the lines (`POST …/quote`), this only says what was chosen.
 *
 *  - `quantity`: hours (`PerHour`), sets (`PerSet`) or square meters (`PerSquareMeter`) of the service's own price; null for `PerJob`.
 *  - `surface`: the m² of the home, only for a service with a `sqm30` supplement (the blocks of 30 m² above what the price covers).
 *  - `options`: units picked of each other supplement (a `flat` one is 0 or 1).
 */
export interface ServiceSelection {
  quantity: number | null;
  surface: number | null;
  options: Record<string, number>;
  /** ISTAT code of the comune where the work is, if said. */
  comune: string | null;
}

/** What a square meters price starts from, and how it moves. */
export const SQUARE_METERS_DEFAULT = 60;
export const SQUARE_METERS_STEP = 10;
export const SQUARE_METERS_MAX = 1000;

/** Most units of a supplement without a limit of its own, and most 30 m² blocks offered without one. */
const DEFAULT_MAX_UNITS = 8;
const DEFAULT_SQM_BLOCKS = 6;
const SQM_BLOCK = 30;

export const isPickedSupplement = (supplement: PublicSupplierSupplement) => supplement.per !== 'sqm30';

export const surfaceSupplement = (service: PublicSupplierServiceDetail) => service.supplements.find((supplement) => supplement.per === 'sqm30');

/** How many units of a supplement can be picked: a `flat` one is one. */
export function maxUnits(supplement: PublicSupplierSupplement): number {
  if (supplement.per === 'flat') return 1;
  return supplement.max ?? DEFAULT_MAX_UNITS;
}

/** The surfaces to choose from, by the upper edge of each size: what the price covers, then one more block of 30 m² at a time. */
export function surfaceChoices(supplement: PublicSupplierSupplement): number[] {
  const included = supplement.includedSqm ?? SQUARE_METERS_DEFAULT;
  const blocks = supplement.max ?? DEFAULT_SQM_BLOCKS;
  return Array.from({ length: blocks + 1 }, (_, block) => included + block * SQM_BLOCK);
}

/** Where the card starts: the usual quantity of the service, the surface its price covers, no supplement. */
export function defaultSelection(service: PublicSupplierServiceDetail): ServiceSelection {
  let quantity: number | null = null;
  if (service.priceUnit === 'PerHour') quantity = Math.max(1, Math.ceil((service.durationMinutes ?? 60) / 60));
  else if (service.priceUnit === 'PerSet') quantity = 1;
  else if (service.priceUnit === 'PerSquareMeter') quantity = SQUARE_METERS_DEFAULT;

  const surface = surfaceSupplement(service);
  return { quantity, surface: surface ? (surface.includedSqm ?? SQUARE_METERS_DEFAULT) : null, options: {}, comune: null };
}

/** The supplements picked, as the estimate and the booking name them (none with zero units; the `sqm30` follows the surface). */
function pickedOptions(selection: ServiceSelection): { code: string; quantity: number }[] {
  return Object.entries(selection.options)
    .filter(([, quantity]) => quantity > 0)
    .map(([code, quantity]) => ({ code, quantity }));
}

/** The request of the estimate for what is chosen. */
export function toQuoteBody(service: PublicSupplierServiceDetail, selection: ServiceSelection): PublicQuoteRequestBody {
  const options = pickedOptions(selection);
  return {
    service: service.slug,
    ...(selection.quantity !== null ? { quantity: selection.quantity } : {}),
    ...(selection.surface !== null ? { surfaceSqm: selection.surface } : {}),
    ...(options.length > 0 ? { options } : {}),
    ...(selection.comune ? { comune: selection.comune } : {}),
  };
}

/** The parameters of the booking for what is chosen (`booking-params.ts`). */
export function toBookingParams(service: Pick<PublicSupplierService, 'slug'>, selection: ServiceSelection): BookingParams {
  const options = pickedOptions(selection);
  return {
    service: service.slug,
    ...(selection.quantity !== null ? { quantity: selection.quantity } : {}),
    ...(selection.surface !== null ? { surface: selection.surface } : {}),
    ...(options.length > 0 ? { options } : {}),
    ...(selection.comune ? { comune: selection.comune } : {}),
  };
}
