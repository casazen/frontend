import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Bookmark, Columns3, Download, LayoutList, ListChecks, MoreHorizontal, Search, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { toastUndo } from '@/lib/toast-undo';
import { formatStayDate } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { chipCount, resolveOptions } from './list-data';
import { activeFilterCount, isSameView, parseDateRange, parseMultiValue, presetToState, readListState, viewQuery } from './list-state';
import { ListColumnsDialog, ListDeleteViewsDialog, ListFilterPanel, ListSaveViewDialog, ListSortDialog } from './list-panels';
import { useReturnFocus } from './use-return-focus';
import type { ListDefinition, ListFilter, ListMode } from './list-types';
import type { UseListState } from './use-list-state';
import type { UseSavedViews } from './use-saved-views';

/** The title of a group in a menu: `foreground/70`, because the `muted-foreground` of the label is 4.36:1 on white and a text needs 4.5:1. */
const MENU_LABEL = 'text-foreground/70';

/** How long the search waits after the last key before it goes to the address, ms. */
export const SEARCH_DEBOUNCE_MS = 350;

interface SearchBoxProps {
  /** The name of the box for a screen reader and the hint in it. */
  label: string;
  placeholder: string;
  /** The search as the address has it. */
  value: string;
  onCommit: (q: string) => void;
}

/**
 * The search box. What is typed shows at once and goes to the address a moment after the last key (or with Enter); the box
 * follows the address when it changes by itself (Back, a saved view, "Azzera i filtri") and never overwrites what is being typed.
 */
function SearchBox({ label, placeholder, value, onCommit }: SearchBoxProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(value);
  // What this box last sent to the address, and the address it last saw: together they tell a change that came back from
  // here from one that came from elsewhere.
  const [sent, setSent] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== sent) {
      setDraft(value);
      setSent(value);
    }
  }

  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });
  useEffect(() => {
    if (draft === sent) return;
    const timer = setTimeout(() => {
      setSent(draft);
      commit.current(draft);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, sent]);

  return (
    <form
      role="search"
      className="relative min-w-0 flex-1 basis-60 md:max-w-md"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (draft !== sent) {
          setSent(draft);
          onCommit(draft);
        }
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/60" aria-hidden="true" />
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Input
        id={inputId}
        type="search"
        name="q"
        value={draft}
        placeholder={placeholder}
        autoComplete="off"
        className="pl-9"
        onChange={(event) => setDraft(event.target.value)}
      />
    </form>
  );
}

/** What a filter that is on says, for the tag that removes it: "Immobile: Trullo". */
function filterTagText<Row>(filter: ListFilter<Row>, value: string, rows: readonly Row[], t: TFunction, language: string): string {
  if (filter.type === 'date') {
    const { from, to } = parseDateRange(value);
    const show = (date: string) => formatStayDate(date, language, { day: 'numeric', month: 'short', year: 'numeric' });
    const text = from && to ? t('listView.filters.rangeBoth', { from: show(from), to: show(to) }) : from ? t('listView.filters.rangeFrom', { date: show(from) }) : t('listView.filters.rangeTo', { date: show(to ?? '') });
    return `${filter.label}: ${text}`;
  }
  const options = resolveOptions(filter.options, rows);
  const labelOf = (id: string) => options.find((option) => option.value === id)?.label ?? id;
  const text = filter.type === 'multi' ? parseMultiValue(value).map(labelOf).join(', ') : labelOf(value);
  return `${filter.label}: ${text}`;
}

type PanelName = 'filters' | 'columns' | 'sort' | 'save-view' | 'delete-views';

export interface ListToolbarProps<Row> {
  list: ListDefinition<Row>;
  listState: UseListState;
  /** Every row the list has now: the choices of a filter drawn from the rows, and the number of results of the panel. */
  rows: readonly Row[];
  /** The rows that pass the search and the filters, whatever the quick filter: what the counters of the chips count. */
  chipRows: readonly Row[];
  /** `server` mode: the counters of the chips that need attention, by id (the list cannot count what it does not have). */
  chipCounts?: Readonly<Record<string, number | undefined>>;
  mode: ListMode;
  savedViews: UseSavedViews;
  /** Where the CSV can be had and what the menu says about it. */
  exportLabel: string | null;
  onExport: () => void;
  hasBulk: boolean;
  selectMode: boolean;
  onToggleSelectMode: () => void;
}

/** The bar over the rows: the search, the quick filters, the filters, the views, the choices of the "⋯" menu. */
export function ListToolbar<Row>({
  list,
  listState,
  rows,
  chipRows,
  chipCounts,
  mode,
  savedViews,
  exportLabel,
  onExport,
  hasBulk,
  selectMode,
  onToggleSelectMode,
}: ListToolbarProps<Row>) {
  const { t, i18n } = useTranslation();
  const { state } = listState;
  const [panel, setPanel] = useState<PanelName | null>(null);
  const { remember, onCloseAutoFocus } = useReturnFocus();
  const filtersButton = useRef<HTMLButtonElement>(null);
  const viewsButton = useRef<HTMLButtonElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);

  const chips = list.chips ?? [];
  const nFilters = activeFilterCount(state);
  const presets = list.views ?? [];
  const sortable = list.columns.some((column) => column.sort);
  const canChooseColumns = list.columns.some((column) => !column.always);

  // The view the list is in, if it is one of the views the person can pick.
  const presetNow = presets.find((view) => isSameView(list, presetToState(list, view.state), state));
  const savedNow = savedViews.views.find((view) => isSameView(list, readListState(list, new URLSearchParams(view.query)), state));
  const viewNow = presetNow ? `preset:${presetNow.id}` : savedNow ? `saved:${savedNow.id}` : '';

  const open = (name: PanelName, from: HTMLElement | null) => {
    remember(from);
    setPanel(name);
  };

  const tags = [
    ...(state.q.trim() ? [{ id: 'q', text: t('listView.tags.search', { q: state.q.trim() }), remove: () => listState.setQ('') }] : []),
    ...(list.filters ?? []).flatMap((filter) => {
      const value = state.filters[filter.id];
      if (!value) return [];
      const rest = { ...state.filters };
      delete rest[filter.id];
      return [{ id: `f_${filter.id}`, text: filterTagText(filter, value, rows, t, i18n.language), remove: () => listState.setFilters(rest) }];
    }),
  ];

  return (
    <div className="flex flex-col gap-3 border-b p-3 sm:p-4" data-testid="list-toolbar">
      <div className="flex flex-wrap items-center gap-2">
        {list.search ? (
          <SearchBox label={list.search.label} placeholder={list.search.placeholder} value={state.q} onCommit={(q) => listState.setQ(q, { typing: true })} />
        ) : null}

        <div className="flex w-full items-center gap-2 md:ml-auto md:w-auto">
          {list.filters && list.filters.length > 0 ? (
            <Button
              ref={filtersButton}
              type="button"
              variant={nFilters > 0 ? 'soft' : 'outline'}
              size="sm"
              aria-haspopup="dialog"
              data-testid="list-filters-button"
              onClick={(event) => open('filters', event.currentTarget)}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {nFilters > 0 ? t('listView.filters.buttonCount', { count: nFilters }) : t('listView.filters.button')}
            </Button>
          ) : null}

          {presets.length > 0 || savedViews.enabled ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button ref={viewsButton} type="button" variant="outline" size="sm" data-testid="list-views-button" className="pointer-coarse:min-w-11">
                  <Bookmark className="size-4" aria-hidden="true" />
                  <span className="max-md:sr-only">{t('listView.views.button')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuRadioGroup
                  value={viewNow}
                  onValueChange={(value) => {
                    const [kind, ...rest] = value.split(':');
                    const id = rest.join(':');
                    if (kind === 'preset') {
                      const preset = presets.find((view) => view.id === id);
                      if (preset) listState.applyPreset(preset.state);
                    } else {
                      const saved = savedViews.views.find((view) => view.id === id);
                      if (saved) listState.applyQuery(saved.query);
                    }
                  }}
                >
                  {presets.length > 0 ? <DropdownMenuLabel className={MENU_LABEL}>{t('listView.views.presets')}</DropdownMenuLabel> : null}
                  {presets.map((view) => (
                    <DropdownMenuRadioItem key={view.id} value={`preset:${view.id}`} className="pointer-coarse:min-h-11">
                      {view.label}
                    </DropdownMenuRadioItem>
                  ))}
                  {savedViews.views.length > 0 ? <DropdownMenuLabel className={MENU_LABEL}>{t('listView.views.mine')}</DropdownMenuLabel> : null}
                  {savedViews.views.map((view) => (
                    <DropdownMenuRadioItem key={view.id} value={`saved:${view.id}`} className="pointer-coarse:min-h-11">
                      {view.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                {savedViews.enabled ? (
                  <>
                    {presets.length > 0 || savedViews.views.length > 0 ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem className="gap-2 pointer-coarse:min-h-11" onSelect={() => open('save-view', viewsButton.current)}>
                      {t('listView.views.saveItem')}
                    </DropdownMenuItem>
                    {savedViews.views.length > 0 ? (
                      <DropdownMenuItem className="gap-2 pointer-coarse:min-h-11" onSelect={() => open('delete-views', viewsButton.current)}>
                        {t('listView.views.deleteItem')}
                      </DropdownMenuItem>
                    ) : null}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {canChooseColumns || sortable || exportLabel || hasBulk ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button ref={moreButton} type="button" variant="outline" size="icon" aria-label={t('listView.more.button')} data-testid="list-more-button" className="shrink-0">
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                {canChooseColumns ? (
                  <DropdownMenuItem className="gap-2 pointer-coarse:min-h-11" onSelect={() => open('columns', moreButton.current)}>
                    <Columns3 className="size-4" aria-hidden="true" />
                    {t('listView.more.columns')}
                  </DropdownMenuItem>
                ) : null}
                {sortable ? (
                  <DropdownMenuItem className="gap-2 pointer-coarse:min-h-11" onSelect={() => open('sort', moreButton.current)}>
                    <ArrowUpDown className="size-4" aria-hidden="true" />
                    {t('listView.more.sort')}
                  </DropdownMenuItem>
                ) : null}
                {exportLabel ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 pointer-coarse:min-h-11" onSelect={onExport} data-testid="list-export">
                      <Download className="size-4" aria-hidden="true" />
                      {exportLabel}
                    </DropdownMenuItem>
                  </>
                ) : null}
                {hasBulk ? (
                  <DropdownMenuItem className="gap-2 pointer-coarse:min-h-11 md:hidden" onSelect={onToggleSelectMode} data-testid="list-select-mode">
                    <ListChecks className="size-4" aria-hidden="true" />
                    {selectMode ? t('listView.select.done') : t('listView.select.start')}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {list.board ? (
            <Segmented
              label={t('listView.layout.label')}
              value={state.layout}
              onValueChange={listState.setLayout}
              className="relative ml-auto md:ml-0"
              testId="list-layout"
              options={[
                { value: 'list', label: <span className="max-md:sr-only">{t('listView.layout.list')}</span>, icon: LayoutList, testId: 'list-layout-list' },
                { value: 'board', label: <span className="max-md:sr-only">{t('listView.layout.board')}</span>, icon: Columns3, testId: 'list-layout-board' },
              ]}
            />
          ) : null}
        </div>
      </div>

      {chips.length > 0 ? (
        <div role="group" aria-label={t('listView.chips.label')} className="relative -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]" data-testid="list-chips">
          {chips.map((chip) => {
            const active = state.chip === chip.id;
            const count = chip.urgent ? (mode === 'server' ? (chipCounts?.[chip.id] ?? 0) : chipCount(chip, chipRows)) : 0;
            const Icon = chip.icon;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={active}
                title={chip.hint}
                data-testid={`list-chip-${chip.id}`}
                onClick={() => listState.setChip(chip.id)}
                className={cn(
                  'inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium transition-colors pointer-coarse:min-h-11',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-foreground/80 hover:bg-muted hover:text-foreground',
                )}
              >
                {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
                {chip.label}
                {count > 0 ? (
                  <>
                    <span aria-hidden="true" className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-soft px-1.5 text-xs font-semibold leading-none text-danger-foreground ring-1 ring-inset ring-danger-border">
                      {count > 99 ? '99+' : count}
                    </span>
                    <span className="sr-only">{t('listView.chips.needAttention', { count })}</span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {selectMode ? (
        <div role="status" className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm md:hidden" data-testid="list-select-hint">
          <span>{t('listView.select.hint')}</span>
          <Button type="button" variant="ghost" size="sm" onClick={onToggleSelectMode}>
            {t('listView.select.done')}
          </Button>
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 text-sm" aria-label={t('listView.tags.label')} role="group" data-testid="list-tags">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              aria-label={t('listView.tags.remove', { text: tag.text })}
              onClick={tag.remove}
              className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full bg-muted py-1 pl-3 pr-2 text-sm font-medium hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
            >
              <span className="min-w-0 break-words text-left">{tag.text}</span>
              <X className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
            </button>
          ))}
          <Button type="button" variant="link" size="sm" className="h-auto px-1" onClick={listState.clear} data-testid="list-clear">
            {t('listView.clear')}
          </Button>
        </div>
      ) : null}

      <ListFilterPanel
        list={list}
        rows={rows}
        state={state}
        mode={mode}
        open={panel === 'filters'}
        onOpenChange={(next) => !next && setPanel(null)}
        onApply={listState.setFilters}
        onCloseAutoFocus={onCloseAutoFocus}
      />
      <ListColumnsDialog list={list} state={state} open={panel === 'columns'} onOpenChange={(next) => !next && setPanel(null)} onApply={listState.setColumns} onCloseAutoFocus={onCloseAutoFocus} />
      <ListSortDialog list={list} state={state} open={panel === 'sort'} onOpenChange={(next) => !next && setPanel(null)} onApply={listState.setSort} onCloseAutoFocus={onCloseAutoFocus} />
      <ListSaveViewDialog
        open={panel === 'save-view'}
        onOpenChange={(next) => !next && setPanel(null)}
        query={viewQuery(list, state)}
        onSave={savedViews.save}
        onSaved={(name) => toast.success(t('listView.views.saved', { name }))}
        onCloseAutoFocus={onCloseAutoFocus}
      />
      <ListDeleteViewsDialog
        open={panel === 'delete-views'}
        onOpenChange={(next) => !next && setPanel(null)}
        views={savedViews.views}
        onDelete={(view, index) => {
          savedViews.remove(view.id);
          toastUndo(t('listView.views.deleted', { name: view.name }), { undo: () => savedViews.restore(view, index) });
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      />
    </div>
  );
}
