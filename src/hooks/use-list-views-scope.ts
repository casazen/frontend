import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import type { ListViewsScope } from '@/components/shared/list-view/list-types';

/**
 * Whose saved views a list keeps (UI-14): the person who is signed in, in the area (context) they are working in. A page that
 * shows a `ListView` gives it this as `viewsScope`; without it the list offers no saved views. The saved views stay in this
 * browser (see `components/shared/list-view/saved-views`), so an area's lists never show the views of another.
 */
export function useListViewsScope(): ListViewsScope | null {
  const { user } = useAuth();
  const { activeContext } = useWorkspace();
  // Auth0 knows the person by `sub`; the user of the demo mode has only an e-mail.
  const identity = user as { sub?: string; email?: string } | undefined;
  const userId = identity?.sub ?? identity?.email ?? null;

  return useMemo(() => (userId && activeContext ? { userId, context: activeContext } : null), [userId, activeContext]);
}
