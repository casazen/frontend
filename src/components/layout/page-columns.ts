// The width of a page in the shell. The content of the shell is a flex column, and in a flex column a block that has `mx-auto` and a
// `max-w-*` but no `w-full` takes the width of its content: a profile came out 390 px wide on a 1600 px screen. So a page does not
// center a narrow block, and it is not a narrow column either: it uses the whole width of the shell and spends it on columns
// (`PAGE_COLUMNS`, `FIELD_COLUMNS`); a guided flow puts its steps in a column of their own beside the step (`WizardShell`). A grid of
// these has a single column of `minmax(0, 1fr)` (`grid-cols-1`) until it has two: with no column set the track is `auto`, and a table
// or a long word in it would push the page out sideways.

/**
 * The sections of a page side by side from `xl`: two equal columns, each as tall as its own content. A page uses the whole width of
 * the shell (it is not a narrow column in the middle of it), and the width is spent on columns instead of on lines of text and
 * fields that run across the screen. Under `xl` the sections stack, as they always did. A section that must span both columns
 * (a notice, the one highlighted block of the page) takes `xl:col-span-2`.
 */
export const PAGE_COLUMNS = 'grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start';

export const PAGE_COLUMNS_WIDE = 'grid grid-cols-1 gap-6 2xl:grid-cols-2 2xl:items-start';

export const CONTAINER_COLUMNS = 'grid grid-cols-1 gap-6 @4xl:grid-cols-2 @4xl:items-start';

/** One column of {@link PAGE_COLUMNS} that holds several sections: they stack. `min-w-0` lets a wide child shrink instead of pushing the grid out. */
export const PAGE_COLUMN = 'min-w-0 space-y-6';

export const PAGE_MAIN_ASIDE = 'grid grid-cols-1 gap-8 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] 2xl:items-start';

/**
 * The fields of a form two to a row, or its groups of fields side by side, once the form is about 900 px wide (`@4xl`): a form that
 * fills the page without a field running across the whole screen. The width of the form decides, not the one of the screen, so the
 * same form works on a page of its own, in half of a page and in a card. Narrower, the fields stack with the spacing of a form, as
 * they always did. The parent of the grid has to be a container (`@container`); a field that must span both columns takes
 * `@4xl:col-span-2`.
 */
export const FIELD_COLUMNS = 'grid grid-cols-1 gap-x-8 gap-y-5 @4xl:grid-cols-2 @4xl:items-start';

/**
 * The block of a guided flow (a wizard) or of a short form: as wide as the page and starting at the left edge of the title above it
 * (never a narrow column with half of the screen empty beside it). The width is spent on columns: a wizard puts its steps beside the
 * step on a wide screen (`WizardShell`, from `2xl`), a form puts its sections in {@link PAGE_COLUMNS} or its fields in
 * {@link FIELD_COLUMNS}. `w-full` matters: in the column of the shell a block without it shrinks to the width of its content.
 */
export const FOCUS_COLUMN = 'w-full min-w-0';
