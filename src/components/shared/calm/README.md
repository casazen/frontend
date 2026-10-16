# Calm blocks (UI-16)

The blocks of the home screens and the summary screens of the four areas (Affitti brevi, Affitti lunghi, Portale fornitori,
Amministrazione), built once. They are what the redesign conventions ask for (`redesign/docs/CONVENZIONI.md` §7bis of the workspace): **one focal point per screen**, at most three
sections, three or four numbers without charts, no card inside a card, short lists. A page that follows the rules is made of
these blocks and little else.

They only present. No call to the network, no knowledge of bookings or contracts: the caller hands in texts that are already
translated, dates and money that are already formatted, and what to do when a button is pressed. The only words that live
here are a few `aria-label`s that every area would otherwise repeat (the `calm` namespace of `it.json` and `en.json`).

```tsx
import { FocusBlock, StatStrip, StatTile, PlainSection, DayList } from '@/components/shared/calm';
```

Import from the folder, never from the files. The page `/dev/calm-blocks` (dev server only, `npm run dev:demo`) shows every
block in every variant, and a composed home at the bottom.

| Block | Use it for | Not for |
|---|---|---|
| `FocusBlock` | The one thing to do now, with its button. The only colored block of a page | A list of things, a second highlight, a notice that needs no action (that is `Alert`) |
| `StatStrip` / `StatTile` | Three or four numbers in a row, each with its name and, if useful, how it moves | Charts, more than four numbers (that is a report), a table |
| `PlainSection` | A part of a page: title, one action for the whole part, content | A box around content: it has no border, background or shadow on purpose |
| `DayList` | Rows with a date, a title, a line under it and a direct action: the deadlines, the to-do list | A table of many columns or a list to sort and filter (that is `ListView`) |
| `TodayList` | A `DayList` in three groups, today, tomorrow, later | |
| `WeekStrip` | The seven days of a week, to see which have something and to choose one | A calendar with weeks and months |
| `ActivityList` | What happened, in order, with who did it: recent activity, the history of a contract | A chat, a log to search |
| `NextStepCard` | The one next step of a path ("Passo 3 di 7"), with its button | A checklist (that is `ChecklistCompact`, or the full list) |
| `ChecklistCompact` | The setup checklist of a home in one line, while it is incomplete | The full list of steps |

## The rules the blocks keep for you, and the ones they cannot

- **One `FocusBlock` per page.** Two colored blocks together and the person does not know where to look. The page is made of
  at most three sections after it (`PlainSection`s), then the numbers, then at most one of `NextStepCard` and `ChecklistCompact`:
  never both (the guide arrives one thing at a time). The blocks cannot count themselves across a page, so this is the page's
  to keep. `StatStrip` does warn in the console, in development, when it gets more than four tiles.
- **Tone is never only color.** `tone` (`neutral`, `info`, `success`, `warning`, `danger`) changes the tint, and every tone has
  its own icon; the words of the block say the rest. `neutral` is the accent of the area. A tone is for what the news is, not
  for decoration: most blocks are `neutral`.
- **Every action is at least 44 px high**, on a phone and on a laptop, and a long label wraps instead of pushing the page.
- **Secondary text is `foreground/70`**, not `muted-foreground` (4.4:1 on white: a hair under AA). The tokens of the tones
  (`-foreground` on `-soft`) are 6:1 and more in every area (`styles/__tests__/tokens.test.ts`).
- **Headings.** `FocusBlock`, `PlainSection` and `ChecklistCompact` are `region`s named by their `h2`. `TodayList` names its
  groups with `h3`, so use it inside a `PlainSection`. `NextStepCard` takes `titleAs`.
- **Text.** Nothing is written inside the blocks: each one shows exactly the words it is given (its test checks it). So `then`
  is the whole line ("Poi: la firma del conduttore"), `who` the whole phrase ("Tocca a te").

## `CalmAction`: how a block asks for a button

Every block that has a button takes the same description:

```ts
{ label: 'Registra', onClick: () => register() }                       // runs something: a <button>
{ label: 'Apri il contratto', href: '/app/long-rent/contracts/42' }    // goes somewhere: a link of the router
{ label: 'Aiuto', href: 'https://…' }                                  // an address with a scheme: a plain link
// also: state (handed to the page that opens), ariaLabel (must start with the label), testId
```

Give `ariaLabel` when several buttons say the same thing on the page (`Apri` in each row: `Apri: contratto Rossi`).

## Composing a home

```tsx
<div className="space-y-8">
  <FocusBlock
    tone="warning"
    kicker={t('home.now')}
    title={t('home.lateRent.title', { name })}
    body={t('home.lateRent.body')}
    who={t('home.lateRent.who')}          // "Tocca a te"
    when={t('home.lateRent.late', { count: days })}
    then={t('home.lateRent.then')}        // "Poi: se non paga entro il 25, puoi avviare la diffida"
    primary={{ label: t('home.lateRent.remind'), onClick: sendReminder }}
    secondary={{ label: t('home.lateRent.open'), href: contractPath }}
  />

  <PlainSection title={t('home.todo')} count={todos.length} actionLabel={t('home.seeAll')} href="/app/long-rent/todo">
    <DayList items={todos.slice(0, 3).map(toRow)} />
  </PlainSection>

  <StatStrip label={t('home.rentsOfTheMonth')}>
    <StatTile label={t('home.collected')} value={money(collected)} delta={t('home.vsLastMonth', { value: '+6%' })} />
    <StatTile label={t('home.late')} value={money(late)} tone="danger" href="/app/long-rent/rents?filter=late" />
    <StatTile label={t('home.toCollect')} value={money(toCollect)} />
  </StatStrip>

  <ChecklistCompact title={t('setup.title')} done={2} total={5} progress={t('setup.of', { done: 2, total: 5 })} next={t('setup.next', { step })} primary={{ label: t('setup.continue'), href: nextStepPath }} />
</div>
```

When there is nothing to do, the `FocusBlock` still says so ("Niente di urgente") with a way to go on: it is the same block,
`tone="success"`, and its button leads to the list of things.

## The blocks

**`FocusBlock`**: `tone?`, `kicker?`, `title`, `body?`, `who?` (whose turn), `when?` (how long or until when), `primary`,
`secondary?`, `then?`, `icon?` (replaces the icon of the tone). Extra props go to the `section`.

**`StatStrip`**: `label?` (default "In breve"), the tiles as children. **`StatTile`**: `label`, `value`, `tone?`, `delta?` (the
text is yours: "+6% su settembre"), `href?` (the whole tile is the link; a chevron says so), `state?`. One column on a phone,
two from `sm`, three or four from `lg`.

**`PlainSection`**: `title`, `count?`, and either `actionLabel` + `href` or `actionLabel` + `onAction`. Extra props (`id`,
`data-testid`) go to the `section`.

**`DayList`**: `items` of `{ id, date, dateTime?, title, subtitle?, meta?, tone?, href | onOpen, action? }`. The title is the
link (or the button) of the row and its hit area is the whole row; `action` is a separate button for what is done without
opening the item; `meta` is a note at the end ("tra 5 giorni"), and with a `tone` it gets the icon and the color of the tone.
It renders nothing when it has no rows: what to say then is the page's. **`TodayList`**: `items` (each with its `day`,
`YYYY-MM-DD`), `labels` (`today`, `tomorrow`, `later`, in your words), `today?` (default: today in Europe/Rome). A day that is
already past stays in today's group: it is still to be done.

**`WeekStrip`**: `days` of `{ date, count? }`, `value?` / `defaultValue?` / `onValueChange?`, `today?`, `label?`. A group of
radio buttons: one in the Tab order, arrows (and Home, End) move the choice, from the last it goes round. A dot marks a day
that has things; each day is read in full ("lunedì 12 ottobre, oggi, 3 elementi"). It only chooses: what it shows, and other
weeks, are the page's.

**`ActivityList`**: `items` of `{ id, at (ISO instant), when?, text, actor? }`, `order?` (`newest` default, or `oldest`),
`more?` (`{ limit, label }`: only `limit` entries and a button to show the rest; the focus goes to the first new entry).
It puts the entries in order itself. Without `when`, the date is day, month and time in Europe/Rome, in the language of the
app.

**`NextStepCard`**: `kicker`, `title`, `titleAs?` (`h2` default, `p` inside a block that has its own heading), `detail?`,
`position?` ("Passo 3 di 7"), `cta?`. It is the "next step" of the activation checklist taken out (`features/onboarding`), with
the same words and the same `data-testid`s (`activation-next-step`, `activation-next-step-cta`), now shared.

**`ChecklistCompact`**: `title`, `done`, `total`, `progress` ("2 di 5"), `next?`, `progressLabel?`, `primary?`, `secondary?`.

## Tests

Each block has its test next to it (`__tests__/`): the variants, the tone, that no word of its own is added, the keyboard of
`WeekStrip`, one `h2` per block, and `vitest-axe` (`@/test/axe`). The colors and the widths are checked in a real browser by
`e2e/calm-blocks.spec.ts` on `/dev/calm-blocks`: axe with contrast at four widths, in every area, nothing sticking out at
360 and 390 px with wider letters, and targets of 44 px.
