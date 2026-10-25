import { Navigate, type RouteObject } from 'react-router-dom';
import { LoginPage } from '@/pages/login-page';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { OwnerDashboard } from '@/pages/owner-portal/OwnerDashboard';
import { OwnerProperties } from '@/pages/owner-portal/OwnerProperties';
import { OwnerStatements } from '@/pages/owner-portal/OwnerStatements';

/**
 * Owner portal routes (ADR-011-R6): dedicated portal with Auth0 login at /portale-proprietari/accedi.
 * All routes require authentication (owner_portal context).
 */
export const ownerPortalRoutes: RouteObject[] = [
  {
    path: '/portale-proprietari/accedi',
    element: <LoginPage />,
  },
  {
    path: '/portale-proprietari',
    element: (
      <ProtectedRoute>
        <OwnerDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/portale-proprietari/immobili/:propertyId',
    element: (
      <ProtectedRoute>
        <OwnerProperties />
      </ProtectedRoute>
    ),
  },
  {
    path: '/portale-proprietari/rendiconti',
    element: (
      <ProtectedRoute>
        <OwnerStatements />
      </ProtectedRoute>
    ),
  },
];
