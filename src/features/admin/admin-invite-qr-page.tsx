import { Navigate } from 'react-router-dom';

/** Personal QR codes are generated only after creating an agency invitation. */
export function AdminInviteQrPage() {
  return <Navigate to="/app/admin/suppliers/invite" replace />;
}
