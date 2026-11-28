import type { Org } from './org.types';
import type { PlanTier } from './org.types';
import type { OnboardingConsentsPayload } from './onboarding.types';

export type UserRole =
  | 'Admin'
  | 'PropertyOwner'
  | 'LongTermLandlord'
  | 'Supplier'
  | 'PropertyManager'
  | 'Guest'
  | 'Staff'
  | 'None';

export type RentalType = 'ShortTerm' | 'LongTerm' | 'Both';

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  rentalType?: RentalType | null;
  isActive: boolean;
  createdAt: string;
  orgId?: string | null;
  orgName?: string | null;
  planTier?: PlanTier | null;
}

export interface UserDetail extends UserSummary {
  commercialSetupRequired?: boolean;
  commercialEnabledAddons?: string[];
  commercialSignup?: import('@/features/onboarding/commercial-model').CommercialSelection | null;
  phoneNumber?: string;
  updatedAt: string;
  onboardingCompletedAt?: string | null;
  orgId?: string | null;
  org?: Org | null;
  supplierOrgId?: string | null;
  onboardingRequired?: boolean | null;
  consentsAccepted?: boolean | null;
  hasProperties?: boolean | null;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

export const ADMIN_MANAGEABLE_ROLES: UserRole[] = ['Admin', 'PropertyOwner', 'LongTermLandlord', 'Supplier'];

export interface UserRolesResponse {
  id: string;
  roles: UserRole[];
  rolesGranted: UserRole[];
  rolesRevoked: UserRole[];
}

export interface OnboardingRequest {
  commercialSignup?: import('@/features/onboarding/commercial-model').CommercialSelection;
  rentalType: RentalType;
  planTier?: PlanTier;
  consents?: OnboardingConsentsPayload;
}

export interface OnboardingResponse {
  rolesAssigned: string[];
  rentalType: RentalType;
  orgId?: string;
  orgProvisioned?: boolean;
  consentsRecorded?: boolean;
  rolesSynced?: boolean;
  rolesSyncError?: string | null;
}

/**
 * Outcome of a deactivation (`DELETE /users/{id}`) or reactivation (`POST /users/{id}/reactivate`), PL-03. The CasaZen
 * change is always applied; `auth0Synced: false` means Auth0 was not updated (block flag or roles) and repeating the
 * same action retries it. `auth0SyncError` is the stable code.
 */
export interface UserActivationResponse {
  id: string;
  isActive: boolean;
  changed: boolean;
  auth0Synced: boolean;
  auth0SyncError?: string | null;
  message: string;
  rolesRestored: string[];
}

export interface SignupAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  /** Slug of the comune of the SEO page (or its ISTAT code). */
  comune?: string;
  landingPath?: string;
  referrerHost?: string;
}

export interface SignupAttributionResult {
  recorded: boolean;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}
