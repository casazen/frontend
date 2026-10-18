import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SAVED_VIEWS_EVENT,
  SAVED_VIEWS_LIMIT,
  SAVED_VIEWS_VERSION,
  SAVED_VIEW_NAME_MAX,
  newSavedViewId,
  parseSavedViews,
  readSavedViewsRaw,
  savedViewsKey,
  withSavedView,
  withoutSavedView,
  writeSavedViews,
  type SavedView,
} from '../saved-views';

const scope = { userId: 'auth0|abc', context: 'short-rent' };
const stored = (views: unknown, version: unknown = SAVED_VIEWS_VERSION) => JSON.stringify({ version, views });

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('savedViewsKey', () => {
  it('is different for each person, each area and each list, and holds the version', () => {
    const base = savedViewsKey('guests', scope);

    expect(base).toContain(`v${SAVED_VIEWS_VERSION}`);
    expect(base).not.toBe(savedViewsKey('guests', { ...scope, userId: 'auth0|other' }));
    expect(base).not.toBe(savedViewsKey('guests', { ...scope, context: 'long-rent' }));
    expect(base).not.toBe(savedViewsKey('bookings', scope));
  });

  it('keeps a colon or a bar in an id from changing which entry it is', () => {
    expect(savedViewsKey('guests', { userId: 'a:b', context: 'c' })).not.toBe(savedViewsKey('guests', { userId: 'a', context: 'b:c' }));
  });
});

describe('parseSavedViews', () => {
  it('reads valid views', () => {
    const views = [{ id: '1', name: 'Arrivals', query: 'chip=all' }];

    expect(parseSavedViews(stored(views))).toEqual(views);
  });

  it('reads nothing from nothing, from text that is not JSON, or from another shape', () => {
    expect(parseSavedViews(null)).toEqual([]);
    expect(parseSavedViews('')).toEqual([]);
    expect(parseSavedViews('{not json')).toEqual([]);
    expect(parseSavedViews('[]')).toEqual([]);
    expect(parseSavedViews('"views"')).toEqual([]);
    expect(parseSavedViews(JSON.stringify({ version: 1 }))).toEqual([]);
  });

  it('does not read an entry of another version', () => {
    expect(parseSavedViews(stored([{ id: '1', name: 'Arrivals', query: '' }], 2))).toEqual([]);
    expect(parseSavedViews(stored([{ id: '1', name: 'Arrivals', query: '' }], '1'))).toEqual([]);
  });

  it('leaves out what is not a view, a view with no name, a repeated id, and cuts a long name', () => {
    const long = 'x'.repeat(100);
    const raw = stored([
      { id: '1', name: 'Good', query: 'q=a' },
      { id: '2', name: '   ', query: '' },
      { id: 3, name: 'Number id', query: '' },
      { id: '4', name: 'No query' },
      null,
      'text',
      { id: '1', name: 'Same id again', query: '' },
      { id: '5', name: long, query: '' },
      { id: '6', name: 'Too long a query', query: 'q='.padEnd(900, 'x') },
    ]);

    const views = parseSavedViews(raw);

    expect(views.map((view) => view.id)).toEqual(['1', '5']);
    expect(views[1].name).toHaveLength(SAVED_VIEW_NAME_MAX);
  });

  it('reads no more than the limit', () => {
    const many = Array.from({ length: SAVED_VIEWS_LIMIT + 5 }, (_, index) => ({ id: String(index), name: `View ${index}`, query: '' }));

    expect(parseSavedViews(stored(many))).toHaveLength(SAVED_VIEWS_LIMIT);
  });
});

describe('withSavedView', () => {
  const views: SavedView[] = [{ id: '1', name: 'Arrivals', query: 'chip=all' }];

  it('adds a view at the end', () => {
    const result = withSavedView(views, { name: '  Unpaid  ', query: 'f_status=unpaid' }, 'new');

    expect(result).toEqual({ ok: true, views: [...views, { id: 'new', name: 'Unpaid', query: 'f_status=unpaid' }] });
  });

  it('takes a name that is already there (whatever the capitals) as an update of that view', () => {
    const result = withSavedView(views, { name: 'ARRIVALS', query: 'chip=pending' }, 'new');

    expect(result).toEqual({ ok: true, views: [{ id: '1', name: 'Arrivals', query: 'chip=pending' }] });
  });

  it('refuses an empty name, a query that is too long, and a view past the limit', () => {
    expect(withSavedView(views, { name: '   ', query: '' }, 'x')).toEqual({ ok: false, reason: 'empty' });
    expect(withSavedView(views, { name: 'Long', query: 'x'.repeat(900) }, 'x')).toEqual({ ok: false, reason: 'too-long' });
    const full = Array.from({ length: SAVED_VIEWS_LIMIT }, (_, index) => ({ id: String(index), name: `V${index}`, query: '' }));
    expect(withSavedView(full, { name: 'One more', query: '' }, 'x')).toEqual({ ok: false, reason: 'limit' });
    // An update is not "one more".
    expect(withSavedView(full, { name: 'v0', query: 'q=a' }, 'x').ok).toBe(true);
  });

  it('cuts a long name', () => {
    const result = withSavedView([], { name: 'n'.repeat(80), query: '' }, 'x');

    expect(result.ok && result.views[0].name).toHaveLength(SAVED_VIEW_NAME_MAX);
  });
});

describe('withoutSavedView', () => {
  it('takes a view away, by id', () => {
    const views = [
      { id: '1', name: 'A', query: '' },
      { id: '2', name: 'B', query: '' },
    ];

    expect(withoutSavedView(views, '1')).toEqual([views[1]]);
    expect(withoutSavedView(views, 'none')).toEqual(views);
  });
});

describe('writeSavedViews', () => {
  const key = savedViewsKey('guests', scope);

  it('writes the views with their version and tells the page, so that it follows', () => {
    const heard = vi.fn();
    window.addEventListener(SAVED_VIEWS_EVENT, heard);

    expect(writeSavedViews(key, [{ id: '1', name: 'A', query: 'q=a' }])).toBe(true);

    expect(JSON.parse(window.localStorage.getItem(key)!)).toEqual({ version: SAVED_VIEWS_VERSION, views: [{ id: '1', name: 'A', query: 'q=a' }] });
    expect(readSavedViewsRaw(key)).toBe(window.localStorage.getItem(key));
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(SAVED_VIEWS_EVENT, heard);
  });

  it('removes the entry when there are no views left', () => {
    writeSavedViews(key, [{ id: '1', name: 'A', query: '' }]);
    writeSavedViews(key, []);

    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('says so, and does not throw, when the storage refuses (full, or blocked)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(writeSavedViews(key, [{ id: '1', name: 'A', query: '' }])).toBe(false);
  });

  it('reads nothing, and does not throw, when the storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(readSavedViewsRaw(key)).toBeNull();
  });
});

describe('newSavedViewId', () => {
  it('gives a different id each time', () => {
    expect(newSavedViewId()).not.toBe(newSavedViewId());
  });

  it('still gives one where crypto.randomUUID is missing', () => {
    vi.stubGlobal('crypto', {});

    expect(newSavedViewId()).toMatch(/^v/);
    vi.unstubAllGlobals();
  });
});
