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
import { OwnerIssuedDocuments } from '@/pages/owner-portal/OwnerIssuedDocuments';
import { OwnerProperties } from '@/pages/owner-portal/OwnerProperties';
import { OwnerStatementDetail } from '@/pages/owner-portal/OwnerStatementDetail';
import { OwnerStatements } from '@/pages/owner-portal/OwnerStatements';

/**
 * Owner portal routes (ADR-011-R6, E07/F07/US01/T03): dedicated portal with Auth0 login at /portale-proprietari/accedi.
 * Every page of the portal requires authentication (owner_portal context) and sits in the one shell of the portal, which has the navigation and
 * drops everything the portal read when the person leaves it.
 */
export const ownerPortalRoutes: RouteObject[] = [
  {
    path: ownerPortalPaths.signIn,
    element: <LoginPage />,
  },
  {
    path: OWNER_INVITATION_PATH,
    element: <OwnerInvitationPage />,
  },
  {
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
      { path: 'contabilita/:statementId', element: <OwnerStatementDetail /> },
      { path: 'rendiconti', element: <Navigate to={ownerPortalPaths.accounting} replace /> },
      { path: 'documenti', element: <OwnerDocuments /> },
      { path: 'documenti-emessi', element: <OwnerIssuedDocuments /> },
      { path: 'messaggi', element: <OwnerInbox /> },
      { path: 'messaggi/:conversationId', element: <OwnerConversation /> },
      { path: 'contatti', element: <OwnerContacts /> },
    ],
  },
];
