import { useLayoutEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { uiAreaFromPath } from '@/lib/ui-area';

/**
 * Puts the active area on <html> as `data-area` (UI-01): `short-rent`, `long-rent`, `supplier` or `admin` (and `account`,
 * the customer's administration, once it exists), the key `html[data-ui='v2'][data-area=...]` of `src/styles/tokens.css`
 * uses to pick the accent. It is on <html> and not on the shell because Radix portals (dialogs, menus, sheets) render outside
 * the shell, and it is removed when the area is left, so the pages without an area (login, area picker) have the brand ink.
 *
 * The attribute is inert without `data-ui="v2"`: no style reads it.
 *
 * The area is the second segment of `/app/<area>/...`, the same source `ContextLayout` reads; it is set before the browser
 * paints, so the first frame already has the right accent.
 */
export function AreaProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const area = uiAreaFromPath(pathname);

  useLayoutEffect(() => {
    if (!area) return undefined;
    const root = document.documentElement;
    root.setAttribute('data-area', area);
    return () => root.removeAttribute('data-area');
  }, [area]);

  return <>{children}</>;
}
