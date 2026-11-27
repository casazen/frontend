import type { SupplierServicePriceUnit } from './supplier-services';

export type ServiceRequestStatus =
  | 'Richiesto'
  | 'PresoInCarico'
  | 'InCorso'
  | 'Completato'
  | 'Pagato'
  | 'Rifiutato'
  | 'Annullato';

export type ServiceRequestUrgency = 'Normal' | 'High' | 'Emergency';

type ServiceRequestRentalContext = 'ShortRent' | 'LongRent';

export type ServiceRequestContextKey = 'short-rent' | 'long-rent';

export interface ServiceRequest {
  id: string;
  orgId: string;
  bookingId?: string | null;
  rentalContext?: ServiceRequestRentalContext;
  propertyId: string;
  propertyName?: string | null;
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
  history?: ServiceRequestHistoryEntry[];
  serviceName?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  respondBy?: string | null;
  startedAt?: string | null;
  price?: ServiceRequestPrice;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  completionNotes?: string | null;
  /** The time the supplier proposed instead of the requested one, waiting for the host's answer; empty when there is none. */
  proposal?: ServiceRequestProposal | null;
  lastRemindedAt?: string | null;
  paymentMode?: string;
  workPhotos?: ServiceRequestWorkPhoto[];

  propertyCity?: string | null;
  stay?: ServiceRequestStay | null;
  supplierContact?: ServiceRequestSupplierContact | null;
  hostAction?: ServiceRequestHostAction | null;
  availableActions?: string[] | null;
  scheduleDefaulted?: boolean | null;
  /**
   * The group of backup suppliers the request belongs to (SP-BKP), as its host sees it: the supplier it chose, the backups it was sent to
   * with them and who took the job. `null`/absent for a request sent to one supplier only. The host never sees a backup as a request of
   * its own: the group is inside the request it made, or inside the backup that took the job.
   */
  group?: ServiceRequestGroup | null;
}

type ServiceRequestGroupPhase = 'PrimaryWindow' | 'BackupWindow' | 'Closed';

export interface ServiceRequestGroup {
  id: string;
  phase: ServiceRequestGroupPhase | string;
  primaryDueAt: string;
  backupDueAt?: string | null;
  createdAt: string;
  closedAt?: string | null;
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

export interface OrgServiceRequestSettings {
  useBackupSuppliers: boolean;
}

export interface ServiceRequestWorkPhoto {
  id: string;
  url: string;
  uploadedAt: string;
}

interface ServiceRequestStay {
  bookingId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
}

interface ServiceRequestSupplierContact {
  phone?: string | null;
  email?: string | null;
}

export type HostActionKind = 'none' | 'remind' | 'acceptProposal' | 'confirmFinalAmount' | 'pay' | 'markPaid' | 'requestAgain';

interface ServiceRequestHostAction {
  kind: HostActionKind | string;
  remindAvailableAt?: string | null;
}

interface ServiceRequestPrice {
  estimatedAmountCents?: number | null;
  quotedAmountCents?: number | null;
  finalAmountCents?: number | null;
  amountCents?: number | null;
  basis?: string | null;
  needsCustomerConfirmation?: boolean;
}

interface ServiceRequestProposal {
  startUtc: string;
  endUtc: string;
  proposedAt: string;
  message?: string | null;
}

export type ServiceRequestHostView = 'open' | 'closed';

/**
 * What Stripe.js needs to pay a request inside CasaZen (`POST /long-rent/service-requests/{id}/payment-session`, SP-15a): the
 * client secret is a credential, so the answer is used at once and never kept.
 */
export interface ServicePaymentSession {
  paymentId: string;
  clientSecret: string;
  publishableKey: string;
  stripeAccountId?: string | null;
  amountCents: number;
  currency: string;
}

interface SupplierStay {
  bookingId: string;
  checkIn: string;
  checkOut: string;
}

interface SupplierHostContact {
  name: string;
  email?: string | null;
  phone?: string | null;
}

interface ServiceRequestPriceLine {
  kind: string;
  label: string;
  amountCents: number;
}

interface SupplierRequestPrice {
  amountCents?: number | null;
  quotedAmountCents?: number | null;
  finalAmountCents?: number | null;
  basis?: string | null;
  needsCustomerConfirmation?: boolean;
  lines?: ServiceRequestPriceLine[];
}

interface ServiceRequestQuoteLine {
  label: string;
  amountCents: number;
}

export interface ServiceRequestQuote {
  sentAt: string;
  lines: ServiceRequestQuoteLine[];
  totalCents: number;
  note?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  answerBy?: string | null;
}

/** `POST service-requests/{id}/quote` (SP-04b): 1 to 20 lines, a note, and optionally another time instead of the one the request has. */
export interface SendServiceRequestQuoteDto {
  lines: ServiceRequestQuoteLine[];
  note?: string;
  scheduledStartUtc?: string;
  scheduledEndUtc?: string;
}

interface SupplierRequestPayment {
  hostDocuments?: {
    grossCents: number;
    refundedCents: number;
    commissionCents: number;
    commissionRefundedCents: number;
  } | null;
  status?: string | null;
  amountCents?: number | null;
  commissionPercent?: number | null;
  commissionCents?: number | null;
  netCents?: number | null;
  paidAt?: string | null;
  paidVia?: string | null;
  lastSentAt?: string | null;
  sentCount?: number;
  late?: boolean;
  needsAmountConfirmation?: boolean;
  canRequest?: boolean;
  canRecordOffline?: boolean;
}

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
  propertyName?: string | null;
  city: string;
  postalCode?: string | null;
  address?: string | null;
  scheduledFor?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  stay?: SupplierStay | null;
  contactDisclosed: boolean;
  hostContact?: SupplierHostContact | null;
  source?: string;
  clientName?: string;
  serviceName?: string | null;
  respondBy?: string | null;
  startedAt?: string | null;
  price?: SupplierRequestPrice;
  /** The quote sent and not answered yet (SP-04b), while `phase` is `quote_pending`; empty otherwise. */
  quote?: ServiceRequestQuote | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  paymentMode?: string;
  autoAccepted?: boolean;
  kind?: string;
  phase?: string;
  payment?: SupplierRequestPayment | null;
  backup?: SupplierBackup | null;
}

type ServiceRequestActorParty = 'Host' | 'Supplier' | 'Customer' | 'System';

export interface ServiceRequestHistoryEntry {
  status: ServiceRequestStatus;
  at: string;
  actor: ServiceRequestActorParty;
  actorName?: string | null;
  reason?: string | null;
  event?: string | null;
}

export interface SupplierServiceRequestDetail extends SupplierServiceRequest {
  history: ServiceRequestHistoryEntry[];
}

export interface ServiceRequestListResponse {
  items: ServiceRequest[];
  total: number;
  page: number;
  pageSize: number;
}

export type InterventionView = 'all' | 'pending' | 'active' | 'topay' | 'done' | 'needsaction';

export interface InterventionFilterParams {
  propertyId?: string;
  bookingId?: string;
  supplierOrgId?: string;
  category?: string;
  from?: string;
  to?: string;
  q?: string;
}

export interface InterventionListParams extends InterventionFilterParams {
  view?: InterventionView;
  sort?: string;
  page?: number;
  pageSize?: number;
}

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
  scheduledStartUtc?: string;
  durationMinutes?: number;
  useBackupSuppliers?: boolean;
}

export interface CreateLongRentServiceRequestDto {
  propertyId: string;
  leaseId?: string;
  supplierOrgId: string;
  category: string;
  urgency?: ServiceRequestUrgency;
  notes?: string;
  scheduledStartUtc?: string;
  durationMinutes?: number;
}

export interface SupplierPickerService {
  id: string;
  name: string;
  category: string;
  durationMinutes: number | null;
  priceFromCents: number | null;
  priceUnit: SupplierServicePriceUnit;
  requiresQuote: boolean;
}

export type SupplierPickerSort = 'recommended' | 'name' | 'price' | 'response';

export interface SupplierPicker {
  hostOrigin?: boolean;
  orgId: string;
  legalName: string;
  phone: string;
  email: string;
  categories: string[];
  comuni: string[];
  bio?: string | null;
  photoUrls: string[];
  // SR-09a: what a host weighs when it chooses. Optional, because an answer that predates it (and the long-rent search) lacks them.
  services?: SupplierPickerService[];
  priceFromCents?: number | null;
  priceFromUnit?: SupplierServicePriceUnit | null;
  medianResponseMinutes?: number | null;
  /** «Verificato»: an active profile with a VAT number. Says nothing about the payments account. */
  verified?: boolean;
  showcaseSlug?: string | null;
  recommended?: boolean;
}

export interface SupplierListResponse {
  items: SupplierPicker[];
  totalCount: number;
  page: number;
  pageSize: number;
}
