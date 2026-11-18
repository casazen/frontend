import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { DashboardToday, DashboardTodayStay } from '@/types/dashboard.types';
import { TodayCard } from '../components/today-card';
import { buildTodayRows } from '../lib/home-model';

const stay: DashboardTodayStay = {
  bookingId: 'b1', guestName: 'Sofia Mare', propertyId: 'p1', propertyName: 'Casa Blu',
  checkInDate: '2026-11-18', checkOutDate: '2026-11-21', numberOfGuests: 2, status: 'Confirmed',
  checkIn: { state: 'InProgress', dataComplete: false }, cleaning: null,
};

function dayWith(stays: DashboardTodayStay[], count = stays.length): DashboardToday {
  return {
    today: '2026-11-18', arrivals: { count, items: stays },
    departures: { count: 0, items: [] }, services: { count: 0, items: [] },
    approvals: { count: 0, items: [] }, todo: { count: 0, items: [] },
  };
}

function Card({ today }: { today: DashboardToday }) {
  const { search } = useLocation();
  const propertyId = new URLSearchParams(search).get('propertyId') ?? '';
  const rows = buildTodayRows(today, { propertyId, canWrite: false }, { t: i18n.getFixedT('it'), locale: 'it' });
  return <TodayCard rows={rows} today={today} propertyId={propertyId} />;
}

function show(today: DashboardToday, query: string) {
  render(<MemoryRouter initialEntries={[`/app/short-rent?${query}`]}><Card today={today} /></MemoryRouter>);
}

describe('today’s arrivals', () => {
  beforeEach(() => i18n.changeLanguage('it').then(() => undefined));
  afterEach(cleanup);

  it('opens the selected property’s arrival on the booking check-in tab for read-only roles', () => {
    show(dayWith([stay, { ...stay, propertyId: 'p2', bookingId: 'b2' }]), 'today=arrivals&propertyId=p1');
    expect(screen.getByRole('button', { name: 'Arrivi 1' })).toHaveAttribute('aria-pressed', 'true');
    const row = screen.getByTestId('home-row');
    const link = within(row).getByRole('link', { name: /Sofia Mare.*Casa Blu.*18 nov.*21 nov.*Check-in online in corso.*Vedi check-in/ });
    expect(link).toHaveAttribute('href', '/app/short-rent/bookings/b1?tab=guest');
    expect(within(row).queryByRole('button')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Partenze 0' }));
    expect(screen.getByRole('status')).toHaveTextContent('Nessuna partenza oggi');
    expect(screen.getByRole('link', { name: 'Apri il calendario' })).toHaveAttribute('href', '/app/short-rent/bookings/calendar?view=timeline&from=2026-11-18&propertyId=p1');
  });

  it('distinguishes incomplete guest data, expired links and an unknown session', () => {
    const today = dayWith([
      { ...stay, checkIn: { state: 'Completed', dataComplete: false } },
      { ...stay, bookingId: 'b2', checkIn: { state: 'Expired', dataComplete: false } },
      { ...stay, bookingId: 'b3', checkIn: null },
      { ...stay, bookingId: 'b4', checkIn: { state: 'NotSent', dataComplete: true } },
    ]);
    show(today, 'today=arrivals');
    for (const text of ['Modulo inviato · dati ospiti incompleti', 'Link di check-in scaduto', 'Stato del check-in non disponibile', 'Dati del check-in completi']) {
      expect(screen.getByText(text)).toBeVisible();
    }
  });

  it('links to the full date and property filter when a capped server response omits local arrivals', () => {
    show(dayWith([stay], 8), 'today=arrivals&propertyId=p2');
    expect(screen.queryByText(/^Nessun arrivo/)).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('La Home mostra solo una parte');
    expect(screen.getByRole('link', { name: 'Vedi le prenotazioni' })).toHaveAttribute('href', '/app/short-rent/bookings?chip=all&f_arrival=2026-11-18..2026-11-18&f_property=p2');
  });
});
