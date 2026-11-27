import { ResidentNavigation } from '@/components/layout/resident-navigation';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, FolderOpen, House, Landmark, LogOut, Wrench } from 'lucide-react';
import { SkipLink } from '@/components/layout/skip-link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useSeoMeta } from '@/lib/seo-meta';
import '@/styles/resident-portals.css';
import { tenantContractPath, tenantDocumentsPath, tenantDuesPath, tenantMaintenancePath, TENANT_AREA_PATH } from './paths';

const linkClass = 'resident-link min-h-11';

/**
 * The tenant portal: one contract at a time, no organisation menu. Pagamenti is the one place the tenant checks what is paid.
 * It has the same head as the owner portal (UX round 2026-11): the places of the portal, the way back to the contracts and the
 * way out in one row that wraps, and it is not indexed.
 */
export function TenantAreaShell() {
  const { t } = useTranslation();
  const { leaseId } = useParams();
  const { logout } = useAuth();
  useSeoMeta({ title: t('tenantArea.title'), noindex: true });

  const signOut = (
    <Button type="button" variant="outline" className="min-h-11 justify-start bg-card" onClick={() => logout()} data-testid="tenant-sign-out">
      <LogOut aria-hidden="true" className="size-4" />
      {t('tenantArea.signOut')}
    </Button>
  );

  return (
    <div className="resident-shell resident-shell--tenant">
      <SkipLink targetId="tenant-portal-main" />
      <header className="resident-rail">
        <div className="resident-rail__inner">
          <p className="resident-title"><House aria-hidden="true" />{t('tenantArea.title')}</p>
          {leaseId ? (
            <ResidentNavigation label={t('tenantArea.nav.label')}>
              <NavLink to={tenantContractPath(leaseId)} end className={linkClass}>
                <FileText aria-hidden="true" />{t('tenantArea.nav.contract')}
              </NavLink>
              <NavLink to={tenantDuesPath(leaseId)} className={linkClass}>
                <Landmark aria-hidden="true" />{t('tenantArea.nav.dues')}
              </NavLink>
              <NavLink to={tenantDocumentsPath(leaseId)} className={linkClass}>
                <FolderOpen aria-hidden="true" />{t('tenantArea.nav.documents')}
              </NavLink>
              <NavLink to={tenantMaintenancePath(leaseId)} className={linkClass}>
                <Wrench aria-hidden="true" />{t('tenantArea.nav.maintenance')}
              </NavLink>
              <NavLink to={TENANT_AREA_PATH} end className={linkClass}>
                <House aria-hidden="true" />{t('tenantArea.nav.contracts')}
              </NavLink>
              {signOut}
            </ResidentNavigation>
          ) : (
            <ResidentNavigation label={t('tenantArea.nav.label')}>
              <NavLink to={TENANT_AREA_PATH} end className={linkClass}>
                <House aria-hidden="true" />{t('tenantArea.nav.contracts')}
              </NavLink>
              {signOut}
            </ResidentNavigation>
          )}
        </div>
      </header>
      <main id="tenant-portal-main" tabIndex={-1} className="resident-main focus:outline-none">
        <Outlet />
      </main>
    </div>
  );
}
