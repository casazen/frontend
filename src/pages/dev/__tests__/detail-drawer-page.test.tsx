import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { takeOpener } from '@/components/shared/detail-drawer/detail-opener';
import { expectNoAxeViolations } from '@/test/axe';
import DetailDrawerPage from '../detail-drawer-page';

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

/** The button that opens a row, in the table (the cards of a phone are in the page too, and a media query shows one of the two). */
const nameInTable = (name: string) => within(screen.getByRole('table', { name: 'Prenotazioni' })).getByRole('button', { name });

function renderPage(entry = '/dev/detail-drawer') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <DetailDrawerPage />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DetailDrawerPage (UI-15, the page of the detail drawer for developers)', () => {
  afterEach(async () => {
    cleanup();
    // The focus scope of a dialog that was open says goodbye one tick after it unmounts.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    takeOpener();
  });

  it('DetailDrawerPage_Renders_EveryPartOnTheSamePage', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: /Cassetto di dettaglio/ })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Sezioni della pagina di prova' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Prenotazioni' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Cronologia, dal più recente' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Cronologia, dal più vecchio' })).toBeInTheDocument();
    expect(screen.getByTestId('dev-timeline-empty')).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Schede con il numero' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('DetailDrawerPage_AButtonOutsideAnyList_OpensTheDrawerWithTheDataOfTheBooking', async () => {
    renderPage();

    fireEvent.click(screen.getByTestId('open-booking'));

    const dialog = await screen.findByRole('dialog', { name: 'Elena Gatti' }, { timeout: 5000 });
    expect(await within(dialog).findByTestId('dev-booking-content', undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/dev/detail-drawer?detail=dev-booking:ZS-1002');
    expect(screen.getByTestId('current-drawer')).toHaveTextContent('Aperto: dev-booking:ZS-1002');
    // The timeline inside the drawer shows four of the six events and offers the rest.
    expect(within(dialog).getByRole('list', { name: 'Cronologia della prenotazione' }).children).toHaveLength(4);
    expect(within(dialog).getByTestId('timeline-show-more')).toBeInTheDocument();
  });

  it('DetailDrawerPage_ARowOfTheList_OpensTheSameDrawerWithTheKeyOfTheRow', async () => {
    renderPage();

    fireEvent.click(nameInTable('Sofia Marino'));

    expect(await screen.findByRole('dialog', { name: 'Sofia Marino' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('detail=dev-booking:ZS-1001');
  });

  it('DetailDrawerPage_ASharedLink_OpensTheDrawerOnLoad', async () => {
    renderPage('/dev/detail-drawer?detail=dev-note:n-1');

    const dialog = await screen.findByRole('dialog', { name: 'Dettaglio' });
    expect(within(dialog).getByTestId('dev-note-content')).toBeInTheDocument();
    expect(dialog).toHaveClass('md:max-w-2xl');
  });

  it('DetailDrawerPage_InvalidId_IsRefusedAndNothingOpens', () => {
    renderPage();

    fireEvent.click(screen.getByTestId('open-invalid'));

    expect(screen.getByTestId('open-answer')).toHaveTextContent('rifiutato');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/dev\/detail-drawer$/);
  });

  it('DetailDrawerPage_LocalSlot_StillOpensThePanelOfTheListAndLeavesTheAddressAlone', async () => {
    renderPage('/dev/detail-drawer?slot=local');

    fireEvent.click(nameInTable('Sofia Marino'));

    const panel = await screen.findByTestId('list-detail-panel');
    expect(within(panel).getByTestId('dev-local-slot')).toHaveTextContent('ZS-1001');
    expect(screen.getByTestId('where')).not.toHaveTextContent('detail=');
  });

  it('DetailDrawerPage_Closed_HasNoAxeViolations', async () => {
    const { container } = renderPage();

    await expectNoAxeViolations(container);
  });
});
