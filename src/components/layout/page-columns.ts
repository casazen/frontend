// The width of a page in the shell. The content of the shell is a flex column, and in a flex column a block that has `mx-auto` and a
// `max-w-*` but no `w-full` takes the width of its content: a profile came out 390 px wide on a 1600 px screen. So a page does not
// center a narrow block: it uses the width of the shell, and spends it on columns (`PAGE_COLUMNS`); a guided flow or a short form is
// a column that starts under the title (`FOCUS_COLUMN`). A grid of these has a single column of `minmax(0, 1fr)` (`grid-cols-1`)
// until it has two: with no column set the track is `auto`, and a table or a long word in it would push the page out sideways.

/**
 * The sections of a page side by side from `xl`: two equal columns, each as tall as its own content. A page uses the whole width of
 * the shell (it is not a narrow column in the middle of it), and the width is spent on columns instead of on lines of text and
 * fields that run across the screen. Under `xl` the sections stack, as they always did. A section that must span both columns
 * (a notice, the one highlighted block of the page) takes `xl:col-span-2`.
 */
export const PAGE_COLUMNS = 'grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start';

/**
 * {@link PAGE_COLUMNS} from `2xl` and not from `xl`, for sections that need about 600 px to be read: a table, a chart, a row of
 * fields with buttons. Between `xl` and `2xl` they stay under each other and use the whole width.
 */
export const PAGE_COLUMNS_WIDE = 'grid grid-cols-1 gap-6 2xl:grid-cols-2 2xl:items-start';

/**
 * {@link PAGE_COLUMNS} for a block that is not always as wide as the page (a form that also sits in the card of a wizard): the width
 * of its container decides, not the one of the screen. The parent of the grid has to be a container (`@container`).
 */
export const CONTAINER_COLUMNS = 'grid grid-cols-1 gap-6 @4xl:grid-cols-2 @4xl:items-start';

/** One column of {@link PAGE_COLUMNS} that holds several sections: they stack. `min-w-0` lets a wide child shrink instead of pushing the grid out. */
export const PAGE_COLUMN = 'min-w-0 space-y-6';

/**
 * The main part of a page and what goes with it (3 : 2), as the homes do (they keep their own copy of it, from `xl`): the main part is
 * the first child. From `2xl` and not from `xl`: what goes beside the main part here opens plans and forms, and needs about 480 px.
 */
export const PAGE_MAIN_ASIDE = 'grid grid-cols-1 gap-8 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] 2xl:items-start';

/**
 * The column of a guided flow (a wizard) or of a short form: it starts at the left edge of the title above it (never centered under a
 * title that is on the left) and is as wide as `max-w-4xl`, so that a field or a line of text does not run across the whole screen.
 * `w-full` matters: in the column of the shell a block with only `max-w-*` and `mx-auto` shrinks to the width of its content.
 */
export const FOCUS_COLUMN = 'w-full min-w-0 max-w-4xl';
