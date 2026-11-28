import { cn } from '@/lib/utils';

export const TAB_SELECT_CLASS =
  'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function tabLinkClass(selected: boolean): string {
  return cn(
    'relative inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-sm px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent after:content-['']",
    selected
      ? 'text-primary after:bg-primary motion-safe:after:animate-[cz-grow-x_280ms_cubic-bezier(0.05,0.7,0.1,1)]'
      : 'text-foreground/65 hover:bg-muted hover:text-foreground',
  );
}
