import { useContext, useMemo } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getAccessibleAreas } from '@/config/areas';
import type { AppContextKey } from '@/config/route-manifest';
import { supportConfig } from '@/config/support.config';
import { useAppLocale } from '@/hooks/use-app-locale';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import type { CommandContext } from './types';

/**
 * What the sources of the palette need, read from the app (UI-06): the language, the areas and permissions of the user, the
 * feature flags, the cache of the queries. The cache is read from the context if there is one and is simply absent
 * otherwise, so the palette works in the shell without a query client and finds no objects.
 */
export function useCommandContext(activeArea: AppContextKey): CommandContext {
  const { t } = useTranslation();
  const { locale, setLocale } = useAppLocale();
  const { contexts, hasPermission, getDefaultRoute } = useWorkspace();
  const { flags } = useFeatureFlags();
  const { logout } = useAuth();
  const queryClient = useContext(QueryClientContext) ?? null;

  return useMemo(
    () => ({
      t,
      locale,
      activeArea,
      areas: getAccessibleAreas(contexts),
      hasPermission,
      flags,
      getDefaultRoute,
      queryClient,
      supportEmail: supportConfig.email,
      actions: {
        changeLocale: setLocale,
        signOut: logout,
        writeToSupport: (email: string) => {
          const subject = encodeURIComponent(t('commandPalette.actions.support.mailSubject'));
          window.location.assign(`mailto:${email}?subject=${subject}`);
        },
      },
    }),
    [t, locale, activeArea, contexts, hasPermission, flags, getDefaultRoute, queryClient, setLocale, logout],
  );
}
