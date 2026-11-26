import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { matchesSearch } from '@/components/shared/list-view/list-data';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Search } from 'lucide-react';
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
  const [query, setQuery] = useState('');
  const visible = groups.map(({ name, pages }) => ({
    name,
    links: pages.flatMap(page => entries.filter(entry => entry.path.endsWith('/' + page)))
      .filter(entry => matchesSearch(getNavLabel(entry, t) + ' ' + t('nav.settingsGroups.' + name), query.trim())),
  })).filter(group => group.links.length > 0);
  return (
    <div className="workspace-page space-y-8">
      <PageHeader title={t('nav.settings')} />
      {entries.length > 0 && <label className="relative block max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" className="min-h-11 ps-10" aria-label={t('workspaceView.search')} placeholder={t('workspaceView.search')} value={query} onChange={event => setQuery(event.target.value)} />
      </label>}
      {entries.length > 0 && !visible.length && <p role="status">{t('workspaceView.noMatches')}</p>}
      {entries.length === 0 && <p>{t('nav.settingsGroups.empty')}</p>}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {visible.map(({ name, links }) => {
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
