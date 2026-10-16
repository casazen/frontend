import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expectNoAxeViolations } from '@/test/axe';
import CalmBlocksPage from '../calm-blocks-page';

function renderPage(entry = '/dev/calm-blocks') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <CalmBlocksPage />
    </MemoryRouter>,
  );
}

describe('CalmBlocksPage (UI-16, the page of the calm blocks for developers)', () => {
  afterEach(() => {
    cleanup();
  });

  it('CalmBlocksPage_Renders_EveryBlockInEveryVariant', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Blocchi calmi' })).toBeInTheDocument();
    for (const tone of ['neutral', 'info', 'success', 'warning', 'danger', 'long']) expect(screen.getByTestId(`focus-${tone}`)).toBeInTheDocument();
    for (const id of ['strip-2', 'strip-3', 'strip-4', 'plain-link', 'plain-action', 'plain-bare', 'day-list', 'today-list', 'week-strip', 'activity-list', 'activity-oldest', 'next-step', 'next-step-bare', 'checklist', 'home-example']) {
      expect(screen.getByTestId(id), id).toBeInTheDocument();
    }
  });

  it('CalmBlocksPage_HomeExample_HasOneFocusBlockAndAtMostFourNumbers', () => {
    renderPage();

    const home = within(screen.getByTestId('home-example'));
    // The composition the README shows: one highlighted block, three sections, three numbers, one checklist.
    expect(home.getAllByRole('region').filter((region) => region.hasAttribute('data-tone'))).toHaveLength(1);
    expect(home.getAllByRole('listitem').filter((item) => item.closest('[role="group"]'))).toHaveLength(3);
  });

  it('CalmBlocksPage_Names_AreUniqueSoThatNoTwoRegionsShareOne', () => {
    renderPage();

    const names = screen.getAllByRole('region').map((region) => region.getAttribute('aria-labelledby') && document.getElementById(region.getAttribute('aria-labelledby')!)?.textContent);
    expect(names.length).toBeGreaterThan(20);
    expect(new Set(names).size).toBe(names.length);
  });

  it('CalmBlocksPage_Actions_ReportWhatTheyDo', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Registra il contratto' }));

    expect(screen.getByTestId('last-action')).toHaveTextContent('Ultima azione: primaria avviso');
  });

  it('CalmBlocksPage_WeekStrip_ChoosesADayWhenAnArrowIsPressed', () => {
    renderPage();

    const strip = within(screen.getByTestId('week-strip'));
    const radios = strip.getAllByRole('radio');
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' });

    expect(screen.getByTestId('week-selected')).toHaveTextContent(`Giorno scelto: ${radios[1].getAttribute('data-date')}`);
  });

  it('CalmBlocksPage_HasNoAxeViolations', { timeout: 60_000 }, async () => {
    const { container } = renderPage();

    await expectNoAxeViolations(container);
  });
});
