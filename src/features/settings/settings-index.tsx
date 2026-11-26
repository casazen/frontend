import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { getNavChildren } from '@/config/route-manifest';
import { useWorkspace } from '@/hooks/use-workspace';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useCommercialRouteAccess } from '@/hooks/use-commercial-profile';
import { PageHeader } from '@/components/layout/page-header';
import { NavIcon } from '@/components/layout/nav-icon';
import { getNavLabel } from '@/lib/nav-labels';

const groups = [
  { name: 'workspace', pages: ['organization', 'invitations'] },
  { name: 'website', pages: ['site-appearance', 'domain', 'site-documents'] },
  { name: 'money', pages: ['payments', 'plan', 'billing'] },
  { name: 'tools', pages: ['guest-portal', 'integration', 'ai'] },
];

export function SettingsIndex() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const canOpen = useCommercialRouteAccess();
  const entries = getNavChildren(pathname.replace(/\/$/, ''), hasPermission, flags, canOpen);
  return (
    <div className="workspace-page space-y-8">
      <PageHeader title={t('nav.settings')} />
      {entries.length === 0 && <p>{t('nav.settingsGroups.empty')}</p>}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {groups.map(({ name, pages }) => {
          const links = pages.flatMap(page => entries.filter(entry => entry.path.endsWith('/' + page)));
          if (!links.length) return null;
          return (
            <section key={name} aria-labelledby={'settings-' + name}>
              <h2 id={'settings-' + name} className="mb-3 text-base font-semibold">{t('nav.settingsGroups.' + name)}</h2>
              <ul className="divide-y rounded-2xl border bg-card p-2">
                {links.map(entry => (
                  <li key={entry.path}>
                    <Link to={entry.path} className="flex min-h-14 items-center gap-3 rounded-lg px-3 font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                      {entry.navKey === 'nav.stripeConnect' ? (
                        <img src="/brand/stripe.svg" width="20" height="20" alt="" />
                      ) : (
                        <NavIcon name={entry.icon} className="size-5 text-muted-foreground" />
                      )}
                      {getNavLabel(entry, t)}
                      <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
