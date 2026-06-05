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
  /** Primary role (legacy / display fallback) */
  role: UserRole;
  /** All assigned Auth0 roles */
  roles: UserRole[];
  rentalType?: RentalType | null;
  isActive: boolean;
  createdAt: string;
}

export interface UserDetail extends UserSummary {
  phoneNumber?: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

export interface ChangeRoleRequest {
  role: UserRole;
}

export interface ChangeRolesRequest {
  roles: UserRole[];
}

export interface OnboardingRequest {
  rentalType: RentalType;
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
