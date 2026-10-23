# The global detail drawer (UI-15)

One drawer for the whole app. A booking, a property, an intervention… is shown in it from **anywhere**: a button on the Home,
an event of the calendar, a row of a list. What is shown is **registered once per kind**; what is open is **in the address**
(`?detail=booking:3f2a9c1e`), so the drawer can be shared, Back closes it and a refresh brings it back.

It is built from three parts, each usable alone:

| Part | Where |
|---|---|
| the drawer: `registerDetail`, `useDetailDrawer`, `DetailDrawerHost` | this folder |
| `Timeline`, what happened in order | `components/shared/timeline/` |
| `RouteTabs`, tabs that are pages (and the tone of the number on a tab) | `components/ui/route-tabs.tsx`, `tab-count.tsx` |

`/dev/detail-drawer` (dev server only, `npm run dev:demo`) shows all of it on made-up data. No real kind is registered by this
task: each feature registers its own (booking, property, request…).

## Register a kind (once, at the top of the module of the feature)

```tsx
// features/bookings/booking-detail-drawer.tsx
import { registerDetail, type DetailContentProps, type DetailTitleProps } from '@/components/shared/detail-drawer/detail-registry';

function BookingTitle({ id }: DetailTitleProps) {
  const { data } = useBooking(id); // the same query as the content: TanStack Query shares it
  return <>{data?.guestName ?? ''}</>; // empty until it arrives: the drawer shows its generic name meanwhile
}

function BookingContent({ id, close }: DetailContentProps) {
  const { data, isLoading, isError, refetch } = useBooking(id); // the content loads its own data
  if (isLoading) return <SkeletonLine lines={4} />;
  // …state, "what to do now", summary, <Timeline events={…} />, actions…
}

registerDetail('booking', {
  title: BookingTitle, // or a key of the locale files: 'bookings.drawer.title'
  Content: BookingContent, // may be `lazy(() => import(…))`: the drawer has its own Suspense
  width: 'default', // or 'wide'
  pageHref: (id) => `/app/short-rent/bookings/${id}`, // "Apri la scheda completa" in the foot; leave it out if there is no page
});
```

Open it from anywhere inside the router:

```tsx
const drawer = useDetailDrawer(); // { open, close, current }
<Button onClick={(event) => drawer.open('booking', booking.id, { opener: event.currentTarget })}>Apri</Button>
```

From a `ListView`, the detail of a row can be the global drawer instead of a slot of the list (the slot still works, no list
changes): `defineList({ …, detail: { drawerKind: 'booking' } })`. The row is opened with its `rowKey` (or `drawerId: (row) => …`).

## Rules

- **One drawer open at a time.** Opening another while one is open swaps it (one Back closes whichever is there).
- **The kind is a lowercase word** (`booking`, `service-request`): letters, digits and `-`, up to 32. `registerDetail` throws on
  anything else, and `defineList` checks `drawerKind`.
- **The id is checked at the address.** `?detail=` is typed, pasted and shared, and the id ends up in the request the content
  makes: it is 1–128 characters of letters, digits, `_`, `-`, `.` and `:`, not starting with `.` or `-`. A kind that nobody
  registered, or an id that is not valid, opens nothing and breaks nothing. `open` says so by returning `false` (and a warning
  in the dev server), and so does a page with no `DetailDrawerHost` (a route outside the shell). A list whose row cannot be
  opened goes to its `rowHref`, or says "Non riesco ad aprire il dettaglio": a key that is not an id (an e-mail, a path) needs
  `drawerId`.
- **The content does not touch the address.** It gets `{ id, close }`: `close()` closes the drawer, and it is safe to call late
  (`await save(); close()` after the person has already closed the drawer does nothing) or twice. A link inside it that goes to
  another page needs nothing (the parameter does not follow it, and the drawer is gone).
- **A title that comes with the data may draw nothing yet:** the drawer never has an empty name (it adds the generic one, for
  assistive technology, until the title is there). A string title is a key of the locale files.
- **Register where the address can find it.** A kind exists only once its module has run, and the pages are lazy chunks: a
  page that wants `?detail=booking:…` from a shared link, or a Home that opens a booking, finds nothing unless the module of that
  kind was loaded. Register the kinds in **one file that the shell loads** (a `src/config/detail-kinds.ts` next to the manifest),
  each with a `lazy` `Content`: the registration is a few lines, the content is fetched when the drawer opens. (A kind that
  registers after the first render is picked up: the drawer opens when it does.)
- **A content that fails to draw** shows "Impossibile mostrare il dettaglio" with a retry, in the drawer; the page is not lost.
  A `lazy` content whose chunk did not load stays failed in place (React keeps it), so there "Riprova" loads the page again;
  the drawer is in the address, so it comes back.
- **Toasts.** The page behind a modal is inert (Radix, on `<body>`), the toasts included: a press on one falls through to what is
  under it, and a toast at the top right of a wide screen lies over the close button of the drawer. While this drawer is open
  `detail-drawer.css` gives the toasts back their pointer events, and a press on one does not dismiss the drawer, so "Annulla" of
  an action taken in the drawer (`toastUndo`) can be pressed. The other dialogs of the app are as they were.

## What it does

| | |
|---|---|
| **Shape** | One element, shaped by CSS only (so turning a phone does not mount the content again, and what was typed stays): a sheet from the bottom under `md` (48 rem; as tall as its content up to 92 % of the screen, with a handle that can be pulled down, 44 px close button), a panel at the right from `md` up (36 rem, `wide`: 42 rem). The window of a phone and the shell stop being a phone at the same width. |
| **Address** | `?detail=<kind>:<id>`; the colon is written as it is. Opening adds one entry to the history; closing goes Back when the entry was added by `open` (no second entry for the same page), and replaces it when the address came from outside (a shared link). That "added by `open`" mark is in `location.state`: a navigation that replaces the entry without it (a `Tabs` inside the drawer) loses it, and the next close then replaces instead of going Back, which leaves one entry more in the history at worst. The other parameters (filters, tab) are kept. A list that remembers its state for the way back (`useListReturn`) does not remember the drawer. |
| **Focus** | Trapped inside; on open it goes to the container of the content (not to the first control: a drawer that opens on "Accetta" must not have it focused, and the arrow keys scroll what has the focus), and again when another drawer takes the place of this one; on close it goes back to the button that opened it (`opener`, or the element that had the focus when `open` was called, or, for a drawer that an address opened (a link, Forward), the element that had it when the drawer came up; pass `event.currentTarget` for Safari, which does not focus a button that is clicked). |
| **Keyboard and pointer** | `Esc`, a press outside and the close button close it; a press on a toast does not. Two presses before the address has changed (Esc held down, a double tap) are one. |
| **Motion** | Slides in and out; none at all with `prefers-reduced-motion`. |
| **Accessibility** | `role="dialog"`, named by its title; the page behind is hidden from assistive technology while it is open. |

## The other two parts

**`Timeline`** (`components/shared/timeline/timeline.tsx`): what happened, in order. `events: { id, at, title, description?, actor?,
tone?, icon?, href? }[]` (`at` is an ISO instant, or missing when the time was not kept: the event has no `<time>`), `order` (`desc`, the
latest first, by default; `asc`; `given`, as they come, for a list that is in order already and has events without a time), `limit` (5 by default, also the
step of "Mostra altri"; `Infinity` shows all), `label`, `emptyText`. An ordered list; each event has a `<time>` with the date and
hour in Europe/Rome and, up to a week, how long ago ("2 ore fa", refreshed every minute). The tone (`success`, `warning`, `danger`,
`info`) is the color of the status badges, an icon and a word for a screen reader: never the color alone. `href` makes the title a
link, but only to a page of the app (`/…`): anything else is plain text. The texts come already translated, and no personal data
is put in them by the timeline: say "Pagamento ricevuto", not who or how much, where the person may not see it.

**`RouteTabs`** (`components/ui/route-tabs.tsx`): tabs that are *pages* (Prenotazioni · Ospiti · Pagamenti, each with its own
address), where `Tabs` is one page with `?tab=`. `items: { label, href, count?, countLabel?, tone?, current?, icon?, testId? }[]`.
A `nav` of links; the one the address is on (or under: `/bookings/7` is in `/bookings`, and the query counts when an `href` has
one) is `aria-current="page"`, unless an item says `current`. On a phone, a native `<select>` that goes to the page chosen.
`count` + `tone` (the colors of the status badges) put a number on a tab; the same `tone` now works on the counters of `Tabs`.

## Mounted once

`DetailDrawerHost` is in `AppShellLayout` (UI-03), with the other global layers. It is a dialog in a portal: it takes no room in
the layout, changes no skip link and no initial focus, and draws nothing (and needs nothing but the router) while it is closed.
A page outside the shell (the dev pages) mounts its own.

## Tests

`__tests__/detail-drawer.test.tsx` (the drawer in a router: address, Back, Esc, focus, one element across the breakpoint, a
content that fails, axe), `detail-registry.test.ts`, `lib/__tests__/detail-address.test.ts`; for the adapter,
`list-view/__tests__/list-view-drawer.test.tsx`; for the shell, `layout/__tests__/app-shell-layout.test.tsx`.
