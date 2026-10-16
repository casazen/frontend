import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_STYLES, type CalmTone } from './calm-tone';

/**
 * The most numbers a strip shows. The redesign conventions (§7bis) say three; the task of the calm blocks allows a fourth for
 * the areas that need it (the home of Affitti brevi has four). More is a report, and a report has its own page.
 */
const MAX_TILES = 4;

export interface StatTileProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'onClick'> {
  /** What the number counts, already translated ("Incassati a ottobre"). */
  label: string;
  /** The number, already formatted for the person ("1.200 €", "87%", 12). */
  value: string | number;
  /** `neutral` (default) is plain; the others color the number and put the icon of the tone before the label. */
  tone?: CalmTone;
  /** How it moves, already formatted with its sign and what it is compared to ("+6% su settembre"). */
  delta?: string;
  /** The tile is a link to the page that explains the number. (A tile that is not a link has no click: it is not a control.) */
  href?: string;
  /** Handed to the page that opens (`useLocation().state`). */
  state?: unknown;
}

/**
 * One number with its name. Not a card: no box, no shadow, so a row of them stays quiet. With an `href` the whole tile is the
 * link (a big target), and a chevron says so.
 */
export function StatTile({ label, value, tone = 'neutral', delta, href, state, className, ...props }: StatTileProps) {
  const style = TONE_STYLES[tone];
  const ToneIcon = tone === 'neutral' ? null : style.Icon;

  const content = (
    <>
      <span className={cn('flex items-center gap-1.5 text-sm text-foreground/70', href !== undefined && 'group-hover/tile:underline')}>
        {ToneIcon ? <ToneIcon aria-hidden="true" className={cn('size-4 shrink-0', style.accent)} /> : null}
        <span className="min-w-0 break-words">{label}</span>
        {href !== undefined ? <ChevronRight aria-hidden="true" className="ml-auto size-4 shrink-0" /> : null}
      </span>
      <span className={cn('mt-1 block break-words text-2xl font-bold tabular-nums tracking-tight', tone === 'neutral' ? 'text-foreground' : style.accent)}>{value}</span>
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
  /** The name of the group for a screen reader. Default: "In breve". */
  label?: string;
  /** Three or four `StatTile`s, directly or in a fragment or a list. */
  children: React.ReactNode;
}

/**
 * Three or four numbers in one quiet row, without charts: one column on a phone, two on a tablet, all in a row from a laptop.
 * More than four is a mistake of the page, and in development it says so in the console.
 *
 *     <StatStrip>
 *       <StatTile label="Incassati a ottobre" value="3.600 €" delta="+6% su settembre" />
 *       <StatTile label="In ritardo" value="1.200 €" tone="danger" href="/app/long-rent/rents?filter=late" />
 *       <StatTile label="Ancora da incassare" value="4.800 €" />
 *     </StatStrip>
 */
export function StatStrip({ label, children, className, ...props }: StatStripProps) {
  const { t } = useTranslation();
  const tiles = tilesOf(children);
  const count = tiles.length;

  React.useEffect(() => {
    if (import.meta.env.DEV && count > MAX_TILES) {
      console.warn(`StatStrip: ${count} tiles. A home shows at most ${MAX_TILES} numbers: keep the ones that matter now.`);
    }
  }, [count]);

  if (count === 0) return null;

  return (
    <div {...props} role="group" aria-label={label ?? t('calm.statStrip.label')} className={cn('min-w-0 border-y border-border', className)}>
      <ul
        role="list"
        className={cn(
          'grid grid-cols-1 gap-x-8 sm:grid-cols-2',
          // Three or four across from a laptop: the sidebar takes its room there, and each number keeps about 170 px.
          count === 3 && 'lg:grid-cols-3',
          count >= 4 && 'lg:grid-cols-4',
        )}
      >
        {tiles.map(({ key, tile }) => (
          <li key={key} className="min-w-0">
            {tile}
          </li>
        ))}
      </ul>
    </div>
  );
}
