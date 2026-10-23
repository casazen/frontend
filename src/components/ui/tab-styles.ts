import { cn } from '@/lib/utils';

/** The native menu that takes the place of the tabs on a phone (`Tabs`, `RouteTabs`). */
export const TAB_SELECT_CLASS =
  'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * The link of a tab (`Tabs`, `RouteTabs`): a 44 px target, the underline that marks the open one. The name of a tab that is not
 * open is `foreground/65`, not `muted-foreground`: that token is 4.4:1 on white (4.0 on the track of a control), a hair under what
 * a text needs (4.5:1).
 */
export function tabLinkClass(selected: boolean): string {
  return cn(
    'relative inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-sm px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent after:content-['']",
    selected ? 'text-primary after:bg-primary' : 'text-foreground/65 hover:bg-muted hover:text-foreground',
  );
}
