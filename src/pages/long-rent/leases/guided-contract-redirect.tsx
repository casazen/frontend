import { Navigate, useLocation, useParams } from 'react-router-dom';

/**
 * The old address of the guided contract, `/app/long-rent/leases/:id/concordatofacile`, goes on to the new one (CF-FLOW). It stays for two
 * reasons: the server still returns from the Stripe checkout to `…/concordatofacile?checkout=success|cancelled`
 * (`ConcordatoFacileCheckoutService`), and people have bookmarks. The query travels with it (`?checkout=`), and the old entry of the
 * history is replaced, so that "back" does not come here to be sent on again.
 */
export function GuidedContractRedirect() {
  const { id } = useParams<{ id: string }>();
  const { search } = useLocation();
  return <Navigate to={`/app/long-rent/leases/${id ?? ''}/guided-contract${search}`} replace />;
}
