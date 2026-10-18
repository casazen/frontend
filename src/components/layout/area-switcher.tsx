import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getAccessibleAreas, getArea } from '@/config/areas';
import type { AppContextKey } from '@/config/route-manifest';
import { useWorkspace } from '@/hooks/use-workspace';
import { cn } from '@/lib/utils';
import { NavIcon } from './nav-icon';
import { useRailTooltip } from './rail-tooltip';

interface AreaSwitcherProps {
  /** The area of the page that is open: the one the switcher shows as current. */
  contextKey: AppContextKey;
  /** The organization of the user, shown under the name of the area (the shell reads it once and hands it down). */
  organizationName?: string | null;
  /** Sidebar reduced to the icons: the switcher keeps only the icon of the area, whose name is a tooltip (UI-04b). */
  collapsed?: boolean;
  className?: string;
}

/**
 * Where the user is and where else it can go (UI-04a): the icon in the accent of the area, its name and the
 * organization, and a menu with the areas the user can open (name, what each is for, the current one ticked).
 * It replaces the icon tabs of the sidebar. With a single area there is nothing to choose: the switcher is only the
 * heading of the sidebar.
 *
 * The menu is a Radix menu: `aria-haspopup`/`aria-expanded` on the button, focus on the current area when it opens,
 * arrows to move, Esc to close and focus back on the button. Choosing an area opens its home; the area is remembered
 * between visits by the workspace (`casazen:active-context`, the server side is UI-13).
 */
export function AreaSwitcher({ contextKey, organizationName = null, collapsed = false, className }: AreaSwitcherProps) {
  const { t } = useTranslation();
  const { contexts, setActiveContext } = useWorkspace();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // Radix puts the focus on the menu when it opens; here it goes on the current area, so that the arrows start from it.
  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const areas = getAccessibleAreas(contexts);
  const current = getArea(contextKey);
  const currentName = t(current.nameKey);
  const hasChoice = areas.length > 1;
  // Reduced to the icon, the area has its name as a tooltip, on hover and on focus (UI-04b).
  const { triggerProps, tooltip } = useRailTooltip(currentName, collapsed);

  const face = (
    <>
      <span
        data-area={current.accent}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"
      >
        <NavIcon name={current.icon} className="h-5 w-5" />
      </span>
      {collapsed ? null : (
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-base font-bold leading-tight">{currentName}</span>
          {organizationName ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{organizationName}</span>
          ) : null}
        </span>
      )}
      {hasChoice && !collapsed ? (
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : null}
    </>
  );

  const faceClass = cn('flex w-full min-w-0 items-center gap-3 rounded-lg p-2', collapsed && 'justify-center px-0');

  if (!hasChoice) {
    return (
      <>
        <div
          data-testid="area-header"
          className={cn(faceClass, className)}
          onPointerEnter={triggerProps.onPointerEnter}
          onPointerLeave={triggerProps.onPointerLeave}
        >
          {face}
          {/* Nothing to click, but the icon alone must still say where the user is. */}
          {collapsed ? (
            <span className="sr-only">{organizationName ? `${currentName}, ${organizationName}` : currentName}</span>
          ) : null}
        </div>
        {tooltip}
      </>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="area-switcher"
          aria-label={t('areas.switcher.current', { name: currentName })}
          className={cn(
            faceClass,
            'min-h-14 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent',
            className,
          )}
          {...triggerProps}
        >
          {face}
        </button>
      </DropdownMenuTrigger>
      {tooltip}
      <DropdownMenuContent
        ref={menuRef}
        align="start"
        data-testid="area-switcher-menu"
        className="w-[min(22rem,calc(100vw-1.5rem))] p-2"
      >
        {organizationName ? (
          <DropdownMenuLabel className="truncate px-3 pb-1 pt-2 uppercase tracking-wide">{organizationName}</DropdownMenuLabel>
        ) : null}
        <DropdownMenuRadioGroup
          value={contextKey}
          onValueChange={(value) => {
            // The current area stays where it is: the menu just closes.
            if (value !== contextKey) setActiveContext(value as AppContextKey);
          }}
        >
          {areas.map((area) => {
            const selected = area.key === contextKey;
            return (
              <DropdownMenuRadioItem
                key={area.key}
                value={area.key}
                data-testid={`area-option-${area.key}`}
                data-area={area.accent}
                className="min-h-16 gap-3 rounded-lg px-3 py-3 data-[state=checked]:bg-primary/10"
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <NavIcon name={area.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t(area.nameKey)}</span>
                  <span className="block text-sm leading-snug text-muted-foreground">{t(area.descriptionKey)}</span>
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
