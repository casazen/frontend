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
  /** The lease contract a long-rent request was made for, when it was asked from the sheet of that contract (LR-03c); the supplier never gets it. */
  leaseId?: string | null;
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
  // The fields of the request the host reads on its pages (SP-04, SP-15a). Optional: an older answer does not have them.
  /** The service of the supplier's catalog the request is for, when it is for one. */
  serviceName?: string | null;
  /** Start and end of the work (UTC); both empty on an older request that has no time. */
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  /** The instant the supplier has to answer by, while the request is new. */
  respondBy?: string | null;
  startedAt?: string | null;
  price?: ServiceRequestPrice;
  cancelledAt?: string | null;
  /** Who cancelled it (`Host`, `Supplier`, `System`) and why: a text, or the code `NoResponse` of the automatic cancellation. */
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  /** What the supplier wrote when it completed the work. */
  completionNotes?: string | null;
  /** The time the supplier proposed instead of the requested one, waiting for the host's answer; empty when there is none. */
  proposal?: ServiceRequestProposal | null;
  /** When the host last reminded the supplier. */
  lastRemindedAt?: string | null;
  /** `Online` (paid inside CasaZen, with the payment session) or `Manual` (paid outside, the host marks it). */
  paymentMode?: string;
  /** The photos of the work, private files read through the authenticated address of each one (at most 6). */
  workPhotos?: ServiceRequestWorkPhoto[];

  // What the server adds for the host of the short-rent context (SR-08a). `null` for the supplier and in the long-rent context.
  /** The city of the property, as the host wrote it. */
  propertyCity?: string | null;
  /** The stay the request is for; `null` when it is for the house alone. The guest is the host's: the supplier never gets it. */
  stay?: ServiceRequestStay | null;
  /** How to reach the supplier, from the moment it took the request; `null` before. */
  supplierContact?: ServiceRequestSupplierContact | null;
  /** The one thing the host is asked to do about the request, worked out by the server: the page has no state logic of its own. */
  hostAction?: ServiceRequestHostAction | null;
  /** Everything the host can do now, the `hostAction.kind` first. An open set (see {@link HostActionKind}). */
  availableActions?: string[] | null;
  /** Only in the answer of the creation: the host named no time and the request got the default one (10:00 of a day). */
  scheduleDefaulted?: boolean | null;
  /**
   * The group of backup suppliers the request belongs to (SP-BKP), as its host sees it: the supplier it chose, the backups it was sent to
   * with them and who took the job. `null`/absent for a request sent to one supplier only. The host never sees a backup as a request of
   * its own: the group is inside the request it made, or inside the backup that took the job.
   */
  group?: ServiceRequestGroup | null;
}

/**
 * Where the group of a request is (SP-BKP): `PrimaryWindow` (the chosen supplier has until `primaryDueAt`; the backups can only say they
 * would take the job), `BackupWindow` (the chosen supplier did not take it or refused: every supplier still waiting can, until
 * `backupDueAt`, and the first has it) or `Closed`. An open set: a word this version does not know is shown as a group that is over.
 */
export type ServiceRequestGroupPhase = 'PrimaryWindow' | 'BackupWindow' | 'Closed';

export interface ServiceRequestGroup {
  id: string;
  phase: ServiceRequestGroupPhase | string;
  primaryDueAt: string;
  backupDueAt?: string | null;
  createdAt: string;
  closedAt?: string | null;
  /** The request the host follows first (the chosen supplier, or the backup that replaced it), then the one it replaced, then the backups. */
  members: ServiceRequestGroupMember[];
}

/**
 * One request of a group (SP-BKP). `role`: `Primary` (the supplier the host chose), `Backup`, `ReplacedPrimary` (the chosen supplier that
 * did not answer in time and was replaced) or `PromotedBackup` (the backup that took the job). `acceptedAt` is when a backup said it would
 * take the job (the first backup that accepts closes the race for the others); `tookTheJob` marks the request that was taken;
 * `cancellationReason` is the code of a request closed by CasaZen (`NoResponse`, `PrimaryTookIt`, `TakenByBackup`,
 * `RequestCancelledByHost`, `BackupSlotUnavailable`, `BackupRaceClosed`).
 */
export interface ServiceRequestGroupMember {
  requestId: string;
  role: 'Primary' | 'Backup' | 'ReplacedPrimary' | 'PromotedBackup' | string;
  supplierOrgId: string;
  supplierName: string;
  status: ServiceRequestStatus;
  acceptedAt?: string | null;
  tookTheJob: boolean;
  cancellationReason?: string | null;
}

/**
 * Where a request stands in its group of backup suppliers, for the supplier it was sent to (SP-BKP; `SupplierServiceRequest.backup`).
 * `role`: `primary` (the host chose this supplier, which has until `primaryDueAt` for the priority) or `backup` (the job is its only if the
 * primary does not take it). `state`, an open set: for a backup `waiting` (the primary has its window), `accepted` (it said it would take
 * the job), `active` (the second window: it can take the job now, until `backupDueAt`, and the first to do so has it), `won` or `closed`;
 * for the primary `priority` (within its window) or `late` (the window passed: still in the race without the priority).
 */
export interface SupplierBackup {
  role: 'primary' | 'backup' | string;
  state: string;
  primaryDueAt: string;
  backupDueAt?: string | null;
  acceptedAt?: string | null;
}

/** `GET/PUT /orgs/me/service-request-settings` (SP-BKP): whether the org's requests also go to up to three backup suppliers. */
export interface OrgServiceRequestSettings {
  useBackupSuppliers: boolean;
}

/** A photo of the work: `url` is an authenticated address of the API (the files are in a private bucket). */
export interface ServiceRequestWorkPhoto {
  id: string;
  url: string;
  uploadedAt: string;
}

/** The stay of a short-rent request as its host reads it (SR-08a): the guest's name and the days. */
export interface ServiceRequestStay {
  bookingId: string;
  guestName: string;
  /** Arrival day, `YYYY-MM-DD`. */
  checkIn: string;
  /** Departure day, `YYYY-MM-DD`. */
  checkOut: string;
}

/** The phone and the e-mail of the supplier of a request it took (SR-08a). */
export interface ServiceRequestSupplierContact {
  phone?: string | null;
  email?: string | null;
}

/**
 * What the host is asked to do about a request (SR-08a): `none` (the supplier is at work, or it is over), `remind`, `acceptProposal`,
 * `confirmFinalAmount`, `pay` (paid inside CasaZen), `markPaid` (paid outside) or `requestAgain`. **An open set**: a word this version
 * does not know is shown as nothing to do.
 */
export type HostActionKind = 'none' | 'remind' | 'acceptProposal' | 'confirmFinalAmount' | 'pay' | 'markPaid' | 'requestAgain';

export interface ServiceRequestHostAction {
  kind: HostActionKind | string;
  /** With `none` on a request that waits for the supplier: from when the host can remind it again (UTC instant). */
  remindAvailableAt?: string | null;
}

/** The price of a request as the host sees it, in cents of euro (SP-04): `amountCents` is the one to show. */
export interface ServiceRequestPrice {
  estimatedAmountCents?: number | null;
  quotedAmountCents?: number | null;
  finalAmountCents?: number | null;
  /** The final amount, else the quote, else the estimate; empty is "da concordare". */
  amountCents?: number | null;
  /** Which amount `amountCents` is: `final`, `quoted` or `estimated`. */
  basis?: string | null;
  /** The final amount is more than 20 % above the quote: the host has to confirm it before it can pay (decision D7). */
  needsCustomerConfirmation?: boolean;
}

/** A time the supplier proposed for a new request (UTC instants). */
export interface ServiceRequestProposal {
  startUtc: string;
  endUtc: string;
  proposedAt: string;
  message?: string | null;
}

/** The two views of the list of the host (`?view=` of `GET /long-rent/service-requests`, LR-08a): the open ones and the closed ones. */
export type ServiceRequestHostView = 'open' | 'closed';

/**
 * What Stripe.js needs to pay a request inside CasaZen (`POST /long-rent/service-requests/{id}/payment-session`, SP-15a): the
 * client secret is a credential, so the answer is used at once and never kept.
 */
export interface ServicePaymentSession {
  paymentId: string;
  clientSecret: string;
  publishableKey: string;
  /** The connected account the payment goes to (today the supplier's). Not presumed: without one the payment is on the platform's own account. */
  stripeAccountId?: string | null;
  amountCents: number;
  currency: string;
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
 * One line of the price of a request in cents of euro: `base` (the agreed price), `quote` (a line of the quote the customer accepted,
 * SP-04b: the lines add up to the agreed price) or `extra`. An open set: a line of a kind this version does not know is shown as it comes.
 */
export interface ServiceRequestPriceLine {
  kind: string;
  label: string;
  amountCents: number;
}

/**
 * The price of a request in cents of euro (SP-04): `amountCents` is the one to show (the final amount, else the quote, else the
 * estimate; empty is "da concordare").
 */
export interface SupplierRequestPrice {
  amountCents?: number | null;
  /** The price agreed when the request was taken (the total of the quote the customer accepted): the reference of the +20 % rule (D7). */
  quotedAmountCents?: number | null;
  /** The total the supplier declared when it completed the work. */
  finalAmountCents?: number | null;
  /** Which amount `amountCents` is: `final`, `quoted` or `estimated`. */
  basis?: string | null;
  /** The final amount is more than 20 % above the quote: the customer has to confirm it (decision D7). */
  needsCustomerConfirmation?: boolean;
  /** What the final price is made of: the agreed price (the lines of an accepted quote) and the extras. */
  lines?: ServiceRequestPriceLine[];
}

/** One line of a quote (SP-04b): what it is for and how much, in cents of euro. */
export interface ServiceRequestQuoteLine {
  label: string;
  amountCents: number;
}

/**
 * The quote the supplier sent and the customer (the host, or the private customer of the showcase) has not answered (SP-04b): the
 * request stays new with `phase` `quote_pending`. `sentAt` is the version of the quote. The request keeps its own time until the customer
 * accepts: `scheduledStart` and `scheduledEnd` are another time the quote offers, if it does; it holds no slot.
 */
export interface ServiceRequestQuote {
  sentAt: string;
  lines: ServiceRequestQuoteLine[];
  /** What the lines add up to: the price agreed if the quote is accepted. */
  totalCents: number;
  note?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  /** Until when the customer of a showcase request can answer; empty for a host, who has no deadline. */
  answerBy?: string | null;
}

/** `POST service-requests/{id}/quote` (SP-04b): 1 to 20 lines, a note, and optionally another time instead of the one the request has. */
export interface SendServiceRequestQuoteDto {
  lines: ServiceRequestQuoteLine[];
  note?: string;
  scheduledStartUtc?: string;
  scheduledEndUtc?: string;
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
  /** `Stripe` or `Offline`; empty until it is paid. */
  paidVia?: string | null;
  /** When the payer was last sent a link, and how many e-mails (the request and its reminders) were sent: one a day at most. */
  lastSentAt?: string | null;
  sentCount?: number;
  /** The payer was asked for the payment and is late. */
  late?: boolean;
  needsAmountConfirmation?: boolean;
  /** The server would accept a request for the payment, or a reminder, now (false while `SupplierOnlinePayments` is off). */
  canRequest?: boolean;
  /** The server would accept «Ho incassato fuori da CasaZen» now (also with online payments off); a reason is mandatory for a request paid in CasaZen. */
  canRecordOffline?: boolean;
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
  /** The quote sent and not answered yet (SP-04b), while `phase` is `quote_pending`; empty otherwise. */
  quote?: ServiceRequestQuote | null;
  /**
   * Who cancelled it (`Host`, `Supplier`, `Customer`, `System`) and why: a text, or the code `NoResponse`, `ProposalNotAnswered`,
   * `QuoteNotAnswered`, `CancelledByCustomer` or, for a backup request closed by CasaZen (SP-BKP), `PrimaryTookIt`, `TakenByBackup`,
   * `RequestCancelledByHost`, `BackupSlotUnavailable`, `BackupRaceClosed` (another backup accepted first: no penalty).
   */
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  /** `Online` (paid inside CasaZen) or `Manual` (paid outside, the host marks it). */
  paymentMode?: string;
  /**
   * The server accepted it by itself (SP-04d): the supplier turned on the automatic acceptance of its regular hosts. It was born taken
   * (`PresoInCarico`, the step in the history has the actor `System`) and the supplier can still cancel it, with a reason, until it starts.
   */
  autoAccepted?: boolean;
  /**
   * `Standard` (a host's request, or a booking at a free slot) or `Custom` (a request on measure from the showcase, SP-10b): the latter has no
   * time and no price, is carried on in a thread of messages and answered with an offer, and is not taken (422 `supplier_inquiry_needs_offer`).
   * Absent in an older answer: a standard request.
   */
  kind?: string;
  /**
   * Where the request is for the console, worked out once by the server (SP-04e): `to_answer`, `proposal_pending`, `quote_pending`
   * (SP-04b), `scheduled`, `in_progress`, `completed`, `paid`, `rejected`, `cancelled`. An open set: a value this version does not know
   * is read from `status`.
   */
  phase?: string;
  payment?: SupplierRequestPayment | null;
  /**
   * Where the request stands in its group of backup suppliers (SP-BKP); absent for a request sent to this supplier alone. A request that
   * reaches the supplier **as a backup** (`role: 'backup'`) is declared as such: the job is its only if the primary does not take it.
   */
  backup?: SupplierBackup | null;
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
  /**
   * What the step says beyond its status (SP-04b; the supplier's console only): `quote_sent`, `quote_rejected`, `quote_withdrawn` (steps of
   * `Richiesto`), `quote_accepted` (the `PresoInCarico` step that took the request on a quote) or `quote_expired` (the `Annullato` step of a
   * quote nobody answered). An open set: a step with an event this version does not know is shown by its status.
   */
  event?: string | null;
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

/**
 * The chips of the host's list of interventions (SR-08a, `view` of `GET /service-requests`): `pending` waits for the supplier, `active`
 * is taken or in progress, `topay` is finished, `done` is paid, refused or cancelled, `needsaction` asks something of the host.
 */
export type InterventionView = 'all' | 'pending' | 'active' | 'topay' | 'done' | 'needsaction';

/** The order of the host's list (`sort` of `GET /service-requests`, with `:asc` or `:desc`). */
export type InterventionSortKey = 'scheduled' | 'created' | 'status';

/** What the page asks of `GET /service-requests` and `GET /service-requests/counts` (the counters take everything but `view`, `sort` and the page). */
export interface InterventionFilterParams {
  propertyId?: string;
  bookingId?: string;
  supplierOrgId?: string;
  category?: string;
  /** `YYYY-MM-DD`, Europe/Rome, both included: the day of the work (its scheduled time, else the day of the request). */
  from?: string;
  to?: string;
  q?: string;
}

export interface InterventionListParams extends InterventionFilterParams {
  view?: InterventionView;
  /** `scheduled`, `created` or `status`, then `:asc` or `:desc`. */
  sort?: string;
  page?: number;
  pageSize?: number;
}

/** How many requests are in each chip (`GET /service-requests/counts`); the first four add up to `all`, `needsAction` overlaps them. */
export interface InterventionCounts {
  all: number;
  pending: number;
  active: number;
  toPay: number;
  done: number;
  needsAction: number;
}

/**
 * Short-rent request (`POST /service-requests`): for the house, with the stay of the property it is about when the host names one
 * (`bookingId` is optional since SR-08a: a request for the house alone is allowed, and without a time it gets the default one).
 */
export interface CreateServiceRequestDto {
  propertyId: string;
  bookingId?: string;
  supplierOrgId: string;
  category: string;
  urgency?: ServiceRequestUrgency;
  notes?: string;
  /**
   * The service of the supplier's catalog the request is for (SR-08b): its name, estimated price and duration come with it. With a
   * start and no `durationMinutes` the start has to be a free slot of the service (409 `supplier_slot_unavailable` otherwise).
   */
  serviceListingId?: string;
  /** Start of the work (UTC). With `durationMinutes` the supplier sees the interval. */
  scheduledStartUtc?: string;
  /** How long the work lasts, in minutes. */
  durationMinutes?: number;
  /**
   * SP-BKP: send the request also to up to three backup suppliers, declared as such. Left out, the org's choice decides (on by default);
   * `false` sends it to the chosen supplier alone. Only matters while the backend flag `SupplierRequestBackups` is on.
   */
  useBackupSuppliers?: boolean;
}

/** Long-rent request (`POST /long-rent/service-requests`, D2): for the property, never a booking. */
export interface CreateLongRentServiceRequestDto {
  propertyId: string;
  /** The lease contract the request is for (LR-03c): a lease of that property; the server refuses another's. */
  leaseId?: string;
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

/**
 * The order of the list of suppliers (`?sort=` of `GET /suppliers`): `recommended` (the default, SP-REL: the best-ranked supplier first,
 * by its load and its reliability), then `name`, `price` and `response`.
 */
export type SupplierPickerSort = 'recommended' | 'name' | 'price' | 'response';

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
  /**
   * «Consigliato» (SP-REL): the best-ranked supplier of the list, strictly ahead of the next one, in the default order. Only that: the
   * score behind it (load, reliability) is never sent. Absent from an API that does not rank yet.
   */
  recommended?: boolean;
}

export interface SupplierListResponse {
  items: SupplierPicker[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * A supplier the host already asked for a job (`GET /service-requests/suppliers`, MKT): what «Le mie app» of the marketplace says about
 * it, from the short-rent requests of the org (in the scope of the caller). Its name and counts, never its contact.
 */
export interface UsedSupplier {
  supplierOrgId: string;
  supplierName: string;
  requestsCount: number;
  /** The requests that are not over: every one that is not refused, paid or cancelled. */
  openCount: number;
  /** When the latest request was made (ISO instant). */
  lastRequestAt: string;
  /** The category of the latest request: where «Richiedi di nuovo» starts from. */
  lastCategory: string;
}

export interface UsedSuppliersResponse {
  items: UsedSupplier[];
  totalCount: number;
  page: number;
  pageSize: number;
}
