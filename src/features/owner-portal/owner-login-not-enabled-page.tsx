import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getHostSite } from '@/lib/host-site';
import { useSeoMeta } from '@/lib/seo-meta';

/**
 * Every address under `/portale-proprietari` on the own domain of an agency whose owner portal is on but whose domain is not yet registered with the sign-in service (E40/F02/US01/T02,
 * NF-141): the sign-in page, the pages of the invitations and the portal itself. It is one page and an honest one: it says that the owner access of this site is not active yet, who to ask
 * (the agency, by name: the contract of `resolve-host` has no contact) and the way back to the site. Nothing is sent to the sign-in service, no sign-in module is mounted on the page
 * (`hostNeedsAuth`, in `App`) and no error screen is shown.
 *
 * The link of an invitation (`/portale-proprietari/invito?token=…`, `/portale-proprietari/contatto?token=…`) carries a secret in its query. This page does not read it, keep it or send
 * it anywhere: it only takes the query out of the address bar at once (a replacement of the history entry), so that the secret stays out of the history and of what a link leaving the
 * page would say of it. The invited person opens the link of the e-mail again when the access is active.
 */
export function OwnerLoginNotEnabledPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  const name = getHostSite()?.displayName ?? '';
  useSeoMeta({ title: t('ownerPortal.notEnabled.title'), noindex: true });

  useEffect(() => {
    if (search !== '') navigate({ pathname, hash }, { replace: true });
  }, [hash, navigate, pathname, search]);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10" data-testid="owner-login-not-enabled">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-muted text-foreground">
          <LockKeyhole className="size-7" />
        </span>
        <h1 className="public-display text-2xl font-semibold">{t('ownerPortal.notEnabled.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('ownerPortal.notEnabled.description', { name })}</p>
        <Button asChild className="min-h-11">
          <Link to="/" data-testid="owner-login-not-enabled-home">
            {t('ownerPortal.notEnabled.home')}
          </Link>
        </Button>
      </div>
    </main>
  );
}
