import type { SupplierServicePriceUnit } from './supplier-services';

export type ServiceRequestStatus =
  | 'Richiesto'
  | 'PresoInCarico'
  | 'InCorso'
  | 'Completato'
  | 'Pagato'
  | 'Rifiutato'
  /** Cancelled before the work was done: by the host, by the supplier before starting, or when the supplier did not answer in time (SP-04). */
  | 'Annullato';

export type ServiceRequestUrgency = 'Normal' | 'High' | 'Emergency';

/**
 * Rental context a request was opened in (decision D2): short-rent requests are for one stay (`bookingId`), long-rent
 * requests for the property.
 */
export type ServiceRequestRentalContext = 'ShortRent' | 'LongRent';

/** Workspace context of a service request screen (`/app/short-rent/…` or `/app/long-rent/…`). */
export type ServiceRequestContextKey = 'short-rent' | 'long-rent';

export interface ServiceRequest {
  id: string;
  orgId: string;
  /** The stay (short-rent). Null for long-rent requests and for older short-rent ones not traced to a stay. */
  bookingId?: string | null;
  rentalContext?: ServiceRequestRentalContext;
  propertyId: string;
  propertyName?: string | null;
  supplierOrgId: string;
  supplierName?: string | null;
  category: string;
  urgency: ServiceRequestUrgency;
  notes?: string | null;
  status: ServiceRequestStatus;
  takenAt?: string | null;
  takenByUserId?: string | null;
  completedAt?: string | null;
  paidAt?: string | null;
  chargeToGuest: boolean;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * The steps of the request, oldest first, with date and party (SU-09): requested and paid by the host, taken,
   * completed or rejected by the supplier. The supplier's team members are never named to the host.
   */
  history?: ServiceRequestHistoryEntry[];
}

/** The stay of a short-rent request as the supplier sees it (SU-08): dates only, never the guest. */
export interface SupplierStay {
  bookingId: string;
  /** Check-in day, `YYYY-MM-DD` (Europe/Rome). */
  checkIn: string;
  /** Check-out day, `YYYY-MM-DD` (Europe/Rome). */
  checkOut: string;
}

/** Host contact given to the supplier once it took the request (SU-08). */
export interface SupplierHostContact {
  name: string;
  email?: string | null;
  phone?: string | null;
}

/**
 * The price of a request in cents of euro (SP-04): `amountCents` is the one to show (the final amount, else the quote, else the
 * estimate; empty is "da concordare").
 */
export interface SupplierRequestPrice {
  amountCents?: number | null;
  /** The final amount is more than 20 % above the quote: the customer has to confirm it (decision D7). */
  needsCustomerConfirmation?: boolean;
}

/**
 * The payment of a job (SP-04e): there when the request has a payment record or is `Completato`; the commission, the net and the
 * status are empty while there is no record. The console shows these figures as they come and promises no payout date.
 */
export interface SupplierRequestPayment {
  /** `Requested`, `Processing`, `Paid`, `Failed`, `PartiallyRefunded`, `Refunded`, `NeedsReview`: an open set. */
  status?: string | null;
  amountCents?: number | null;
  commissionPercent?: number | null;
  commissionCents?: number | null;
  netCents?: number | null;
  paidAt?: string | null;
  /** The payer was asked for the payment and is late. */
  late?: boolean;
  needsAmountConfirmation?: boolean;
}

/**
 * A request in the supplier console (`GET /supplier/inbox`, SU-08, A4-14). Before the take: comune, zone (postal code), day and
 * time, price and who asks (D9); from the take on (`contactDisclosed`) also the property, the notes, the street address and the
 * contact. The fields from `source` on come with SP-04 and SP-04e and are optional here: an older answer does not have them.
 */
export interface SupplierServiceRequest {
  id: string;
  rentalContext: ServiceRequestRentalContext | 'Showcase';
  status: ServiceRequestStatus;
  category: string;
  urgency: ServiceRequestUrgency;
  notes?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  takenAt?: string | null;
  completedAt?: string | null;
  paidAt?: string | null;
  propertyId?: string | null;
  /** The property: empty until the supplier takes the request (D9), and for a request of the public showcase. */
  propertyName?: string | null;
  city: string;
  postalCode?: string | null;
  /** Street address: null until the supplier takes the request. */
  address?: string | null;
  /** Day of the job, `YYYY-MM-DD` (Europe/Rome): the check-out of the stay; null when there is no stay. */
  scheduledFor?: string | null;
  /** Start of the work (UTC). Required on new requests; may be null only on legacy rows before backfill. */
  scheduledStart?: string | null;
  /** End of the work (UTC): the start plus the duration. */
  scheduledEnd?: string | null;
  stay?: SupplierStay | null;
  contactDisclosed: boolean;
  hostContact?: SupplierHostContact | null;
  /** `casazen` (a host's request) or `showcase` (a customer of the public showcase). */
  source?: string;
  /** Who asks: the host's display name, or "Nome C." for a private customer until the take (D9). */
  clientName?: string;
  /** The service of the catalog the request is for, when it is for one. */
  serviceName?: string | null;
  /** The instant the supplier has to answer by, while the request is new. */
  respondBy?: string | null;
  startedAt?: string | null;
  price?: SupplierRequestPrice;
  /** Who cancelled it (`Host`, `Supplier`, `Customer`, `System`) and why: a text, or the code `NoResponse`, `ProposalNotAnswered`, `CancelledByCustomer`. */
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  /** `Online` (paid inside CasaZen) or `Manual` (paid outside, the host marks it). */
  paymentMode?: string;
  /**
   * Where the request is for the console, worked out once by the server (SP-04e): `to_answer`, `proposal_pending`, `scheduled`,
   * `in_progress`, `completed`, `paid`, `rejected`, `cancelled`. An open set: a value this version does not know is read from `status`.
   */
  phase?: string;
  payment?: SupplierRequestPayment | null;
}

/** `Supplier` and `Host` take the steps; `Customer` (a private customer of the showcase) and `System` (nobody answered in time) end some. */
export type ServiceRequestActorParty = 'Host' | 'Supplier' | 'Customer' | 'System';

/** One transition of a service request: the status reached, when (UTC instant) and by whom. */
export interface ServiceRequestHistoryEntry {
  status: ServiceRequestStatus;
  at: string;
  actor: ServiceRequestActorParty;
  /** The supplier member who took the request, when known. */
  actorName?: string | null;
  /** Rejection or cancellation reason, on the `Rifiutato` and `Annullato` steps: a text, or a code (see `cancellationReason`). */
  reason?: string | null;
}

/** `GET /supplier/inbox/{id}`: the request and its history (SU-08). */
export interface SupplierServiceRequestDetail extends SupplierServiceRequest {
  history: ServiceRequestHistoryEntry[];
}

export interface ServiceRequestListResponse {
  items: ServiceRequest[];
  total: number;
  page: number;
  pageSize: number;
}

/** Short-rent request (`POST /service-requests`, D2): for one stay of the property, `bookingId` required. */
export interface CreateServiceRequestDto {
  propertyId: string;
  bookingId: string;
  supplierOrgId: string;
  category: string;
  urgency?: ServiceRequestUrgency;
  notes?: string;
  /** Start of the work (UTC). With `durationMinutes` the supplier sees the interval. */
  scheduledStartUtc?: string;
  /** How long the work lasts, in minutes. */
  durationMinutes?: number;
}

/** Long-rent request (`POST /long-rent/service-requests`, D2): for the property, never a booking. */
export interface CreateLongRentServiceRequestDto {
  propertyId: string;
  supplierOrgId: string;
  category: string;
  urgency?: ServiceRequestUrgency;
  notes?: string;
  scheduledStartUtc?: string;
  durationMinutes?: number;
}

/** A published service of a supplier in the picker of the marketplace (`GET /suppliers`, SR-09a): what the host needs to read its price. */
export interface SupplierPickerService {
  id: string;
  name: string;
  category: string;
  durationMinutes: number | null;
  /** The "from" price in euro cents; `null` is "on quote". */
  priceFromCents: number | null;
  priceUnit: SupplierServicePriceUnit;
  requiresQuote: boolean;
}

/** The order of the marketplace list (`?sort=` of `GET /suppliers`). */
export type SupplierPickerSort = 'name' | 'price' | 'response';

export interface SupplierPicker {
  orgId: string;
  legalName: string;
  phone: string;
  email: string;
  categories: string[];
  comuni: string[];
  bio?: string | null;
  photoUrls: string[];
  // SR-09a: what a host weighs when it chooses. Optional, because an answer that predates it (and the long-rent search) lacks them.
  /** Up to three published services, in the supplier's own order. */
  services?: SupplierPickerService[];
  /** The lowest "from" price among all its published services, in euro cents; `null` when none has a price. */
  priceFromCents?: number | null;
  /** What `priceFromCents` is for. */
  priceFromUnit?: SupplierServicePriceUnit | null;
  /** The typical time the supplier takes to answer, in minutes; `null` until it is measured: it is never shown without. */
  medianResponseMinutes?: number | null;
  /** «Verificato»: an active profile with a VAT number. Says nothing about the payments account. */
  verified?: boolean;
  /** The address of the public showcase (`/fornitori/{slug}`); `null` when it has none. */
  showcaseSlug?: string | null;
}

export interface SupplierListResponse {
  items: SupplierPicker[];
  totalCount: number;
  page: number;
  pageSize: number;
}
