import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LIST_RETURN_STORAGE_KEY } from '@/lib/list-return';
import { useListState } from '../use-list-state';
import { stayList } from './list-fixtures';

const list = stayList();

/** The hook inside a memory router, with what a test wants to see of the history next to it. */
function renderState(initial = '/app/short-rent/bookings') {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>;
  const { result } = renderHook(
    () => ({
      list: useListState(list),
      search: useLocation().search,
      navigationType: useNavigationType(),
      navigate: useNavigate(),
    }),
    { wrapper },
  );
  return result;
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('useListState', () => {
  it('reads the state from the address', () => {
    const result = renderState('/app/short-rent/bookings?q=ross&chip=pending&sort=total:desc');

    expect(result.current.list.state).toMatchObject({ q: 'ross', chip: 'pending', sort: { id: 'total', direction: 'desc' } });
  });

  it('writes a change to the address and adds a step to the history, so that Back gives the previous view', () => {
    const result = renderState();

    act(() => result.current.list.setChip('pending'));
    expect(result.current.search).toBe('?chip=pending');
    expect(result.current.navigationType).toBe('PUSH');

    act(() => result.current.list.setFilters({ property: 'trullo' }));
    expect(result.current.search).toBe('?chip=pending&f_property=trullo');

    act(() => void result.current.navigate(-1));
    expect(result.current.search).toBe('?chip=pending');
    expect(result.current.navigationType).toBe('POP');
  });

  it("leaves the parameters that are not the list's where they are", () => {
    const result = renderState('/app/short-rent/bookings?propertyId=p1');

    act(() => result.current.list.setQ('anna'));

    expect(result.current.search).toBe('?propertyId=p1&q=anna');
  });

  it('writes nothing, and adds nothing to the history, when nothing changes', () => {
    const result = renderState('/app/short-rent/bookings?chip=pending');

    act(() => result.current.list.setChip('pending'));
    act(() => result.current.list.setPage(1));

    expect(result.current.search).toBe('?chip=pending');
    expect(result.current.navigationType).toBe('POP');
  });

  it('goes back to the first page when the search, the filters, the quick filter or the order change, not when the columns do', () => {
    const result = renderState('/app/short-rent/bookings?page=3');

    act(() => result.current.list.setColumns(['guest', 'email']));
    expect(result.current.search).toBe('?cols=guest%2Cemail&page=3');
    act(() => result.current.list.setSort({ id: 'total', direction: 'desc' }));
    expect(result.current.search).toBe('?sort=total%3Adesc&cols=guest%2Cemail');
    act(() => result.current.list.setPage(4));
    expect(result.current.search).toBe('?sort=total%3Adesc&cols=guest%2Cemail&page=4');
    act(() => result.current.list.setQ('x'));
    expect(result.current.search).toBe('?q=x&sort=total%3Adesc&cols=guest%2Cemail');
  });

  it('does not lose a change made before React has rendered the one before', () => {
    const result = renderState();

    act(() => {
      result.current.list.setQ('anna', { typing: true });
      result.current.list.setChip('all');
    });

    expect(result.current.search).toBe('?q=anna&chip=all');
  });

  describe('typing', () => {
    it('adds one step to the history for a search being typed, and the next changes replace it', () => {
      const result = renderState();

      act(() => result.current.list.setQ('r', { typing: true }));
      expect(result.current.navigationType).toBe('PUSH');
      act(() => result.current.list.setQ('ro', { typing: true }));
      act(() => result.current.list.setQ('ros', { typing: true }));
      expect(result.current.search).toBe('?q=ros');
      expect(result.current.navigationType).toBe('REPLACE');

      act(() => void result.current.navigate(-1));
      expect(result.current.search).toBe('');
    });

    it('starts a new step after anything that is not typing', () => {
      const result = renderState();

      act(() => result.current.list.setQ('ros', { typing: true }));
      act(() => result.current.list.setChip('pending'));
      act(() => result.current.list.setQ('rossi', { typing: true }));

      expect(result.current.navigationType).toBe('PUSH');
    });

    it('starts a new step when Back or a link changed the address since', () => {
      const result = renderState();

      act(() => result.current.list.setQ('ros', { typing: true }));
      act(() => void result.current.navigate('/app/short-rent/bookings?q=elsewhere'));
      act(() => result.current.list.setQ('elsewhere2', { typing: true }));

      expect(result.current.navigationType).toBe('PUSH');
    });
  });

  describe('the layout', () => {
    it('follows the quick filter of the layout it goes to, unless the person chose another', () => {
      const result = renderState();
      expect(result.current.list.state.chip).toBe('upcoming');

      act(() => result.current.list.setLayout('board'));
      expect(result.current.search).toBe('?view=board');
      expect(result.current.list.state.chip).toBe('all');

      act(() => result.current.list.setChip('pending'));
      act(() => result.current.list.setLayout('list'));
      expect(result.current.search).toBe('?chip=pending');
    });
  });

  describe('views', () => {
    it('applies the query of a saved view over the whole state and keeps the other parameters', () => {
      const result = renderState('/app/short-rent/bookings?propertyId=p1&q=old&page=3');

      act(() => result.current.list.applyQuery('chip=all&f_property=trullo'));

      expect(result.current.search).toBe('?propertyId=p1&chip=all&f_property=trullo');
    });

    it('applies a view that comes with the list', () => {
      const result = renderState();

      act(() => result.current.list.applyPreset({ chip: 'all', filters: { arrival: '2026-10-07..2026-10-14' } }));

      expect(result.current.search).toBe('?chip=all&f_arrival=2026-10-07..2026-10-14');
    });

    it('clears the search, the filters and the quick filter', () => {
      const result = renderState('/app/short-rent/bookings?q=x&chip=pending&f_property=trullo&sort=total:desc');

      act(() => result.current.list.clear());

      expect(result.current.search).toBe('?chip=all&sort=total%3Adesc');
    });
  });

  it('remembers the list for the way back from a page of detail', () => {
    renderState('/app/short-rent/bookings?chip=pending');

    expect(JSON.parse(window.sessionStorage.getItem(LIST_RETURN_STORAGE_KEY) ?? '{}')).toEqual({ '/app/short-rent/bookings': '?chip=pending' });
  });
});
