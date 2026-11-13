import { Navigate, type RouteObject } from 'react-router-dom';
import { LoginPage } from '@/pages/login-page';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { OwnerContactPage } from '@/features/owner-portal/owner-contact-page';
import { OwnerInvitationPage } from '@/features/owner-portal/owner-invitation-page';
import { OwnerPortalShell } from '@/features/owner-portal/owner-portal-shell';
import { ownerPortalPaths } from '@/features/owner-portal/paths';
import { OWNER_CONTACT_INVITATION_PATH } from '@/lib/owner-contact-invitation';
import { OWNER_INVITATION_PATH } from '@/lib/owner-invitation';
import { OwnerCalendar } from '@/pages/owner-portal/OwnerCalendar';
import { OwnerContacts } from '@/pages/owner-portal/OwnerContacts';
import { OwnerConversation } from '@/pages/owner-portal/OwnerConversation';
import { OwnerDashboard } from '@/pages/owner-portal/OwnerDashboard';
import { OwnerDocuments } from '@/pages/owner-portal/OwnerDocuments';
import { OwnerInbox } from '@/pages/owner-portal/OwnerInbox';
import { OwnerProperties } from '@/pages/owner-portal/OwnerProperties';
import { OwnerStatements } from '@/pages/owner-portal/OwnerStatements';

/**
 * Owner portal routes (ADR-011-R6, E07/F07/US01/T03): dedicated portal with Auth0 login at /portale-proprietari/accedi.
 * Every page of the portal requires authentication (owner_portal context) and sits in the one shell of the portal, which has the navigation and
 * drops everything the portal read when the person leaves it.
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
    // Link of the e-mail that invites a CONTACT of an owner (E07/F07/US01/T03, NF-111): the same care, its own page and its own secret.
    path: OWNER_CONTACT_INVITATION_PATH,
    element: <OwnerContactPage />,
  },
  {
    path: ownerPortalPaths.home,
    element: (
      <ProtectedRoute>
        <OwnerPortalShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <OwnerDashboard /> },
      { path: 'immobili/:propertyId', element: <OwnerProperties /> },
      { path: 'calendario/:propertyId?', element: <OwnerCalendar /> },
      { path: 'contabilita', element: <OwnerStatements /> },
      // The old address of the statements: the accounting page holds them now.
      { path: 'rendiconti', element: <Navigate to={ownerPortalPaths.accounting} replace /> },
      { path: 'documenti', element: <OwnerDocuments /> },
      { path: 'messaggi', element: <OwnerInbox /> },
      // The link of the e-mail that tells the owner the agency wrote: the id of the conversation only.
      { path: 'messaggi/:conversationId', element: <OwnerConversation /> },
      { path: 'contatti', element: <OwnerContacts /> },
    ],
  },
];
