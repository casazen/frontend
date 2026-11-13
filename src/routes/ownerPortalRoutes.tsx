import type { RouteObject } from 'react-router-dom';
import { LoginPage } from '@/pages/login-page';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { OwnerInvitationPage } from '@/features/owner-portal/owner-invitation-page';
import { OWNER_INVITATION_PATH } from '@/lib/owner-invitation';
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
    // Link of the e-mail that invites a property owner (E10/F03/US05/T01, NF-109): under Auth0 (it leads to the sign-up or the sign-in) but outside the
    // protected route, which would put the secret of the link into a return address. The page takes the secret out of the address at once.
    path: OWNER_INVITATION_PATH,
    element: <OwnerInvitationPage />,
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
