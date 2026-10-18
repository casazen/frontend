import { useEffect, type CSSProperties } from 'react';
import { Ellipsis, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUiStore } from '@/store/ui-store';
import { cn } from '@/lib/utils';

/** An action of a page: a link when it has `to`, a button when it has `onClick`. */
export interface PageHeaderAction {
  label: string;
  icon?: LucideIcon;
  to?: string;
  onClick?: () => void;
  /** Only a button can be disabled (a link that cannot be followed is not shown). */
  disabled?: boolean;
  testId?: string;
}

/** An action of the menu "⋯": it can be marked as one that is hard to take back. */
export interface PageHeaderMenuAction extends PageHeaderAction {
  danger?: boolean;
}

export type PageHeaderMenuItem = PageHeaderMenuAction | { separator: true };

/**
 * Where the primary action goes on a phone: `bar` fixes it at the bottom, above the bottom bar, as wide as the screen;
 * `fab` as a rounded button on the right; `none` leaves it in the header, next to the title.
 */
export type MobilePrimaryMode = 'bar' | 'fab' | 'none';

function ActionContent({ action }: { action: PageHeaderAction }) {
  const Icon = action.icon;
  return (
    <>
      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      {action.label}
    </>
  );
}

// On a phone the action leaves the flow of the header and sits above the bottom bar (`fixed`). The strip around the button lets
// the page show through and scroll under it (`pointer-events-none`); only the button takes the finger. The page makes room for
// it (`AppShellLayout`) and the toasts come up over it (`AppToaster`), both told by `mobilePrimaryVisible`.
const BAR_STYLES = {
  wrapper:
    'max-md:pointer-events-none max-md:fixed max-md:inset-x-0 max-md:bottom-(--primary-bottom) max-md:z-40 max-md:bg-linear-to-t max-md:from-background max-md:via-background/90 max-md:to-transparent max-md:px-4 max-md:pb-3 max-md:pt-6',
  button: 'max-md:pointer-events-auto max-md:h-12 max-md:w-full max-md:rounded-xl max-md:text-base max-md:shadow-lg',
};
const FAB_STYLES = {
  wrapper: 'max-md:pointer-events-none max-md:fixed max-md:bottom-(--primary-bottom) max-md:right-4 max-md:z-40 max-md:pb-3',
  button: 'max-md:pointer-events-auto max-md:h-14 max-md:rounded-full max-md:px-6 max-md:text-base max-md:shadow-lg',
};

interface PageHeaderPrimaryProps {
  action: PageHeaderAction;
  mode: MobilePrimaryMode;
}

/**
 * The one primary action of a page (UI-05). On a computer it is a button next to the title; on a phone, with `bar` or `fab`,
 * the same button is fixed above the bottom bar so that it is always in reach, and says so (`mobilePrimaryVisible`) to the
 * page and to the toasts. It is one element, moved by CSS: the page has a single copy of it, for keyboards, screen readers
 * and tests.
 */
export function PageHeaderPrimary({ action, mode }: PageHeaderPrimaryProps) {
  const barIsThere = useUiStore((state) => state.bottomBarVisible);
  const setMobilePrimaryVisible = useUiStore((state) => state.setMobilePrimaryVisible);
  const fixed = mode !== 'none';
  const styles = mode === 'fab' ? FAB_STYLES : BAR_STYLES;

  useEffect(() => {
    if (!fixed) return undefined;
    setMobilePrimaryVisible(true);
    return () => setMobilePrimaryVisible(false);
  }, [fixed, setMobilePrimaryVisible]);

  const buttonClass = cn('max-md:min-h-11', fixed && styles.button);

  return (
    <div
      data-testid="page-header-primary"
      data-mobile-primary={mode}
      className={cn(fixed && styles.wrapper)}
      style={
        fixed
          ? ({
              '--primary-bottom': barIsThere
                ? 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))'
                : 'env(safe-area-inset-bottom, 0px)',
            } as CSSProperties)
          : undefined
      }
    >
      {action.to ? (
        <Button asChild className={buttonClass}>
          <Link to={action.to} data-testid={action.testId}>
            <ActionContent action={action} />
          </Link>
        </Button>
      ) : (
        <Button type="button" className={buttonClass} onClick={action.onClick} disabled={action.disabled} data-testid={action.testId}>
          <ActionContent action={action} />
        </Button>
      )}
    </div>
  );
}

interface PageHeaderMenuProps {
  items: PageHeaderMenuItem[];
}

/**
 * The other actions of a page, in the menu "⋯" (UI-05): a Radix menu, so the arrows move, Enter takes the action, Esc closes
 * it and the focus goes back to the button. A link is a link (it can be opened in a new tab), a button is a button.
 */
export function PageHeaderMenu({ items }: PageHeaderMenuProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          data-testid="page-header-more"
          aria-label={t('pageHeader.moreActions')}
          className="max-md:h-11 max-md:w-11"
        >
          <Ellipsis className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {items.map((item, index) => {
          if ('separator' in item) return <DropdownMenuSeparator key={`separator-${index}`} />;

          const itemClass = cn('min-h-9 gap-2 px-3 max-md:min-h-11', item.danger && 'text-destructive focus:text-destructive');
          return item.to ? (
            <DropdownMenuItem key={`${index}-${item.label}`} asChild className={itemClass}>
              <Link to={item.to} data-testid={item.testId}>
                <ActionContent action={item} />
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              key={`${index}-${item.label}`}
              className={itemClass}
              disabled={item.disabled}
              data-testid={item.testId}
              onSelect={() => item.onClick?.()}
            >
              <ActionContent action={item} />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
