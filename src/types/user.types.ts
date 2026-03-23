export type Role = 'ADMIN' | 'MANAGER' | 'GUEST';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}
