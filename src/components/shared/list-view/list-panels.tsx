import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { filterListRows, resolveOptions, visibleColumns } from './list-data';
import { formatDateRange, parseDateRange, parseMultiValue, type ListState } from './list-state';
import type { ListDefinition, ListFilter, ListMode, ListSort } from './list-types';
import { SAVED_VIEWS_LIMIT, SAVED_VIEW_NAME_MAX, type SavedView } from './saved-views';
import type { UseSavedViews } from './use-saved-views';

interface ListPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
  testId?: string;
  /** A drawer wide enough for a page of detail; the panels of the filters are narrower. */
  wide?: boolean;
}

/**
 * A panel at the side of the list: a drawer from the right on a screen with room, a sheet from the bottom on a phone (the
 * responsive `Dialog`). The filters, the detail of a row and the other choices of the list all open in it.
 */
export function ListPanel({ open, onOpenChange, title, description, children, footer, onCloseAutoFocus, testId, wide = false }: ListPanelProps) {
  const isPhone = useMediaQuery(PHONE_QUERY);

  if (isPhone) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid={testId} onCloseAutoFocus={onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="min-w-0">{children}</div>
          {footer ? <DialogFooter className="gap-2 sm:space-x-0">{footer}</DialogFooter> : null}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" data-testid={testId} onCloseAutoFocus={onCloseAutoFocus} className={cn('w-full', wide ? 'max-w-xl' : 'max-w-md')}>
        <SheetHeader className="pr-12">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t p-4">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------------------------------------------------- Filters */

interface FilterFieldProps<Row> {
  filter: ListFilter<Row>;
  rows: readonly Row[];
  value: string;
  onChange: (value: string) => void;
}

const CHOICE =
  'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring';

function FilterField<Row>({ filter, rows, value, onChange }: FilterFieldProps<Row>) {
  const { t } = useTranslation();
  const baseId = useId();

  if (filter.type === 'select') {
    const options = resolveOptions(filter.options, rows);
    return (
      <Field label={filter.label} id={`${baseId}-${filter.id}`}>
        <Select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">{filter.allLabel ?? t('listView.filters.all')}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  if (filter.type === 'multi') {
    const picked = parseMultiValue(value);
    const toggle = (optionValue: string) => {
      const next = picked.includes(optionValue) ? picked.filter((id) => id !== optionValue) : [...picked, optionValue];
      onChange(next.join(','));
    };
    return (
      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-medium">{filter.label}</legend>
        <div className="flex flex-wrap gap-2">
          {resolveOptions(filter.options, rows).map((option) => {
            const Icon = option.icon;
            return (
              <label key={option.value} className={CHOICE}>
                <input type="checkbox" className="size-4 accent-primary" checked={picked.includes(option.value)} onChange={() => toggle(option.value)} />
                {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  const range = parseDateRange(value);
  const misordered = Boolean(range.from && range.to && range.from > range.to);
  const set = (part: 'from' | 'to', next: string) => {
    const updated = { ...range, [part]: next || undefined };
    onChange(updated.from || updated.to ? formatDateRange(updated) : '');
  };
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">{filter.label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0 space-y-1">
          <Label htmlFor={`${baseId}-from`} className="text-foreground/70">
            {t('listView.filters.from')}
          </Label>
          <Input id={`${baseId}-from`} type="date" value={range.from ?? ''} aria-invalid={misordered || undefined} onChange={(event) => set('from', event.target.value)} />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor={`${baseId}-to`} className="text-foreground/70">
            {t('listView.filters.to')}
          </Label>
          <Input id={`${baseId}-to`} type="date" value={range.to ?? ''} aria-invalid={misordered || undefined} onChange={(event) => set('to', event.target.value)} />
        </div>
      </div>
      {misordered ? (
        <p role="alert" className="text-sm text-[color:var(--color-danger-foreground,#b4232a)]">
          {t('listView.filters.dateOrder')}
        </p>
      ) : null}
    </fieldset>
  );
}

interface ListFilterPanelProps<Row> {
  list: ListDefinition<Row>;
  rows: readonly Row[];
  state: ListState;
  mode: ListMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The filters, as the person set them. */
  onApply: (filters: Record<string, string>) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

function FilterForm<Row>({ list, rows, state, mode, onApply, onClose }: Pick<ListFilterPanelProps<Row>, 'list' | 'rows' | 'state' | 'mode' | 'onApply'> & { onClose: () => void }) {
  const { t } = useTranslation();
  // The draft starts from the filters now in force; it is the person's until they press the button.
  const [draft, setDraft] = useState<Record<string, string>>({ ...state.filters });

  const clean = Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== ''));
  const invalid = (list.filters ?? []).some((filter) => {
    if (filter.type !== 'date') return false;
    const { from, to } = parseDateRange(clean[filter.id] ?? '');
    return Boolean(from && to && from > to);
  });
  // The number of results is only known where the list does the filtering itself.
  const count = mode === 'client' ? filterListRows(list, rows, state, { filters: clean }).length : null;

  const apply = (filters: Record<string, string>) => {
    onApply(filters);
    onClose();
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (!invalid) apply(clean);
      }}
    >
      {(list.filters ?? []).map((filter) => (
        <FilterField key={filter.id} filter={filter} rows={rows} value={draft[filter.id] ?? ''} onChange={(value) => setDraft((current) => ({ ...current, [filter.id]: value }))} />
      ))}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={() => apply({})}>
          {t('listView.filters.clear')}
        </Button>
        <Button type="submit" disabled={invalid} data-testid="list-filters-apply">
          {count === null ? t('listView.filters.show') : t('listView.filters.showCount', { count })}
        </Button>
      </div>
    </form>
  );
}

/** The filters of the list, in a drawer (a sheet on a phone), with the number of results the choice would give. */
export function ListFilterPanel<Row>({ list, rows, state, mode, open, onOpenChange, onApply, onCloseAutoFocus }: ListFilterPanelProps<Row>) {
  const { t } = useTranslation();
  return (
    <ListPanel
      open={open}
      onOpenChange={onOpenChange}
      title={t('listView.filters.title')}
      description={t('listView.filters.description')}
      onCloseAutoFocus={onCloseAutoFocus}
      testId="list-filters-panel"
    >
      {open ? <FilterForm list={list} rows={rows} state={state} mode={mode} onApply={onApply} onClose={() => onOpenChange(false)} /> : null}
    </ListPanel>
  );
}

/* -------------------------------------------------------------------------------------------------------------- Columns */

interface ColumnsDialogProps<Row> {
  list: ListDefinition<Row>;
  state: ListState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (columns: readonly string[] | null) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

function ColumnsForm<Row>({ list, state, onApply, onClose }: Pick<ColumnsDialogProps<Row>, 'list' | 'state' | 'onApply'> & { onClose: () => void }) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string[]>(() => visibleColumns(list, state.columns).map((column) => column.id));
  const toggle = (id: string) => setPicked((current) => (current.includes(id) ? current.filter((other) => other !== id) : [...current, id]));

  return (
    <form
      className="space-y-4"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onApply(picked);
        onClose();
      }}
    >
      <fieldset className="space-y-1">
        <legend className="sr-only">{t('listView.columns.title')}</legend>
        {list.columns.map((column) => (
          <label key={column.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-muted">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={column.always || picked.includes(column.id)}
              disabled={column.always}
              onChange={() => toggle(column.id)}
            />
            <span className="min-w-0 flex-1 break-words">{column.label}</span>
            {column.always ? <span className="text-xs text-foreground/70">{t('listView.columns.always')}</span> : null}
          </label>
        ))}
      </fieldset>
      <DialogFooter className="gap-2 sm:space-x-0">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onApply(null);
            onClose();
          }}
        >
          {t('listView.columns.reset')}
        </Button>
        <Button type="submit">{t('listView.columns.apply')}</Button>
      </DialogFooter>
    </form>
  );
}

/** Which columns the table shows, to choose from the ones the list has. */
export function ListColumnsDialog<Row>({ list, state, open, onOpenChange, onApply, onCloseAutoFocus }: ColumnsDialogProps<Row>) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" onCloseAutoFocus={onCloseAutoFocus} data-testid="list-columns-dialog">
        <DialogHeader>
          <DialogTitle>{t('listView.columns.title')}</DialogTitle>
          <DialogDescription>{t('listView.columns.description')}</DialogDescription>
        </DialogHeader>
        <ColumnsForm list={list} state={state} onApply={onApply} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------------------------------------------------------------------- Sort */

const DIRECTIONS = ['asc', 'desc'] as const;

interface SortDialogProps<Row> {
  list: ListDefinition<Row>;
  state: ListState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (sort: ListSort) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

function SortForm<Row>({ list, state, onApply, onClose }: Pick<SortDialogProps<Row>, 'list' | 'state' | 'onApply'> & { onClose: () => void }) {
  const { t } = useTranslation();
  const sortable = list.columns.filter((column) => column.sort);
  const [id, setId] = useState(state.sort?.id ?? sortable[0]?.id ?? '');
  const [direction, setDirection] = useState<ListSort['direction']>(state.sort?.direction ?? 'asc');

  return (
    <form
      className="space-y-4"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (id) onApply({ id, direction });
        onClose();
      }}
    >
      <fieldset className="space-y-1">
        <legend className="mb-1 text-sm font-medium">{t('listView.sort.by')}</legend>
        {sortable.map((column) => (
          <label key={column.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-muted">
            <input type="radio" name="list-sort-column" className="size-4 accent-primary" checked={id === column.id} onChange={() => setId(column.id)} />
            <span className="min-w-0 break-words">{column.label}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-1">
        <legend className="mb-1 text-sm font-medium">{t('listView.sort.direction')}</legend>
        {DIRECTIONS.map((value) => (
          <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-muted">
            <input type="radio" name="list-sort-direction" className="size-4 accent-primary" checked={direction === value} onChange={() => setDirection(value)} />
            <span className="min-w-0 break-words">{t(value === 'asc' ? 'listView.sort.ascending' : 'listView.sort.descending')}</span>
          </label>
        ))}
      </fieldset>
      <DialogFooter>
        <Button type="submit">{t('listView.sort.apply')}</Button>
      </DialogFooter>
    </form>
  );
}

/** The order of the list, to choose where there are no column headers to press (a phone). */
export function ListSortDialog<Row>({ list, state, open, onOpenChange, onApply, onCloseAutoFocus }: SortDialogProps<Row>) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" onCloseAutoFocus={onCloseAutoFocus} data-testid="list-sort-dialog">
        <DialogHeader>
          <DialogTitle>{t('listView.sort.title')}</DialogTitle>
          <DialogDescription>{t('listView.sort.description')}</DialogDescription>
        </DialogHeader>
        <SortForm list={list} state={state} onApply={onApply} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------------------------------------- Saved views */

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The view the list is in now, as a query string: what is kept under the name. */
  query: string;
  onSave: UseSavedViews['save'];
  /** Called after the view was kept, with its name. */
  onSaved: (name: string) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

const SAVE_ERROR_KEY = {
  empty: 'listView.views.errorEmpty',
  limit: 'listView.views.errorLimit',
  'too-long': 'listView.views.errorTooLong',
  storage: 'listView.views.errorStorage',
} as const;

function SaveViewForm({ query, onSave, onSaved, onClose }: Pick<SaveViewDialogProps, 'query' | 'onSave' | 'onSaved'> & { onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [reason, setReason] = useState<keyof typeof SAVE_ERROR_KEY | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        const result = onSave(name, query);
        if (result.ok) {
          onSaved(name.trim());
          onClose();
        } else {
          setReason(result.reason);
        }
      }}
    >
      <Field
        label={t('listView.views.nameLabel')}
        hint={t('listView.views.nameHint')}
        error={reason ? t(SAVE_ERROR_KEY[reason], { max: SAVED_VIEWS_LIMIT }) : undefined}
      >
        <Input
          value={name}
          maxLength={SAVED_VIEW_NAME_MAX}
          autoComplete="off"
          onChange={(event) => {
            setName(event.target.value);
            setReason(null);
          }}
        />
      </Field>
      <DialogFooter>
        <Button type="submit">{t('listView.views.save')}</Button>
      </DialogFooter>
    </form>
  );
}

/** Asks for a name and keeps the view the list is in now. */
export function ListSaveViewDialog({ open, onOpenChange, query, onSave, onSaved, onCloseAutoFocus }: SaveViewDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" onCloseAutoFocus={onCloseAutoFocus} data-testid="list-save-view-dialog">
        <DialogHeader>
          <DialogTitle>{t('listView.views.saveTitle')}</DialogTitle>
          <DialogDescription>{t('listView.views.saveDescription')}</DialogDescription>
        </DialogHeader>
        <SaveViewForm query={query} onSave={onSave} onSaved={onSaved} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

interface DeleteViewsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  views: readonly SavedView[];
  onDelete: (view: SavedView, index: number) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

/** The views the person saved, each one with the button that removes it. */
export function ListDeleteViewsDialog({ open, onOpenChange, views, onDelete, onCloseAutoFocus }: DeleteViewsDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" onCloseAutoFocus={onCloseAutoFocus} data-testid="list-delete-views-dialog">
        <DialogHeader>
          <DialogTitle>{t('listView.views.deleteTitle')}</DialogTitle>
          <DialogDescription>{t('listView.views.deleteDescription')}</DialogDescription>
        </DialogHeader>
        {views.length === 0 ? (
          <p className="text-sm text-foreground/70">{t('listView.views.none')}</p>
        ) : (
          <ul role="list" className="divide-y">
            {views.map((view, index) => (
              <li key={view.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 break-words text-sm">{view.name}</span>
                <Button type="button" variant="danger-outline" size="sm" aria-label={t('listView.views.deleteOne', { name: view.name })} onClick={() => onDelete(view, index)}>
                  {t('listView.views.delete')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
