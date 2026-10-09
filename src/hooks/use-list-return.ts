import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { rememberList } from '@/lib/list-return';

/**
 * For a list page (UI-05): remembers its filters, search and tab, which live in the query string of the address, every time
 * they change. The way back from a detail page (`BackLink`, the breadcrumb of `PageHeader`: they read it with
 * `withListReturn`) then leads to the list as the user left it, and not to the plain list. `listKey` is the address of the
 * list.
 *
 * The browser's own Back button needs none of this: the filters are in the address, so the page it returns to has them.
 * What is remembered is the state of the list on its last visit, so opening it from the menu with no filters clears it.
 */
export function useListReturn(listKey: string): void {
  const { search } = useLocation();

  useEffect(() => {
    rememberList(listKey, search);
  }, [listKey, search]);
}
