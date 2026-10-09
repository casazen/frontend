import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { AppContextKey } from '@/config/route-manifest';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import { buildCommandItems } from './command-items';
import { HighlightedText } from './highlighted-text';
import { readRecents, rememberRecent } from './recents';
import { useRegisteredCommandSources } from './registry';
import {
  countHits,
  mergeRemoteResults,
  prepareCommands,
  searchCommands,
  suggestCommands,
  type CommandGroup,
  type CommandHit,
} from './search';
import type { CommandItem, CommandKind, RemoteCommandSource } from './types';
import { useCommandContext } from './use-command-context';
import { useRemoteCommands } from './use-remote-commands';

// The keys are written out (`*Key:` properties) so that the i18n test finds a missing translation.
const GROUP_LABELS: Record<CommandGroup['id'], { labelKey: string }> = {
  recent: { labelKey: 'commandPalette.groups.recent' },
  page: { labelKey: 'commandPalette.groups.page' },
  action: { labelKey: 'commandPalette.groups.action' },
  property: { labelKey: 'commandPalette.groups.property' },
  booking: { labelKey: 'commandPalette.groups.booking' },
  guest: { labelKey: 'commandPalette.groups.guest' },
};

/** What an item is, for a screen reader, in the group of the recents (where pages, properties and guests are mixed). */
const KIND_LABELS: Record<CommandKind, { labelKey: string }> = {
  page: { labelKey: 'commandPalette.kinds.page' },
  action: { labelKey: 'commandPalette.kinds.action' },
  property: { labelKey: 'commandPalette.kinds.property' },
  booking: { labelKey: 'commandPalette.kinds.booking' },
  guest: { labelKey: 'commandPalette.kinds.guest' },
};

/** What the screen reader is told of the results is said after the person stopped typing, not at every key. */
const ANNOUNCE_DELAY_MS = 400;

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The area of the page that is open. */
  contextKey: AppContextKey;
  /** Who is signed in: the recents are kept for them. Without one nothing is remembered. */
  userId: string | null;
  /** The server search (UI-13). Not passed today: the palette then makes no request of its own. */
  remoteSource?: RemoteCommandSource;
  /** Closes the palette after a choice; `navigated`: the choice led to another page. */
  onChosen: (options: { navigated: boolean }) => void;
  /** Where the focus goes when the palette closes (see {@link CommandPaletteProvider}). */
  onCloseAutoFocus: (event: Event) => void;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-background px-1.5 py-0.5 font-sans text-[11px] font-medium text-foreground/80">
      {children}
    </kbd>
  );
}

interface OptionRowProps {
  hit: CommandHit;
  domId: string;
  active: boolean;
  /** Says what the item is before its label (in the recents). */
  kindLabel?: string;
  onChoose: (item: CommandItem) => void;
  onPoint: (event: React.PointerEvent, id: string) => void;
}

function OptionRow({ hit, domId, active, kindLabel, onChoose, onPoint }: OptionRowProps) {
  const { item } = hit;
  const Icon = item.icon;

  return (
    <div
      role="option"
      id={domId}
      aria-selected={active}
      data-testid="command-palette-option"
      data-kind={item.kind}
      onClick={() => onChoose(item)}
      onPointerMove={(event) => onPoint(event, item.id)}
      className={cn(
        'relative flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2',
        // The open row is told by its background and a bar on the left, not by a color alone.
        active &&
          "bg-primary/10 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-full before:bg-primary before:content-['']",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('h-5 w-5 shrink-0', active ? 'text-[color:var(--color-primary-text,var(--color-primary))]' : 'text-foreground/70')}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {kindLabel ? <span className="sr-only">{kindLabel}: </span> : null}
          <HighlightedText text={item.label} ranges={hit.titleRanges} />
        </span>
        {item.subtitle ? (
          <span className="block truncate text-xs text-foreground/70">
            <HighlightedText text={item.subtitle} ranges={hit.subtitleRanges} />
          </span>
        ) : null}
      </span>
    </div>
  );
}

interface PaletteBodyProps {
  inputId: string;
  contextKey: AppContextKey;
  userId: string | null;
  remoteSource?: RemoteCommandSource;
  onChosen: CommandPaletteProps['onChosen'];
}

/**
 * What is inside the dialog. It is only mounted while the palette is open, so the sources are read (and the cache of the
 * queries with them) when the person asks for the palette, not at every render of the shell.
 */
function PaletteBody({ inputId, contextKey, userId, remoteSource, onChosen }: PaletteBodyProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const listboxId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const lastPointer = useRef({ x: -1, y: -1 });

  const [query, setQuery] = useState('');
  // The row with the cursor is remembered by the item, not by its place: a result that arrives late does not move it.
  const [activeId, setActiveId] = useState<string | null>(null);

  const context = useCommandContext(contextKey);
  const registered = useRegisteredCommandSources();
  const items = useMemo(() => buildCommandItems(context, registered), [context, registered]);
  const prepared = useMemo(() => prepareCommands(items), [items]);
  const remote = useRemoteCommands(query, remoteSource);
  const recentIds = useMemo(() => (userId ? readRecents({ userId, area: contextKey }) : []), [userId, contextKey]);

  const typed = query.trim() !== '';
  const groups = useMemo<CommandGroup[]>(() => {
    if (!typed) return suggestCommands(items, { activeArea: contextKey, recentIds });
    return mergeRemoteResults(searchCommands(prepared, query, { activeArea: contextKey }), remote.items, query);
  }, [typed, items, prepared, query, contextKey, recentIds, remote.items]);

  const rows = useMemo(() => groups.flatMap((group) => group.hits), [groups]);
  // The place of each result among all the rows, whichever group it is in (an item shows once in a view).
  const indexOfItem = useMemo(() => new Map(rows.map((hit, index) => [hit.item.id, index])), [rows]);
  const activeIndex = Math.max(0, indexOfItem.get(activeId ?? '') ?? 0);
  const hasRows = rows.length > 0;
  const rowDomId = (index: number) => `${listboxId}-option-${index}`;
  const activeDomId = hasRows ? rowDomId(activeIndex) : undefined;

  // The row that has the cursor stays in sight when the arrows move it down or up a long list.
  useEffect(() => {
    const row = activeDomId ? document.getElementById(activeDomId) : null;
    const list = listRef.current;
    if (!row || !list) return;
    // The first row has the heading of its group above it: back to the top, not just to the row.
    if (activeIndex === 0) list.scrollTop = 0;
    else row.scrollIntoView?.({ block: 'nearest' });
  }, [activeDomId, activeIndex]);

  const total = countHits(groups);
  let message = '';
  if (typed) {
    if (total > 0) message = t('commandPalette.status.results', { count: total });
    else message = remote.pending ? t('commandPalette.status.searching') : t('commandPalette.status.noResults');
  }
  const announced = useDebouncedValue(message, ANNOUNCE_DELAY_MS);

  const choose = (item: CommandItem) => {
    if (item.run) {
      item.run();
      onChosen({ navigated: false });
      return;
    }
    if (!item.to) return;
    if (userId) rememberRecent({ userId, area: contextKey }, item.id);
    navigate(item.to);
    onChosen({ navigated: item.to.split(/[?#]/)[0] !== pathname });
  };

  const moveTo = (index: number) => {
    const hit = rows[(index + rows.length) % rows.length];
    if (hit) setActiveId(hit.item.id);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter that picks a letter in an input method is not a choice.
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveTo(activeIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveTo(activeIndex - 1);
        break;
      case 'Home':
        if (hasRows) {
          event.preventDefault();
          moveTo(0);
        }
        break;
      case 'End':
        if (hasRows) {
          event.preventDefault();
          moveTo(rows.length - 1);
        }
        break;
      case 'Enter':
        if (hasRows) {
          event.preventDefault();
          choose(rows[activeIndex].item);
        }
        break;
      default:
        break;
    }
  };

  const pointAt = (event: React.PointerEvent, id: string) => {
    // A list that scrolls under a still mouse makes the browser send a move without a movement: it is not the person pointing.
    const { clientX: x, clientY: y } = event;
    if (x === lastPointer.current.x && y === lastPointer.current.y) return;
    lastPointer.current = { x, y };
    setActiveId(id);
  };

  return (
    <div className="flex min-h-0 flex-col max-sm:flex-1" data-testid="command-palette-body">
      <div className="flex items-center gap-3 border-b px-4 focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring max-sm:pr-16">
        <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-foreground/70" />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={hasRows}
          aria-controls={hasRows ? listboxId : undefined}
          aria-activedescendant={activeDomId}
          aria-autocomplete="list"
          aria-label={t('commandPalette.placeholder')}
          placeholder={t('commandPalette.placeholder')}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="search"
          enterKeyHint="go"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            // A new text starts again from the first result.
            setActiveId(null);
          }}
          onKeyDown={onKeyDown}
          data-testid="command-palette-input"
          className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-foreground/60 sm:pr-8"
        />
      </div>

      {hasRows ? (
        // The listbox is what scrolls: the popup of the combobox (`aria-controls` of the box), not a wrapper around it. The
        // focus stays in the box, the cursor moves with the arrows and scrolls the list; a click does not take the focus
        // from the box either, and `tabIndex={-1}` keeps the browsers that let a scroller take the focus (Chrome) from making
        // the list a stop of its own between the box and the close button.
        <div
          ref={listRef}
          role="listbox"
          id={listboxId}
          tabIndex={-1}
          aria-label={t('commandPalette.results')}
          data-testid="command-palette-list"
          onMouseDown={(event) => event.preventDefault()}
          className="max-h-[min(26rem,60vh)] overflow-y-auto overscroll-contain p-2 max-sm:min-h-0 max-sm:max-h-none max-sm:flex-1"
        >
          {groups.map((group) => {
            const headingId = `${listboxId}-group-${group.id}`;
            return (
              <div key={group.id} role="group" aria-labelledby={headingId}>
                <div
                  id={headingId}
                  role="presentation"
                  className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-foreground/70"
                >
                  {t(GROUP_LABELS[group.id].labelKey)}
                </div>
                {group.hits.map((hit) => {
                  const index = indexOfItem.get(hit.item.id) ?? 0;
                  return (
                    <OptionRow
                      key={hit.item.id}
                      hit={hit}
                      domId={rowDomId(index)}
                      active={index === activeIndex}
                      kindLabel={group.id === 'recent' ? t(KIND_LABELS[hit.item.kind].labelKey) : undefined}
                      onChoose={choose}
                      onPoint={pointAt}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <div data-testid="command-palette-empty" className="flex flex-col items-center gap-1 px-4 py-10 text-center">
          <p className="max-w-full break-words text-sm font-medium">
            {typed ? t('commandPalette.noResults.title', { query: query.trim() }) : t('commandPalette.placeholder')}
          </p>
          {typed ? <p className="text-sm text-foreground/70">{t('commandPalette.noResults.description')}</p> : null}
        </div>
      )}

      <div
        aria-hidden="true"
        className="hidden items-center gap-4 border-t bg-muted/50 px-4 py-2 text-xs text-foreground/70 sm:flex"
      >
        <span className="inline-flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          {t('commandPalette.hints.navigate')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>{t('commandPalette.keys.enter')}</Kbd>
          {t('commandPalette.hints.open')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>{t('commandPalette.keys.escape')}</Kbd>
          {t('commandPalette.hints.close')}
        </span>
      </div>

      {/* Said after the person stopped typing: how many results there are, or that there are none. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="command-palette-status">
        {announced}
      </div>
    </div>
  );
}

/**
 * The global search (UI-06): a dialog with a text box and the list of what the text finds, in groups. It opens with Ctrl+K
 * (Cmd+K on a Mac) and from the search of the header, and finds the pages of the menus, the actions and the properties,
 * bookings and guests the pages have already loaded; choosing a result goes there. It is a combobox with a listbox
 * (`aria-activedescendant`: the focus stays in the text box); the arrows, Home and End move through the results, Enter
 * chooses, Esc closes and the focus goes back to where it was. On a phone the dialog is a sheet from the bottom (`Dialog`).
 */
export function CommandPalette({
  open,
  onOpenChange,
  contextKey,
  userId,
  remoteSource,
  onChosen,
  onCloseAutoFocus,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const inputId = useId();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-command-palette-dialog=""
        data-testid="command-palette"
        // The input is the first thing in the dialog: it takes the focus, and the arrows reach the rest through it.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById(inputId)?.focus();
        }}
        onCloseAutoFocus={onCloseAutoFocus}
        // On a phone the sheet is nearly as tall as the screen: the box is at the top, so that the on-screen keyboard (which
        // covers the bottom of the screen and does not push a fixed sheet up) leaves the first results in sight.
        className="gap-0 p-0 sm:top-[12vh] sm:max-w-[40rem] sm:translate-y-0 sm:overflow-hidden max-sm:h-[92dvh] max-sm:pb-[env(safe-area-inset-bottom)]"
      >
        <DialogTitle className="sr-only">{t('commandPalette.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('commandPalette.description')}</DialogDescription>
        <PaletteBody inputId={inputId} contextKey={contextKey} userId={userId} remoteSource={remoteSource} onChosen={onChosen} />
      </DialogContent>
    </Dialog>
  );
}
