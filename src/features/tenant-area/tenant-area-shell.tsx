import { ResidentNavigation } from '@/components/layout/resident-navigation';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, FolderOpen, House, Landmark, Wrench } from 'lucide-react';
import { SkipLink } from '@/components/layout/skip-link';
import '@/styles/resident-portals.css';
import { tenantContractPath, tenantDocumentsPath, tenantDuesPath, tenantMaintenancePath, TENANT_AREA_PATH } from './paths';

const linkClass = 'resident-link min-h-11';

/** The tenant portal: one contract at a time, no organisation menu. Pagamenti is the one place the tenant checks what is paid. */
export function TenantAreaShell() {
  const { t } = useTranslation();
  const { leaseId } = useParams();

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
            </ResidentNavigation>
          ) : (
            <NavLink to={TENANT_AREA_PATH} className={linkClass}>
              <House aria-hidden="true" />{t('tenantArea.nav.contracts')}
            </NavLink>
          )}
        </div>
      </header>
      <main id="tenant-portal-main" tabIndex={-1} className="resident-main focus:outline-none">
        <Outlet />
      </main>
    </div>
  );
}
