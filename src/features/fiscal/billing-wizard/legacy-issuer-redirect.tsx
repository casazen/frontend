import { Navigate, useLocation } from 'react-router-dom';
import { BILLING_SETUP_PATH, searchOfLegacy } from './billing-wizard-ids';

/**
 * The old wizard «Come emetti i documenti?» (`/app/short-rent/fiscal/issuer`, E06/F02/US02/T03) is the wizard «Fatturazione» since 2026-11-14: CasaZen issues every document, so
 * there is no longer a choice of the issuer to make. A link or a bookmark to the old address opens the new wizard, at the step that holds what the old step asked.
 */
export function LegacyIssuerRedirect() {
  const { search } = useLocation();
  return <Navigate to={`${BILLING_SETUP_PATH}${searchOfLegacy(search)}`} replace />;
}
