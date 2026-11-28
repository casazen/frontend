import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_STYLES, type CalmTone } from './calm-tone';

const MAX_TILES = 4;

export interface StatTileProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'onClick'> {
  label: string;
  value: string | number;
  tone?: CalmTone;
  icon?: LucideIcon;
  delta?: string;
  href?: string;
  state?: unknown;
}

export function StatTile({ label, value, tone = 'neutral', icon, delta, href, state, className, ...props }: StatTileProps) {
  const style = TONE_STYLES[tone];
  const ToneIcon = tone === 'neutral' ? icon : style.Icon;

  const content = (
    <>
      <span className={cn('flex items-center gap-1.5 self-start text-sm text-foreground/70', href !== undefined && 'group-hover/tile:underline')}>
        {ToneIcon ? <ToneIcon aria-hidden="true" className={cn('size-5 shrink-0', style.accent)} /> : null}
        <span className="min-w-0 break-words">{label}</span>
        {href !== undefined ? <ChevronRight aria-hidden="true" className="ml-auto size-4 shrink-0" /> : null}
      </span>
      <span className={cn('mt-1 block break-words text-2xl font-bold xl:text-3xl tabular-nums tracking-tight', tone === 'neutral' ? 'text-foreground' : style.accent)}>{value}</span>
      {delta ? <span className="mt-1 block break-words text-sm text-foreground/70">{delta}</span> : null}
    </>
  );

  if (href !== undefined) {
    return (
      <Link
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        to={href}
        state={state}
        className={cn(
          'group/tile block min-w-0 rounded-md py-3 outline-hidden ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className,
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <div {...props} className={cn('min-w-0 py-3', className)}>
      {content}
    </div>
  );
}

interface Entry {
  key: string;
  tile: React.ReactElement;
}

/**
 * The tiles among the children, whatever wraps them: a list from `map`, a condition that is false, a fragment. Each one has a
 * key that belongs to it alone (its own, with the path of the fragments around it), so that a tile that comes or goes does not
 * make the tiles after it start again (a focused link would lose the focus).
 */
function tilesOf(children: React.ReactNode, path = ''): Entry[] {
  return React.Children.toArray(children).flatMap((child): Entry[] => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return [];
    const key = `${path}${child.key ?? ''}`;
    return child.type === React.Fragment ? tilesOf(child.props.children, `${key}/`) : [{ key, tile: child }];
  });
}

export interface StatStripProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  children: React.ReactNode;
}

// The tiles of a strip are subgrids of it (written out in full, so that Tailwind finds the classes): the item of the list and the
// tile in it take three rows, the name, the number and how it moves, so that a name on two lines or a number without a delta does
// not move the number of that tile alone, and the numbers of a line start at the same height. The rows have no gap, and the
// delta is the last one: a tile without it has nothing to fill. On a phone, a column or a carousel, there is nothing to line up.
const TILE_ROWS = 'sm:row-span-3 sm:grid sm:grid-rows-subgrid sm:*:row-span-3 sm:*:grid sm:*:grid-rows-subgrid';
const TILE_ROWS_BESIDE_A_LIST = 'lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:*:row-span-3 lg:*:grid lg:*:grid-rows-subgrid';
const LIST_ROWS = 'lg:row-span-4';

export function StatStrip({ label, children, className, ...props }: StatStripProps) {
  const { t } = useTranslation();
  const tiles = tilesOf(children);
  const count = tiles.length;
  const besideAList = tiles.some(({ tile }) => tile.type !== StatTile);

  React.useEffect(() => {
    if (import.meta.env.DEV && count > MAX_TILES) {
      console.warn(`StatStrip: ${count} tiles. A home shows at most ${MAX_TILES} numbers: keep the ones that matter now.`);
    }
  }, [count]);

  if (count === 0) return null;

  return (
    <div {...props} role="group" aria-label={label ?? t('calm.statStrip.label')} className={cn('min-w-0 rounded-xl border border-border bg-card px-4', className)}>
      <ul
        role="list"
        className={cn(
          'grid grid-cols-1 gap-x-5',
          count === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
          count >= 4 && 'lg:grid-cols-4',
          besideAList && 'lg:auto-rows-[auto_auto_auto_1fr]',
        )}
      >
        {tiles.map(({ key, tile }) => (
          <li key={key} className={cn('min-w-0', tile.type === StatTile ? (besideAList ? TILE_ROWS_BESIDE_A_LIST : TILE_ROWS) : LIST_ROWS)}>
            {tile}
          </li>
        ))}
      </ul>
    </div>
  );
}
