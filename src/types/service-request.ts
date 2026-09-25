export type ServiceRequestStatus =
  | 'Richiesto'
  | 'PresoInCarico'
  | 'InCorso'
  | 'Completato'
  | 'Pagato'
  | 'Rifiutato';

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
 * A request in the supplier console (`GET /supplier/inbox`, SU-08, A4-14). Before the take: comune, zone (postal code),
 * date and stay dates; from the take on (`contactDisclosed`) also the street address and the host contact.
 */
export interface SupplierServiceRequest {
  id: string;
  rentalContext: ServiceRequestRentalContext;
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
  propertyId: string;
  propertyName: string;
  city: string;
  postalCode?: string | null;
  /** Street address: null until the supplier takes the request. */
  address?: string | null;
  /** Day of the job, `YYYY-MM-DD` (Europe/Rome): the check-out of the stay; null when there is no stay. */
  scheduledFor?: string | null;
  stay?: SupplierStay | null;
  contactDisclosed: boolean;
  hostContact?: SupplierHostContact | null;
}

export type ServiceRequestActorParty = 'Host' | 'Supplier';

/** One transition of a service request: the status reached, when (UTC instant) and by whom. */
export interface ServiceRequestHistoryEntry {
  status: ServiceRequestStatus;
  at: string;
  actor: ServiceRequestActorParty;
  /** The supplier member who took the request, when known. */
  actorName?: string | null;
  /** Rejection reason, on the `Rifiutato` step. */
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
}

/** Long-rent request (`POST /long-rent/service-requests`, D2): for the property, never a booking. */
export interface CreateLongRentServiceRequestDto {
  propertyId: string;
  supplierOrgId: string;
  category: string;
  urgency?: ServiceRequestUrgency;
  notes?: string;
}

export interface SupplierPicker {
  orgId: string;
  legalName: string;
  phone: string;
  email: string;
  categories: string[];
  comuni: string[];
  bio?: string | null;
  photoUrls: string[];
}

export interface SupplierListResponse {
  items: SupplierPicker[];
  totalCount: number;
  page: number;
  pageSize: number;
}
