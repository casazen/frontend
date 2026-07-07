export type ServiceRequestStatus =
  | 'Richiesto'
  | 'PresoInCarico'
  | 'InCorso'
  | 'Completato'
  | 'Pagato'
  | 'Rifiutato';

export type ServiceRequestUrgency = 'Normal' | 'High' | 'Emergency';

export interface ServiceRequest {
  id: string;
  orgId: string;
  bookingId?: string | null;
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

export interface CreateServiceRequestDto {
  propertyId: string;
  bookingId?: string;
  supplierOrgId: string;
  category: string;
  urgency?: ServiceRequestUrgency;
  notes?: string;
  chargeToGuest?: boolean;
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

export interface SupplierMatchCandidate {
  orgId: string;
  legalName: string;
  phone: string;
  email: string;
  bio?: string | null;
  matchScore: number;
  matchReason: string;
  source: string;
}

export interface ExternalSupplierSuggestion {
  name: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  googleMapsUrl?: string | null;
  websiteUrl?: string | null;
  source: string;
}

export interface SupplierMatchResponse {
  recommended?: SupplierMatchCandidate | null;
  alternatives: SupplierMatchCandidate[];
  externalSuggestions: ExternalSupplierSuggestion[];
  usedExternalFallback: boolean;
}

export interface MatchSupplierDto {
  propertyId: string;
  category: string;
  urgency?: ServiceRequestUrgency;
  notes?: string;
}
