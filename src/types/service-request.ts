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

export interface ServiceRequestSummary {
  id: string;
  propertyId: string;
  propertyName: string;
  category: string;
  urgency: ServiceRequestUrgency;
  status: ServiceRequestStatus;
  notes?: string | null;
  createdAt: string;
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
