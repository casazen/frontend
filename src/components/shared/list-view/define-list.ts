import { LIST_MAX_DEFAULT_COLUMNS, type ListDefinition } from './list-types';

/** Ids go in the address and in lists separated by a comma or a colon: they stay plain. */
const PLAIN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

function fail(key: string, problem: string): never {
  throw new Error(`ListView "${key}": ${problem}`);
}

function checkUnique(key: string, what: string, ids: readonly string[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!PLAIN_ID.test(id)) fail(key, `the ${what} id "${id}" must be made of letters, digits, "-" and "_" only`);
    if (seen.has(id)) fail(key, `the ${what} id "${id}" is used twice`);
    seen.add(id);
  }
}

/**
 * Describes a list (UI-14) and checks that the description holds together, so that a mistake fails where the list is
 * written and not as a blank page: no more than five columns by default (the rest are for the person to add), ids that
 * can travel in an address, a default chip, a default sort and a board that exist.
 *
 * It returns the definition untouched. Build it where `t` is at hand and keep it as long as the language does not change:
 *
 *     const list = useMemo(() => defineList<Guest>({ key: 'guests', title: t('guests.title'), … }), [t]);
 */
export function defineList<Row>(definition: ListDefinition<Row>): ListDefinition<Row> {
  const { key, columns, chips = [], filters = [], views = [], board, bulk = [] } = definition;
  if (!key || /[\s:]/.test(key)) fail(key || '(no key)', 'the key is required and has no spaces or colons');
  if (columns.length === 0) fail(key, 'a list needs at least one column');

  checkUnique(key, 'column', columns.map((column) => column.id));
  const shownByDefault = columns.filter((column) => column.default || column.always);
  if (shownByDefault.length === 0) fail(key, 'at least one column must be `default`');
  if (shownByDefault.length > LIST_MAX_DEFAULT_COLUMNS) {
    fail(
      key,
      `${shownByDefault.length} columns are shown by default (${shownByDefault.map((column) => column.id).join(', ')}): ` +
        `at most ${LIST_MAX_DEFAULT_COLUMNS}; the others must not be \`default\`, the person adds them.`,
    );
  }
  if (columns.filter((column) => column.rowHeader).length > 1) fail(key, 'only one column can be the `rowHeader`');
  if (definition.detail || definition.rowHref) {
    const name = columns.find((column) => column.rowHeader);
    if (!name?.always) {
      fail(key, 'a list that opens its rows needs a `rowHeader` column that is `always` there: it holds what the keyboard and a screen reader press to open a row');
    }
  }
  if (columns.filter((column) => column.cardStatus).length > 1) fail(key, 'only one column can be the `cardStatus`');

  checkUnique(key, 'chip', chips.map((chip) => chip.id));
  if (definition.defaultChip !== undefined && !chips.some((chip) => chip.id === definition.defaultChip)) {
    fail(key, `the default chip "${definition.defaultChip}" is not one of the chips`);
  }

  checkUnique(key, 'filter', filters.map((filter) => filter.id));
  checkUnique(key, 'view', views.map((view) => view.id));
  checkUnique(key, 'bulk action', bulk.map((entry) => (entry === 'export' ? 'export' : entry.id)));

  if (definition.defaultSort !== undefined) {
    const [id] = definition.defaultSort.split(':');
    if (!columns.some((column) => column.id === id && column.sort)) {
      fail(key, `the default sort "${definition.defaultSort}" must name a column that has \`sort\``);
    }
  }

  if (board) {
    if (board.columns.length === 0) fail(key, 'a board needs at least one column');
    checkUnique(key, 'board column', board.columns.map((column) => column.id));
    if (board.defaultChip !== undefined && !chips.some((chip) => chip.id === board.defaultChip)) {
      fail(key, `the board's default chip "${board.defaultChip}" is not one of the chips`);
    }
  }

  return definition;
}
