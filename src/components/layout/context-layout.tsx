import { Navigate, Outlet, ScrollRestoration, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoadingScreen } from '@/components/shared/loading-screen';
import type { AppContextKey } from '@/config/route-manifest';
import { useWorkspace } from '@/hooks/use-workspace';
import { AppShellLayout } from './app-shell-layout';

const KNOWN_CONTEXTS: AppContextKey[] = ['short-rent', 'long-rent', 'admin', 'supplier', 'account'];

export function ContextLayout() {
  const { t } = useTranslation();
  const { context } = useParams();
  const location = useLocation();
  const { isReady } = useWorkspace();
  const contextFromPath = location.pathname.split('/')[2] as AppContextKey | undefined;
  const contextKey = (context ?? contextFromPath) as AppContextKey | undefined;

  if (!contextKey || !KNOWN_CONTEXTS.includes(contextKey)) {
    return <Navigate to="/app/choose-context" replace />;
  }

  if (!isReady) {
    return <LoadingScreen message={t('shared.auth.loadingWorkspace')} />;
  }

  return (
    <>
      <AppShellLayout contextKey={contextKey}>
        <Outlet />
      </AppShellLayout>
      <ScrollRestoration />
    </>
  );
}
