import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expectNoAxeViolations } from '@/test/axe';
import UiPrimitivesPage from '../ui-primitives-page';

function renderPage(entry = '/dev/primitives') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <UiPrimitivesPage />
    </MemoryRouter>,
  );
}

describe('UiPrimitivesPage (UI-07, the page of the primitives for developers)', () => {
  afterEach(() => {
    cleanup();
  });

  it('UiPrimitivesPage_Renders_EveryPrimitiveOnTheSamePage', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Primitive UI B' })).toBeInTheDocument();
    expect(screen.getByTestId('open-dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Maggiori informazioni' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Sezioni della prenotazione' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Vista' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Quale regime fiscale?' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Adulti' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Ospiti di prova' })).toBeInTheDocument();
    expect(screen.getByTestId('archive')).toBeInTheDocument();
  });

  it('UiPrimitivesPage_Undo_TheButtonsChangeTheStateAndTheToastTakesItBack', () => {
    renderPage();
    expect(screen.getByTestId('undo-state')).toHaveTextContent('Archiviato: no');

    fireEvent.click(screen.getByTestId('archive'));

    expect(screen.getByTestId('undo-state')).toHaveTextContent('Archiviato: sì');
  });

  it('UiPrimitivesPage_Controls_RespondToTheUser', () => {
    renderPage();

    fireEvent.click(screen.getByTestId('view-calendar'));
    expect(screen.getByTestId('view-now')).toHaveTextContent('Vista: calendar');

    fireEvent.click(within(screen.getByRole('group', { name: 'Adulti' })).getByRole('button', { name: 'Aumenta Adulti' }));
    expect(screen.getByTestId('qty-now')).toHaveTextContent('Adulti: 3');

    fireEvent.click(screen.getByTestId('regime-ordinario'));
    expect(screen.getByTestId('regime-ordinario')).toBeChecked();
  });

  it('UiPrimitivesPage_HasNoAxeViolations', async () => {
    const { container } = renderPage();

    await expectNoAxeViolations(container);
  });
});
