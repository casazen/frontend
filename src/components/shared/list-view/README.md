# ListView, the unified list (UI-14)

One component for every list of the product: a table where there is room and cards on a phone, a search, quick filters
("chips"), filters in a drawer, views the person can save, columns and order to choose, a CSV of what is on the screen, rows
that can be selected for actions on many, the swipe of a card, a detail drawer, and a board of columns by state. A screen is
**configuration**: you describe the entity once with `defineList` and hand it to `<ListView>`.

It is built on `DataView` (`components/ui/data-view.tsx`: the table, the cards, `aria-sort`, the selection, the placeholders)
and on the primitives of UI-07 and UI-11 (`Dialog` that is a sheet on a phone, `ConfirmationDialog`, `toastUndo`,
`StatusBadge`). Nothing else was added: no dependency, no CSS file.

| File | What it is |
|---|---|
| `list-types.ts` | the types: `ListDefinition`, `ListColumn`, `ListChip`, `ListFilter`, `ListBulkAction`, `ListBoard`, ... |
| `define-list.ts` | `defineList(definition)`: returns it, and fails early on a definition that does not hold (more than 5 default columns, repeated ids, a default chip that does not exist...) |
| `list-state.ts`, `use-list-state.ts` | the state in the address (`useListState`), pure parse and write functions |
| `list-data.ts` | search, quick filter, filters, sort of the rows (client mode) |
| `list-csv.ts` | the CSV (quotes, BOM, `;` for Italian, protection from formulas) |
| `saved-views.ts`, `use-saved-views.ts` | the views a person saves, in `localStorage` (versioned, limited, per person and area) |
| `list-view.tsx` | the component |
| `list-toolbar.tsx`, `list-panels.tsx`, `list-card.tsx`, `list-board.tsx`, `list-bulk-bar.tsx`, `list-pagination.tsx`, `list-row-actions.tsx` | its parts |
| `use-swipe.ts`, `use-board-drag.ts` | the gestures, in pointer events |

The page `/dev/list-view` (dev server only, `npm run dev:demo`) shows every part on made-up stays. The first real page that uses
it is the list of guests (`features/guests/guests-list.ts`, `guests-page.tsx`).

## An example: the list of guests (rows from a server)

```tsx
// features/guests/guests-list.ts
export function useGuestsList() {
  const { t } = useTranslation();

  // The definition is built where `t` is at hand and kept until the language changes: every text in it is already translated.
  return useMemo(
    () =>
      defineList<GuestSummary>({
        key: 'guests', // names the saved views and the file of the CSV
        title: t('guests.title'),
        rowKey: (guest) => guest.id,
        rowLabel: (guest) => `${guest.firstName} ${guest.lastName}`, // for a screen reader: its checkbox, its menu
        columns: [
          // At most five `default` columns (or `always`); the others are for the person to add. `priority` is for the card of a phone.
          { id: 'name', label: t('guests.anagrafica'), default: true, always: true, rowHeader: true, priority: 1, render: fullName },
          { id: 'email', label: t('guests.email'), default: true, priority: 2, render: (guest) => guest.email },
          { id: 'city', label: t('guests.city'), default: true, priority: 3, render: (guest) => guest.city || '—', csv: (guest) => guest.city },
          { id: 'phone', label: t('guests.phone'), render: (guest) => guest.phoneNumber || '—' }, // optional
        ],
        search: { label: t('guests.search'), placeholder: t('guests.search') },
        primaryAction: (guest) => ({ label: t('guests.viewDetails'), href: `/app/short-rent/guests/${guest.id}` }), // always in sight
        rowHref: (guest) => `/app/short-rent/guests/${guest.id}`, // the name is the link, and a click on the row goes there
        bulk: ['export'], // `'export'` is the built-in CSV of the selected rows
        empty: { icon: Users, title: t('guests.title'), description: t('guests.empty') },
      }),
    [t],
  );
}
```

```tsx
// features/guests/guests-page.tsx — the page asks the API with the state of the list, which is in the address
const list = useGuestsList();
const { state } = useListState(list); // `q`, `page`, the chip, the filters, the order: read from the address, nothing else
const { data, isLoading, isError, error, refetch, isPlaceholderData } = useQuery({
  queryKey: ['guests', { search: state.q.trim(), page: state.page }],
  queryFn: () => guestsApi.getAll({ search: state.q.trim() || undefined, page: state.page, pageSize: 20 }),
  placeholderData: keepPreviousData, // the last rows stay, a little dimmed, while the next ones come
});

<ListView
  list={list}
  mode="server" // the server searches, filters, sorts and pages: the list shows the rows it is given as they are
  rows={data?.items ?? []}
  totalCount={data?.totalCount}
  pageSize={20}
  isLoading={isLoading}
  isRefreshing={isPlaceholderData}
  isError={isError}
  error={error}
  onRetry={() => void refetch()}
  viewsScope={useListViewsScope()} // whose saved views these are (the person and the area); without it the list offers none
  testId="guest-list"
/>;
```

A list whose rows are all in memory is `mode="client"` (the default): the list does the search (accents and capitals do not
matter, every word must be there), the quick filter, the filters and the order itself, from the `test`, `sort` and `search.text`
of the definition.

## What a definition can say

| Part | What it does |
|---|---|
| `columns` | `id`, `label`, `render(row, cell)`, `sort`, `default`, `always`, `priority`, `cardStatus`, `align`, `rowHeader`, `csv`. A column that wants only the name to be the link writes `render: (row, cell) => cell.open(<b>{row.name}</b>)`; a `rowHeader` that does not is wholly the link (a keyboard can always open a row). The state of a row is a `StatusBadge` (icon, word and color: never the color alone), and a column made of components wants a `csv` |
| `chips` | the quick filters; one is always on. `urgent: true` puts a number on it (what needs attention only). `defaultChip` starts the list from another than the first |
| `filters` | `select`, `multi` and `date` (a range); their `options` are a list or drawn from the rows. The panel says how many results the choice gives (client mode) |
| `views` | views that come with the list; the person's own are kept in the browser |
| `primaryAction`, `menu` | the one thing to do about a row, always in sight; the rest in "⋯" |
| `bulk` | actions on the selected rows. `confirm` asks first (destructive), `undo` offers "Annulla" with a toast after it. `'export'` is the built-in CSV |
| `card`, `swipe` | the card of a phone when the priorities of the columns are not enough; what a swipe to the right and to the left does (the same actions are put in the menu of the row: **a gesture is never the only way**) |
| `detail` | the drawer that opens on a row (a sheet from the bottom on a phone): a slot, `render(row)` |
| `board` | the columns by state: `columns` (which rows are in each), `onMove(row, to, from)` that answers `{ ok: false, title, reason }` to say why a move is not allowed |
| `rowTone` | `urgent` (a bar at the start of the row) or `done` (quieter) |
| `csv`, `cardsUntil`, `countLabel`, `empty`, `noResults` | the file name and separator (or `false`), the width under which the table is cards, the words for "12 guests", the empty states |

## The state is in the address

| Part | Parameter | Example |
|---|---|---|
| search | `q` | `?q=rossi` |
| quick filter | `chip` (not written when it is the default one) | `?chip=pending` |
| filters | `f_<id>`: a value, `a,b` for a multiple one, `from..to` for a range | `?f_channel=airbnb,direct&f_arrival=2026-10-01..2026-10-31` |
| order | `sort=<column>:<asc\|desc>` | `?sort=total:desc` |
| columns | `cols=<ids>` | `?cols=guest,email` |
| layout | `view=board` | |
| page | `page` (from 2) | `?page=2` |

What is not asked for is the default and is not written, so the plain address is the plain list; what is not valid is ignored;
the parameters that are not the list's (`propertyId`, `tab`) are left alone. Each change adds a step to the history (Back gives
the view before), except a search being typed, which makes one step for the whole word. `useListReturn` remembers the list, so
the way back from a page of detail leads to the list as it was left.

## Rules the list keeps for you

- **Five columns at most by default** (`defineList` throws on six): what is secondary goes under the first column or in the
  detail. Columns the data does not have are not defined, and not made up (see the comment in `guests-list.ts`).
- **Every state is reachable and says what to do:** loading (the placeholders of UI-02), failed (with "Riprova"), empty (explains
  and offers the action), nothing found ("Azzera i filtri").
- **Touch:** every control is 44 px on a touch screen; the table is cards under `cardsUntil`; the filters are a sheet from the
  bottom; nothing sticks out at 360 or 390 px, even with wider letters.
- **Accessibility:** a table with a caption and `aria-sort`, a `rowheader`, the checkboxes named after the row, the number of
  results and the actions announced (`role="status"`), the focus given back to the button that opened a panel, the menu of a row
  for what a swipe does, the keyboard for "Sposta in…". Tested with axe in jsdom and in a browser.
- **CSV:** made in the browser from the rows and columns on the screen; every cell is quoted; a cell that starts with `= + - @`,
  a tab or a CR is written with a `'` in front (a guest's name cannot run a formula in Excel); BOM for UTF-8; `;` and the
  decimal comma in Italian. A column made of components wants a `csv`.
- **Saved views:** only in the browser (`localStorage`, key with the version, the person and the area, at most 12 per list, 40
  characters a name); a stored value that is not valid is ignored; nothing is sent anywhere.

## Not here (yet)

Two lists on one page (the parameters of the address are not namespaced: one list for each address, as for each route), adoption
in the other lists (the areas decide it list by list), views saved on the server, a calendar, the global search, a dark theme,
and a drag of a card with a finger (a phone moves a card with its menu).
