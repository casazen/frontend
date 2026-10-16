import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { freezeClock } from '@/test/clock';
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
    vi.useRealTimers();
    cleanup();
  });

  it('CalmBlocksPage_Renders_EveryBlockInEveryVariant', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Blocchi calmi' })).toBeInTheDocument();
    for (const tone of ['neutral', 'info', 'success', 'warning', 'danger', 'long']) expect(screen.getByTestId(`focus-${tone}`)).toBeInTheDocument();
    for (const id of ['strip-2', 'strip-3', 'strip-4', 'plain-link', 'plain-action', 'plain-bare', 'plain-long', 'day-list', 'today-list', 'week-strip', 'activity-list', 'activity-oldest', 'next-step', 'next-step-bare', 'checklist', 'checklist-long', 'home-example']) {
      expect(screen.getByTestId(id), id).toBeInTheDocument();
    }
  });

  it('CalmBlocksPage_HomeExample_HasOneFocusBlockAndThreeNumbers', () => {
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

  it('CalmBlocksPage_TwoActionsThatSayTheSame_AreToldApartByTheirNames', () => {
    renderPage();

    const home = within(screen.getByTestId('home-example'));
    expect(home.getAllByRole('link', { name: /^Vedi tutto/ }).map((link) => link.getAttribute('aria-label'))).toEqual(['Vedi tutto: da fare', 'Vedi tutto: cosa è successo di recente']);
  });

  it('CalmBlocksPage_Actions_ReportWhatTheyDo', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Registra il contratto' }));

    expect(screen.getByTestId('last-action')).toHaveTextContent('Ultima azione: primaria avviso');
  });

  it('CalmBlocksPage_WeekStrip_MovesTheChoiceToTheNextDayWhenAnArrowIsPressed', () => {
    // Whatever day it is: Tuesday is not special.
    freezeClock('2026-10-13T10:00:00Z');
    renderPage();

    const radios = within(screen.getByTestId('week-strip')).getAllByRole('radio');
    const chosen = radios.findIndex((radio) => radio.getAttribute('aria-checked') === 'true');
    expect(radios[chosen].getAttribute('data-date')).toBe('2026-10-13');
    expect(screen.getByTestId('week-selected')).toHaveTextContent('Giorno scelto: 2026-10-13');

    radios[chosen].focus();
    fireEvent.keyDown(radios[chosen], { key: 'ArrowRight' });

    expect(screen.getByTestId('week-selected')).toHaveTextContent('Giorno scelto: 2026-10-14');
  });

  it('CalmBlocksPage_HasNoAxeViolations', { timeout: 60_000 }, async () => {
    const { container } = renderPage();

    await expectNoAxeViolations(container);
  });
});
