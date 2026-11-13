import { useContext } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { useInRouterContext, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RouteTabs, type RouteTabItem } from '@/components/ui/route-tabs';
import { getNavSection, type AppContextKey, type RouteManifestEntry } from '@/config/route-manifest';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useNavCounts, type NavCounts } from '@/hooks/use-nav-counts';
import { getNavCountLabel, getNavLabel } from '@/lib/nav-labels';

/**
 * The areas whose sections are tabs. The staff console and the supplier area keep the links to their sub-pages in the header of the
 * page of the entry (`NavChildLinks`).
 */
const TAB_AREAS: readonly AppContextKey[] = ['short-rent', 'long-rent'];

interface NavSectionTabsProps {
  className?: string;
}

/**
 * The pages of one section of the menu as tabs (UI-04a): an entry of the menu and the pages that hang from it (`navParent` in the
 * route manifest) share the same strip on top of each of them, so that the menu has one entry for what used to be many ("Ospiti" and
 * "Recensioni" are tabs of "Prenotazioni"). It is drawn by `PageHeader`, so a page that has one shows it by itself; it is
 * read from the manifest, so a page that hangs from another shows up here without touching this file. A tab is there only for a
 * page the user may open, and nothing is drawn when the page is not in a section or has no other page in it.
 *
 * A page that hangs from the entry and has a counter (`navCount`: the messages not read yet on «Messaggi», NF-61) shows its number
 * beside its name, with the same words for a screen reader as the menu has; the counter is read from the query the app already makes for
 * it. The counter of the entry itself is in the menu, not on its tab.
 *
 * Like `NavChildLinks` it can be rendered where there is no workspace or no router, as an isolated test of a page does: without a
 * router there is nowhere to go (nothing is shown), without a workspace every page counts, and without a query client there is no
 * number to show.
 */
export function NavSectionTabs({ className }: NavSectionTabsProps) {
  const inRouter = useInRouterContext();
  return inRouter ? <SectionTabs className={className} /> : null;
}

function SectionTabs({ className }: NavSectionTabsProps) {
  const { pathname } = useLocation();
  const workspace = useContext(WorkspaceContext);
  const { flags } = useFeatureFlags();
  const hasQueryClient = useContext(QueryClientContext) !== undefined;

  const section = getNavSection(
    pathname,
    workspace ? (contextKey: AppContextKey, permission: string) => workspace.hasPermission(contextKey, permission) : undefined,
    flags,
  );
  const [head, ...pages] = section;
  if (!head || !TAB_AREAS.includes(head.context)) return null;

  return hasQueryClient && pages.some((page) => page.navCount) ? (
    <CountedSectionTabs section={section} className={className} />
  ) : (
    <SectionTabStrip section={section} counts={{}} className={className} />
  );
}

/** The strip of a section that has a page with a counter: it asks for the numbers, which only a query client can give. */
function CountedSectionTabs({ section, className }: { section: RouteManifestEntry[]; className?: string }) {
  const counts = useNavCounts(section.slice(1));
  return <SectionTabStrip section={section} counts={counts} className={className} />;
}

function SectionTabStrip({ section, counts, className }: { section: RouteManifestEntry[]; counts: NavCounts; className?: string }) {
  const { t } = useTranslation();
  const [head] = section;

  const items: RouteTabItem[] = section.map((page, index) => {
    const count = index > 0 && page.navCount ? (counts[page.navCount] ?? 0) : 0;
    return {
      label: getNavLabel(page, t),
      href: page.path,
      testId: `nav-section-tab-${page.path.slice(`/app/${page.context}/`.length).replace(/\//g, '-')}`,
      ...(count > 0 && page.navCount ? { count, countLabel: getNavCountLabel(page.navCount, count, t) } : {}),
    };
  });

  return (
    <RouteTabs
      label={t('nav.sectionLabel', { section: getNavLabel(head, t) })}
      items={items}
      className={className}
      selectTestId="nav-section-select"
    />
  );
}
