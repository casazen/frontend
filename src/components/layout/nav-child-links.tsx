import { useContext } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { getNavChildren, type AppContextKey } from '@/config/route-manifest';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getNavLabel } from '@/lib/nav-labels';

interface NavChildLinksProps {
  /** `path` of the page that shows the links: the entry of the route manifest the pages hang from (`navParent`). */
  parentPath: string;
}

/**
 * Links to the pages that hang from this one (UI-04a). Those pages are in no menu (`navParent` in the route manifest): the
 * sidebar keeps this page highlighted while one of them is open, and this is the way in. Put it in the `action` of the
 * `PageHeader`. The list comes from the manifest, so a page that hangs from another entry shows up here by itself; the
 * links are those the user may open. Nothing is shown when there are none.
 *
 * Like the org badge (`useBillingContext`) it can be rendered where there is no workspace or no router, as an isolated
 * test of a page does: without a router there is nowhere to go (nothing is shown), without a workspace every page counts.
 */
export function NavChildLinks({ parentPath }: NavChildLinksProps) {
  const { t } = useTranslation();
  const inRouter = useInRouterContext();
  const workspace = useContext(WorkspaceContext);
  const { flags } = useFeatureFlags();

  const children = getNavChildren(
    parentPath,
    workspace ? (contextKey: AppContextKey, permission: string) => workspace.hasPermission(contextKey, permission) : undefined,
    flags,
  );
  if (!inRouter || children.length === 0) return null;

  return (
    <div role="group" aria-label={t('nav.childLinksLabel')} data-testid="nav-child-links" className="flex flex-wrap items-center gap-2">
      {children.map((child) => (
        <Button key={child.path} asChild variant="outline" size="sm">
          <Link to={child.path}>{getNavLabel(child, t)}</Link>
        </Button>
      ))}
    </div>
  );
}
