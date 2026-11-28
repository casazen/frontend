import { ResidentNavigation } from '@/components/layout/resident-navigation';
import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, CalendarDays, FileStack, FolderOpen, LayoutDashboard, LogOut, Mail, ReceiptText, UsersRound } from 'lucide-react';
import { SkipLink } from '@/components/layout/skip-link';
import { Button } from '@/components/ui/button';
import { isFeatureEnabled } from '@/config/feature-flags';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import '@/styles/resident-portals.css';
import { useSeoMeta } from '@/lib/seo-meta';
import { clearOwnerPortalCache, useCanManageOwnerContacts } from '@/queries/ownerPortal';
import { ownerPortalPaths } from './paths';

const MAIN_ID = 'owner-portal-main';

const linkClass = 'resident-link min-h-11';

export function OwnerPortalShell() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const canManageContacts = useCanManageOwnerContacts();
  const { flags } = useFeatureFlags();
  const issuedDocumentsOpen = isFeatureEnabled(flags, 'fiscalDocumentIssuance') && isFeatureEnabled(flags, 'agencyTier');
  useSeoMeta({ title: t('ownerPortal.shell.pageTitle'), noindex: true });

  useEffect(() => () => clearOwnerPortalCache(queryClient), [queryClient]);

  const signOut = () => {
    clearOwnerPortalCache(queryClient);
    logout();
  };

  return (
    <div className="resident-shell resident-shell--owner">
      <SkipLink targetId={MAIN_ID} />
      <header className="resident-rail">
        <div className="resident-rail__inner">
          <p className="resident-title"><Building2 aria-hidden="true" />{t('ownerPortal.shell.title')}</p>
          <ResidentNavigation label={t('ownerPortal.shell.nav.label')} testId="owner-nav">
            <NavLink to={ownerPortalPaths.home} end className={linkClass}>
              <LayoutDashboard aria-hidden="true" />{t('ownerPortal.shell.nav.home')}
            </NavLink>
            <NavLink to={ownerPortalPaths.calendar()} className={linkClass}>
              <CalendarDays aria-hidden="true" />{t('ownerPortal.shell.nav.calendar')}
            </NavLink>
            <NavLink to={ownerPortalPaths.accounting} className={linkClass}>
              <ReceiptText aria-hidden="true" />{t('ownerPortal.shell.nav.accounting')}
            </NavLink>
            <NavLink to={ownerPortalPaths.documents} className={linkClass}>
              <FolderOpen aria-hidden="true" />{t('ownerPortal.shell.nav.documents')}
            </NavLink>
            {issuedDocumentsOpen ? (
              <NavLink to={ownerPortalPaths.issuedDocuments} className={linkClass}>
                <FileStack aria-hidden="true" />{t('ownerPortal.shell.nav.issuedDocuments')}
              </NavLink>
            ) : null}
            <NavLink to={ownerPortalPaths.messages} className={linkClass}>
              <Mail aria-hidden="true" />{t('ownerPortal.shell.nav.messages')}
            </NavLink>
            {canManageContacts ? (
              <NavLink to={ownerPortalPaths.contacts} className={linkClass}>
                <UsersRound aria-hidden="true" />{t('ownerPortal.shell.nav.contacts')}
              </NavLink>
            ) : null}
            <Button type="button" variant="outline" className="min-h-11 justify-start bg-card" onClick={signOut} data-testid="owner-sign-out">
              <LogOut aria-hidden="true" className="size-4" />
              {t('ownerPortal.shell.signOut')}
            </Button>
          </ResidentNavigation>
        </div>
      </header>
      <main id={MAIN_ID} tabIndex={-1} className="resident-main focus:outline-none">
        <Outlet />
      </main>
    </div>
  );
}
