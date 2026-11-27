import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { ALLOGGIATI_KEY } from '@/queries/use-alloggiati';
import type { AlloggiatiStatusDto } from '@/types/alloggiati.types';
import { GuestDataNotice } from '../guest-data-notice';

vi.mock('@/api/alloggiati.api', () => ({ alloggiatiApi: { getStatus: vi.fn() } }));

const BOOKING_ID = 'b-1';

const incomplete = { dataComplete: false } as AlloggiatiStatusDto;

/** The client of the app does not read an unobserved query again by default (`refetchOnMount: false`). */
function renderNotice(notice: React.ReactElement, seed?: AlloggiatiStatusDto) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnMount: false } } });
  if (seed) client.setQueryData([ALLOGGIATI_KEY, 'status', BOOKING_ID], seed);
  return render(
    createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, notice))),
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  vi.mocked(alloggiatiApi.getStatus).mockResolvedValue(incomplete);
});

describe('GuestDataNotice', () => {
  it('GuestDataNotice_LinkMode_LeadsToTheAlloggiatiTabAndTellsTheCaller', async () => {
    const onNavigate = vi.fn();
    renderNotice(createElement(GuestDataNotice, { bookingId: BOOKING_ID, onNavigate }));

    const link = await screen.findByTestId('guest-data-complete-link');
    expect(link).toHaveAttribute('href', `/app/short-rent/bookings/${BOOKING_ID}?tab=alloggiati`);
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('GuestDataNotice_InlineMode_IsAButtonThatOpensThePanelAndLeadsNowhere', async () => {
    const onComplete = vi.fn();
    renderNotice(createElement(GuestDataNotice, { bookingId: BOOKING_ID, inline: true, onComplete }));

    const button = await screen.findByTestId('guest-data-complete-open');
    expect(button.tagName).toBe('BUTTON');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guest-data-complete-link')).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('GuestDataNotice_InlineModeWhileSomethingElseWorks_KeepsTheButtonOff', async () => {
    const onComplete = vi.fn();
    renderNotice(createElement(GuestDataNotice, { bookingId: BOOKING_ID, inline: true, onComplete, busy: true }));

    const button = await screen.findByTestId('guest-data-complete-open');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('GuestDataNotice_StatusCannotBeRead_StillOffersTheWayToCompleteTheData', async () => {
    vi.mocked(alloggiatiApi.getStatus).mockRejectedValue(new Error('network'));
    renderNotice(createElement(GuestDataNotice, { bookingId: BOOKING_ID, inline: true, onComplete: vi.fn() }));

    expect(await screen.findByTestId('guest-data-unknown')).toBeInTheDocument();
    expect(screen.getByTestId('guest-data-complete-open')).toBeInTheDocument();
  });

  it('GuestDataNotice_InlineMode_ReadsTheStatusAgainWhenItOpensWhateverTheCacheHolds', async () => {
    // The panel of the wizard saves guests while the notice is not on screen: what it shows must be what the server holds now.
    renderNotice(createElement(GuestDataNotice, { bookingId: BOOKING_ID, inline: true, onComplete: vi.fn() }), { dataComplete: true } as AlloggiatiStatusDto);

    await waitFor(() => expect(alloggiatiApi.getStatus).toHaveBeenCalledWith(BOOKING_ID));
    expect(await screen.findByTestId('guest-data-incomplete')).toBeInTheDocument();
  });

  it('GuestDataNotice_LinkMode_KeepsTheStatusOfTheCacheAsBefore', async () => {
    renderNotice(createElement(GuestDataNotice, { bookingId: BOOKING_ID }), { dataComplete: true } as AlloggiatiStatusDto);

    expect(await screen.findByTestId('guest-data-complete')).toBeInTheDocument();
    expect(alloggiatiApi.getStatus).not.toHaveBeenCalled();
  });
});
