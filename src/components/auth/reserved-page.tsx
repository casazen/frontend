import { Link, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { supportConfig } from '@/config/support.config';
import type { AppContextKey } from '@/config/route-manifest';

/** Label of the way back, by area: the home of each area is "Oggi" or "Panoramica" in the redesign. */
const BACK_TO_HOME: Record<AppContextKey, { labelKey: string }> = {
  'short-rent': { labelKey: 'appShell.reserved.backToToday' },
  supplier: { labelKey: 'appShell.reserved.backToToday' },
  'long-rent': { labelKey: 'appShell.reserved.backToOverview' },
  admin: { labelKey: 'appShell.reserved.backToOverview' },
};

interface ReservedPageProps {
  contextKey: AppContextKey;
  /** The home of the area, where the way back leads. */
  homePath: string;
}

/**
 * What `ContextRouteGuard` shows, inside the shell, when the user works in the area but the role has no permission for
 * the page (UI-03). It used to be a silent redirect to the home. It says that the page is reserved, leads back to the
 * home and, only when a support address is configured, lets the user ask for access by e-mail: no other channel is
 * ever suggested (`config/support.config.ts`).
 */
export function ReservedPage({ contextKey, homePath }: ReservedPageProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const supportEmail = supportConfig.email;

  // On the home itself (a role without the permission of its own home) the way back would lead to this same page.
  const showBack = homePath !== pathname;
  const mailto = supportEmail
    ? `mailto:${supportEmail}?subject=${encodeURIComponent(t('appShell.reserved.mailSubject'))}&body=${encodeURIComponent(
        t('appShell.reserved.mailBody', { path: pathname }),
      )}`
    : null;

  return (
    <section
      aria-labelledby="reserved-page-title"
      data-testid="reserved-page"
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 py-12 text-center"
    >
      <div className="rounded-full bg-muted p-5">
        <Lock className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 id="reserved-page-title" className="text-2xl font-bold tracking-tight">
        {t('appShell.reserved.title')}
      </h1>
      <p className="text-sm text-muted-foreground">{t('appShell.reserved.description')}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {showBack ? (
          <Button asChild>
            <Link to={homePath}>{t(BACK_TO_HOME[contextKey].labelKey)}</Link>
          </Button>
        ) : null}
        {mailto ? (
          <Button asChild variant={showBack ? 'outline' : 'default'}>
            <a href={mailto}>{t('appShell.reserved.requestAccess')}</a>
          </Button>
        ) : null}
      </div>
      {mailto ? null : <p className="text-sm text-muted-foreground">{t('appShell.reserved.requestAccessGeneric')}</p>}
    </section>
  );
}
