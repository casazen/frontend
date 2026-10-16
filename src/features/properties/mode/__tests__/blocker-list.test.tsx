import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { PropertyModeBlocker } from '@/types/property-mode.types';
import { BlockerList } from '../components/blocker-list';
import { blocker } from './mode-fixtures';

function renderList(blockers: PropertyModeBlocker[], props: { limit?: number; seeAll?: { to: string; label: string } } = {}) {
  return render(
    <MemoryRouter>
      <BlockerList blockers={blockers} propertyId="p1" {...props} />
    </MemoryRouter>,
  );
}

describe('BlockerList (PM-03)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('BlockerList_EachKind_SaysWhatItIsItsDatesItsStatusAndWhereToDealWithIt', () => {
    renderList([
      blocker({ id: 's1', kind: 'Stay', status: 'Pending', start: '2026-11-01', end: '2026-11-08' }),
      blocker({ id: 'i1', kind: 'ImportedBlock', status: null, source: 'Airbnb' }),
      blocker({ id: 'l1', kind: 'Lease', status: 'Registered', start: '2025-12-01', end: '2026-12-01' }),
      blocker({ id: 'd1', kind: 'DraftLease', status: 'Draft', freeFrom: null }),
    ]);

    const stay = screen.getByTestId('property-mode-blocker-Stay');
    expect(stay).toHaveTextContent('Soggiorno');
    expect(stay).toHaveTextContent('dal 1 novembre al 8 novembre 2026');
    expect(stay).toHaveTextContent(i18n.t('status.booking.Pending.label'));
    expect(within(stay).getByRole('link', { name: 'Apri la prenotazione' })).toHaveAttribute('href', '/app/short-rent/bookings/s1');

    // A block of a portal has no status: only what it is and where the calendars are.
    const portal = screen.getByTestId('property-mode-blocker-ImportedBlock');
    expect(portal).toHaveTextContent('Date occupate su un portale');
    expect(portal.querySelector('[data-status-kind]')).toBeNull();
    expect(within(portal).getByRole('link', { name: 'Apri i calendari' })).toHaveAttribute('href', '/app/short-rent/properties/p1?tab=ical');

    const lease = screen.getByTestId('property-mode-blocker-Lease');
    expect(lease).toHaveTextContent(i18n.t('status.lease.Registered.label'));
    expect(within(lease).getByRole('link', { name: 'Apri il contratto' })).toHaveAttribute('href', '/app/long-rent/leases/l1');

    const draft = screen.getByTestId('property-mode-blocker-DraftLease');
    expect(draft).toHaveTextContent('Bozza di contratto');
    expect(draft).toHaveTextContent(i18n.t('status.lease.Draft.label'));
    expect(within(draft).getByRole('link', { name: 'Apri la bozza' })).toHaveAttribute('href', '/app/long-rent/leases/d1');
  });

  it('BlockerList_ASpanOfYears_WritesTheYearWhereItTellsTheDaysApart', () => {
    renderList([
      blocker({ id: 'lease-1', kind: 'Lease', start: '2025-12-01', end: '2026-12-01', status: 'Registered' }),
      blocker({ id: 'stay-1', kind: 'Stay', start: '2026-12-28', end: '2027-01-03' }),
      blocker({ id: 'stay-2', kind: 'Stay', start: '2026-10-05', end: '2026-10-09' }),
    ]);

    // A lease from December to December is not "from the 1st of December to the 1st of December".
    expect(screen.getByTestId('property-mode-blocker-Lease')).toHaveTextContent('dal 1 dicembre 2025 al 1 dicembre 2026');
    const [crossing, within_] = screen.getAllByTestId('property-mode-blocker-Stay');
    expect(crossing).toHaveTextContent('dal 28 dicembre 2026 al 3 gennaio 2027');
    expect(within_).toHaveTextContent('dal 5 ottobre al 9 ottobre 2026');
  });

  it('BlockerList_ManyOfThem_ShowsTheFirstFiveAndCountsTheRest', () => {
    renderList(Array.from({ length: 7 }, (_, index) => blocker({ id: `s${index}` })));

    expect(screen.getAllByTestId('property-mode-blocker-Stay')).toHaveLength(5);
    expect(screen.getByTestId('property-mode-blockers-more')).toHaveTextContent('...e altri 2');
    expect(screen.queryByTestId('property-mode-blockers-see-all')).not.toBeInTheDocument();
  });

  it('BlockerList_ManyOfThem_OffersTheWayToAllOfThemWhenThereIsOne', () => {
    renderList(Array.from({ length: 4 }, (_, index) => blocker({ id: `s${index}` })), {
      limit: 2,
      seeAll: { to: '/app/short-rent/bookings?propertyId=p1', label: 'Vedi tutte le prenotazioni' },
    });

    expect(screen.getByRole('link', { name: 'Vedi tutte le prenotazioni' })).toHaveAttribute('href', '/app/short-rent/bookings?propertyId=p1');
    // Nothing more to show: no counter, no link.
    expect(screen.getAllByTestId('property-mode-blocker-Stay')).toHaveLength(2);
  });

  it('BlockerList_NothingLeftOver_HasNoCounterAndNoLink', () => {
    renderList([blocker()], { seeAll: { to: '/somewhere', label: 'Vedi tutti' } });

    expect(screen.queryByTestId('property-mode-blockers-more')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Vedi tutti' })).not.toBeInTheDocument();
  });

  it('BlockerList_OneMoreThanTheLimit_UsesTheSingular', () => {
    renderList([blocker({ id: 'a' }), blocker({ id: 'b' }), blocker({ id: 'c' })], { limit: 2 });

    expect(screen.getAllByTestId('property-mode-blocker-Stay')).toHaveLength(2);
    expect(screen.getByTestId('property-mode-blockers-more')).toHaveTextContent('...e 1 altro');
  });

  it('BlockerList_AStatusThisVersionDoesNotKnow_IsShownAsItCame', () => {
    renderList([blocker({ status: 'SomethingNew' })]);

    expect(screen.getByTestId('property-mode-blocker-Stay')).toHaveTextContent('SomethingNew');
  });

  it('BlockerList_English_UsesTheEnglishTexts', async () => {
    await i18n.changeLanguage('en');
    renderList([blocker({ start: '2026-11-01', end: '2026-11-08' })]);

    const stay = screen.getByTestId('property-mode-blocker-Stay');
    expect(stay).toHaveTextContent('Stay');
    expect(stay).toHaveTextContent('from November 1 to November 8, 2026');
    expect(within(stay).getByRole('link', { name: 'Open the booking' })).toBeInTheDocument();
  });
});
