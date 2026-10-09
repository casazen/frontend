import { Link } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ListMenuEntry, ListRowAction } from './list-types';

/** `/app/...` goes through the router (no reload); anything else (an `https:` link, `mailto:`) is a plain link. */
const isInternalPath = (href: string) => href.startsWith('/') && !href.startsWith('//');

interface ActionButtonProps {
  action: ListRowAction;
  className?: string;
}

/** The one action of a row, always in sight: a link when it goes somewhere, a button when it runs something. */
export function ListPrimaryAction({ action, className }: ActionButtonProps) {
  const Icon = action.icon;
  const content = (
    <>
      {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
      <span className="min-w-0">{action.label}</span>
    </>
  );
  const variant = action.variant ?? 'secondary';

  if (action.href) {
    return (
      <Button asChild variant={variant} size="sm" className={className} data-testid={action.testId}>
        {isInternalPath(action.href) ? <Link to={action.href}>{content}</Link> : <a href={action.href}>{content}</a>}
      </Button>
    );
  }
  return (
    <Button type="button" variant={variant} size="sm" className={className} disabled={action.disabled} onClick={action.onSelect} data-testid={action.testId}>
      {content}
    </Button>
  );
}

function MenuItem({ action }: { action: ListRowAction }) {
  const Icon = action.icon;
  // The text of what destroys is the red of the `danger` tokens (6.5:1 on white), not `destructive` (3.3:1 in the look of today).
  const className = cn('gap-2 pointer-coarse:min-h-11', action.danger && 'text-danger-foreground focus:text-danger-foreground');
  const content = (
    <>
      {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
      {action.label}
    </>
  );

  if (action.href) {
    return (
      <DropdownMenuItem asChild className={className} disabled={action.disabled} data-testid={action.testId}>
        {isInternalPath(action.href) ? <Link to={action.href}>{content}</Link> : <a href={action.href}>{content}</a>}
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem className={className} disabled={action.disabled} onSelect={() => action.onSelect?.()} data-testid={action.testId}>
      {content}
    </DropdownMenuItem>
  );
}

/** The entries of a menu: the actions, and the lines between groups of them. */
export function ListMenuEntries({ entries }: { entries: readonly ListMenuEntry[] }) {
  return (
    <>
      {entries.map((entry, index) =>
        entry === 'separator' ? (
          <DropdownMenuSeparator key={`separator-${index}`} />
        ) : (
          <MenuItem key={entry.id ?? `${entry.label}-${index}`} action={entry} />
        ),
      )}
    </>
  );
}

interface ListRowActionsProps {
  /** The one thing to do about the row. */
  primary?: ListRowAction | null;
  /** The other things, in the menu of "⋯". Nothing in it, no menu. */
  menu?: readonly ListMenuEntry[];
  /** The name of the row, for the label of the menu button ("Altre azioni: Mario Rossi"). */
  name: string;
  /** On a card the action takes the room there is and the buttons are fingers' size. */
  card?: boolean;
}

/** The actions of a row, in the last column of the table and at the foot of a card. */
export function ListRowActions({ primary, menu = [], name, card = false }: ListRowActionsProps) {
  const { t } = useTranslation();
  const hasMenu = menu.some((entry) => entry !== 'separator');
  if (!primary && !hasMenu) return null;

  return (
    <div className={cn('flex items-center gap-2', card ? 'justify-end' : 'justify-end whitespace-nowrap')} data-no-swipe="">
      {primary ? <ListPrimaryAction action={primary} className={card ? 'min-h-11 flex-1 pointer-coarse:min-h-11' : undefined} /> : null}
      {hasMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={t('listView.row.more', { name })} className="shrink-0">
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <ListMenuEntries entries={menu} />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
