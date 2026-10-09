import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { recallList } from '@/lib/list-return';
import { useListReturn } from '../use-list-return';

const BOOKINGS = '/app/short-rent/bookings';

/** A list page: the filters are in its address, and the buttons stand for the user changing them. */
function List() {
  useListReturn(BOOKINGS);
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate(`${BOOKINGS}?status=Confirmed`, { replace: true })}>
        confirmed
      </button>
      <button type="button" onClick={() => navigate(`${BOOKINGS}?status=Confirmed&q=rossi`, { replace: true })}>
        confirmed rossi
      </button>
      <button type="button" onClick={() => navigate(BOOKINGS)}>
        all
      </button>
    </>
  );
}

describe('useListReturn (UI-05)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('useListReturn_ListOpenedWithFilters_RemembersThem', () => {
    render(
      <MemoryRouter initialEntries={[`${BOOKINGS}?status=Pending`]}>
        <List />
      </MemoryRouter>,
    );

    expect(recallList(BOOKINGS)).toBe('?status=Pending');
  });

  it('useListReturn_FiltersChange_RemembersTheLastState', () => {
    render(
      <MemoryRouter initialEntries={[BOOKINGS]}>
        <List />
      </MemoryRouter>,
    );
    expect(recallList(BOOKINGS)).toBe('');

    fireEvent.click(screen.getByText('confirmed'));
    expect(recallList(BOOKINGS)).toBe('?status=Confirmed');

    fireEvent.click(screen.getByText('confirmed rossi'));
    expect(recallList(BOOKINGS)).toBe('?status=Confirmed&q=rossi');
  });

  it('useListReturn_ListOpenedAgainWithoutFilters_ForgetsTheOldOnes', () => {
    render(
      <MemoryRouter initialEntries={[`${BOOKINGS}?status=Confirmed`]}>
        <List />
      </MemoryRouter>,
    );
    expect(recallList(BOOKINGS)).toBe('?status=Confirmed');

    // The user opened "Prenotazioni" from the menu: the list is the plain one, and that is what is remembered.
    fireEvent.click(screen.getByText('all'));

    expect(recallList(BOOKINGS)).toBe('');
  });

  it('useListReturn_ListLeavesTheScreen_KeepsItsStateForTheWayBack', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={[`${BOOKINGS}?status=Confirmed&q=rossi`]}>
        <List />
      </MemoryRouter>,
    );

    // The user opened a booking: the list is gone, and its state is what BackLink and the breadcrumb lead back to.
    unmount();

    expect(recallList(BOOKINGS)).toBe('?status=Confirmed&q=rossi');
  });
});
