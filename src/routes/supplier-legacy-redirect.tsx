import { Navigate, useLocation, useParams } from 'react-router-dom';

export function SupplierLegacyPathRedirect() {
  const location = useLocation();
  const { '*': rest } = useParams();
  const segment = (rest ?? '').replace(/^\/+/, '');
  const target = segment ? `/app/supplier/${segment}` : '/app/supplier/inbox';
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}
