export type UserRole =
  | 'Admin'
  | 'PropertyOwner'
  | 'PropertyManager'
  | 'Guest'
  | 'Staff'
  | 'LongTermLandlord';

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
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

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}
