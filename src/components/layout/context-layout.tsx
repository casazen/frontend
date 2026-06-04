import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { AdminAppShell } from './admin-app-shell';
import { LongTermAppShell } from './long-term-app-shell';
import type { AppContextKey } from '@/config/route-manifest';

const KNOWN_CONTEXTS: AppContextKey[] = ['short-rent', 'long-rent', 'admin'];

export function ContextLayout() {
  const { context } = useParams();
  const location = useLocation();
  const contextFromPath = location.pathname.split('/')[2] as AppContextKey | undefined;
  const contextKey = (context ?? contextFromPath) as AppContextKey | undefined;

  if (!contextKey || !KNOWN_CONTEXTS.includes(contextKey)) {
    return <Navigate to="/app/choose-context" replace />;
  }

  if (contextKey === 'long-rent') {
    return (
      <LongTermAppShell>
        <Outlet />
      </LongTermAppShell>
    );
  }

  if (contextKey === 'admin') {
    return (
      <AdminAppShell>
        <Outlet />
      </AdminAppShell>
    );
  }

  return <Outlet />;
}
