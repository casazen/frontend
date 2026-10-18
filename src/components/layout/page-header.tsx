import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BackLink } from '@/components/shared/back-link';
import { getArea } from '@/config/areas';
import { getDefaultRoute } from '@/config/route-manifest';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { usePageTitle } from '@/hooks/use-page-title';
import { getManifestCrumbs, type PageCrumb } from '@/lib/page-crumbs';
import { useAppShell } from './app-shell-context';
import { PageCrumbs } from './page-crumbs';
import {
  PageHeaderMenu,
  PageHeaderPrimary,
  type MobilePrimaryMode,
  type PageHeaderAction,
  type PageHeaderMenuItem,
} from './page-header-actions';

interface PageHeaderProps {
  title: string;
  description?: string;
  /**
   * Free content on the right of the title, as it always was. A page that is moved to the new header gives its actions as
   * `primary` and `secondary` instead (a page has one primary action).
   */
  action?: React.ReactNode;
  /**
   * Where the page sits (UI-05): the trail to it, the page itself last, with the area put first by the header. `'auto'`
   * reads the trail from the route manifest (the pages above this one, named as the menus name them). On a computer it is
   * the breadcrumb, on a phone the link back to the page above.
   */
  crumbs?: PageCrumb[] | 'auto';
  /** The one primary action of the page (UI-05). */
  primary?: PageHeaderAction;
  /** The other actions, in the menu "⋯" (UI-05). */
  secondary?: PageHeaderMenuItem[];
  /** Where `primary` goes on a phone (UI-05): fixed above the bottom bar (`bar`, the default), a round button (`fab`), or stays up here (`none`). */
  mobilePrimary?: MobilePrimaryMode;
}

/**
 * Title, description and, on the right, the controls of the page. Every page that has one sets the title of the tab
 * (`usePageTitle`).
 *
 * It has to fit a phone whatever the font of the machine: the text block can shrink (`min-w-0`) and a word longer than the
 * screen breaks, and the controls go under the text when they would leave it less than 14rem, instead of pushing out of the
 * screen (a select or two buttons made the whole page scroll sideways at 360-390 px with a font wider than Segoe UI, as the
 * Linux machines of the CI have). With room enough nothing changes: text on the left, controls on the right.
 *
 * Without the props of UI-05 (`crumbs`, `primary`, `secondary`) it is the head every page has, in the same markup, so that
 * the 64 pages that use it are unchanged. With them it becomes the head of the new interface: breadcrumb on a computer and
 * link back on a phone, the primary action next to the title (fixed above the bottom bar on a phone), the others in "⋯".
 */
export function PageHeader({ title, description, action, crumbs, primary, secondary, mobilePrimary }: PageHeaderProps) {
  usePageTitle(title);

  if (crumbs === undefined && primary === undefined && !secondary?.length) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 grow basis-56">
          <h1 className="break-words text-3xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-2 break-words">{description}</p>
          )}
        </div>
        {action && <div className="min-w-0 max-w-full">{action}</div>}
      </div>
    );
  }

  return (
    <PageHeaderWithTrail
      title={title}
      description={description}
      action={action}
      crumbs={crumbs}
      primary={primary}
      secondary={secondary}
      mobilePrimary={mobilePrimary}
    />
  );
}

function PageHeaderWithTrail({ title, description, action, crumbs, primary, secondary, mobilePrimary = 'bar' }: PageHeaderProps) {
  const { t } = useTranslation();
  const shell = useAppShell();
  const { pathname } = useLocation();
  // Read without `useWorkspace`, which refuses to run outside the provider: a page rendered on its own shows its trail.
  const workspace = useContext(WorkspaceContext);
  const { flags } = useFeatureFlags();

  let trail: PageCrumb[] = [];
  if (crumbs === 'auto') {
    if (shell) {
      trail = getManifestCrumbs({
        contextKey: shell.contextKey,
        pathname,
        current: title,
        t,
        hasPermission: workspace?.hasPermission,
        features: flags,
      });
    }
  } else if (crumbs) {
    trail = crumbs;
  }

  // The area comes first, as in the demo: "Affitti lunghi › Immobili › Bilocale Monza".
  const area: PageCrumb | null = shell
    ? { label: t(getArea(shell.contextKey).nameKey), to: getDefaultRoute(shell.contextKey) }
    : null;
  const items = trail.length === 0 ? [] : area ? [area, ...trail] : trail;
  // The way back on a phone: the closest step above the page that leads somewhere.
  const back = items
    .slice(0, -1)
    .reverse()
    .find((item) => item.to);

  const hasActions = Boolean(action) || Boolean(secondary?.length) || primary !== undefined;

  return (
    <div className="flex flex-col gap-2" data-testid="page-header">
      {items.length > 0 ? <PageCrumbs items={items} /> : null}
      {back?.to ? <BackLink to={back.to} label={back.label} /> : null}
      {/* The same row as the head every page has (it wraps and shrinks to fit a phone); the title is smaller on a phone. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 grow basis-56">
          <h1 className="break-words text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          {description ? <p className="mt-2 break-words text-muted-foreground">{description}</p> : null}
        </div>
        {hasActions ? (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            {action}
            {secondary?.length ? <PageHeaderMenu items={secondary} /> : null}
            {primary ? <PageHeaderPrimary action={primary} mode={mobilePrimary} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
