import type { Org } from './org.types';
import type { PlanTier } from './org.types';
import type { OnboardingConsentsPayload } from './onboarding.types';

export type UserRole =
  | 'Admin'
  | 'PropertyOwner'
  | 'PropertyManager'
  | 'Guest'
  | 'Staff'
  | 'LongTermLandlord';

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
  phoneNumber?: string;
  updatedAt: string;
  // UTC timestamp when user completed onboarding. Null if user has not completed onboarding yet.
  onboardingCompletedAt?: string | null;
  // Tenant boundary (#202, AC9). Nullable: a brand-new user pre-backfill has no org yet.
  orgId?: string | null;
  org?: Org | null;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

export interface ChangeRoleRequest {
  role: UserRole;
}

export interface OnboardingRequest {
  rentalType: RentalType;
  planTier?: PlanTier;
  consents?: OnboardingConsentsPayload;
}

export interface OnboardingResponse {
  rolesAssigned: string[];
  rentalType: RentalType;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}
