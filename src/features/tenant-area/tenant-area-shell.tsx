import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { tenantContractPath, tenantDocumentsPath, tenantDuesPath, tenantMaintenancePath, TENANT_AREA_PATH } from './paths';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm',
    isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:bg-muted',
  );

/** The tenant portal: one contract at a time, no organisation menu. */
export function TenantAreaShell() {
  const { t } = useTranslation();
  const { leaseId } = useParams();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <p className="text-lg font-semibold">{t('tenantArea.title')}</p>
          {leaseId ? (
            <nav aria-label={t('tenantArea.nav.label')} className="flex flex-wrap gap-1">
              <NavLink to={tenantContractPath(leaseId)} end className={linkClass}>
                {t('tenantArea.nav.contract')}
              </NavLink>
              <NavLink to={tenantDuesPath(leaseId)} className={linkClass}>
                {t('tenantArea.nav.dues')}
              </NavLink>
              <NavLink to={tenantDocumentsPath(leaseId)} className={linkClass}>
                {t('tenantArea.nav.documents')}
              </NavLink>
              <NavLink to={tenantMaintenancePath(leaseId)} className={linkClass}>
                {t('tenantArea.nav.maintenance')}
              </NavLink>
            </nav>
          ) : (
            <NavLink to={TENANT_AREA_PATH} className={linkClass}>
              {t('tenantArea.nav.contracts')}
            </NavLink>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
