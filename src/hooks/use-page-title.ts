import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppShell } from '@/components/layout/app-shell-context';
import { getArea } from '@/config/areas';

/** The titles the pages on screen asked for, the latest last, and the title the document had before the first one. */
const claims: Array<{ title: string }> = [];
let titleBeforeTheFirstClaim = '';

/** Puts `title` on the tab until the returned function is called; then the title of the previous claim, or the original. */
function claimTitle(title: string): () => void {
  if (claims.length === 0) titleBeforeTheFirstClaim = document.title;
  const claim = { title };
  claims.push(claim);
  document.title = title;

  return () => {
    const index = claims.indexOf(claim);
    if (index >= 0) claims.splice(index, 1);
    document.title = claims.length > 0 ? claims[claims.length - 1].title : titleBeforeTheFirstClaim;
  };
}

/**
 * The title of the tab for the page that is open (UI-05): "Titolo pagina · Nome area · CasaZen" (the order and the words are
 * in the `pageTitle` strings), where the area is the one of the shell the page is in. Until now it was "CasaZen" on every
 * page, which tells nothing in a list of tabs, in the history or to a screen reader that announces a page without a heading
 * (`RouteFocus` falls back on it).
 *
 * `PageHeader` calls it with its title, so every page that has one has its title. A page that leaves the screen gives the
 * previous title back; two pages claiming it at once (a page inside a page) leave the latest on the tab, and the earlier one
 * when it goes.
 */
export function usePageTitle(page: string | undefined): void {
  const { t } = useTranslation();
  const shell = useAppShell();
  const area = shell ? t(getArea(shell.contextKey).nameKey) : null;

  let title: string | null = null;
  if (page) title = area ? t('pageTitle.withArea', { page, area }) : t('pageTitle.withoutArea', { page });

  useEffect(() => {
    if (!title) return undefined;
    return claimTitle(title);
  }, [title]);
}
