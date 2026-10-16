import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { ChecklistCompact, type ChecklistCompactProps } from '../checklist-compact';

const FULL: ChecklistCompactProps = {
  title: 'Configura Affitti brevi',
  done: 2,
  total: 5,
  progress: '2 di 5',
  next: 'Prossimo: Collega Stripe · 5 minuti',
  primary: { label: 'Continua', href: '/app/short-rent/settings/payments' },
  secondary: { label: 'Tutti i passi', onClick: () => undefined },
};

function renderChecklist(props: Partial<ChecklistCompactProps> = {}) {
  return render(
    <MemoryRouter>
      <ChecklistCompact {...FULL} {...props} />
    </MemoryRouter>,
  );
}

describe('ChecklistCompact (UI-16)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('ChecklistCompact_Default_IsARegionNamedByItsTitleWithOneH2', () => {
    renderChecklist();

    const region = screen.getByRole('region', { name: 'Configura Affitti brevi 2 di 5' });
    expect(within(region).getAllByRole('heading')).toHaveLength(1);
    expect(within(region).getByRole('heading').tagName).toBe('H2');
  });

  it('ChecklistCompact_Everything_ShowsExactlyTheWordsOfTheCallerAndNoFixedText', () => {
    const { container } = renderChecklist();

    expect(container.textContent).toBe('Configura Affitti brevi 2 di 5Prossimo: Collega Stripe · 5 minutiTutti i passiContinua');
  });

  it('ChecklistCompact_Bar_IsTheProgressBarOfTheProductReadAsTheCountOfTheCaller', async () => {
    const { unmount } = renderChecklist();
    const bar = screen.getByRole('progressbar', { name: 'Avanzamento' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    // What a screen reader says is the count in the words of the caller, not "40".
    expect(bar).toHaveAttribute('aria-valuetext', '2 di 5');
    expect(bar.firstElementChild).toHaveStyle({ width: '40%' });
    unmount();

    await i18n.changeLanguage('en');
    renderChecklist();
    expect(screen.getByRole('progressbar', { name: 'Progress' })).toBeInTheDocument();
  });

  it('ChecklistCompact_ProgressLabel_IsTheNameOfTheCaller', () => {
    renderChecklist({ progressLabel: 'Configurazione: 2 passi su 5 fatti' });

    expect(screen.getByRole('progressbar', { name: 'Configurazione: 2 passi su 5 fatti' })).toBeInTheDocument();
  });

  it('ChecklistCompact_DoneBeyondTheRange_IsKeptInside', () => {
    const { unmount } = renderChecklist({ done: 9 });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '100%' });
    unmount();

    renderChecklist({ done: -1, total: 0 });
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '0%' });
  });

  it('ChecklistCompact_Actions_AreALinkForTheStepAndAButtonForTheWholeList', () => {
    renderChecklist();

    expect(screen.getByRole('link', { name: 'Continua' })).toHaveAttribute('href', '/app/short-rent/settings/payments');
    expect(screen.getByRole('button', { name: 'Tutti i passi' })).toBeInTheDocument();
    for (const action of [screen.getByRole('link', { name: 'Continua' }), screen.getByRole('button', { name: 'Tutti i passi' })]) {
      expect(action).toHaveClass('min-h-11');
    }
  });

  it('ChecklistCompact_WithoutActionsOrNext_ShowsOnlyTheTitleAndTheBar', () => {
    const { container } = renderChecklist({ primary: undefined, secondary: undefined, next: undefined });

    expect(container.textContent).toBe('Configura Affitti brevi 2 di 5');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('ChecklistCompact_LongTitle_IsTextThatWrapsNotAFlexItemThatKeepsItsWidth', () => {
    renderChecklist({ title: 'Configura_Casa_Vacanze_Trullo_dei_Sogni_Alberobello_Via_Roma_12_interno_3' });

    const heading = screen.getByRole('heading');
    expect(heading).toHaveClass('break-words');
    expect(heading).not.toHaveClass('flex');
  });

  it('ChecklistCompact_Children_AreNotAccepted', () => {
    render(
      <MemoryRouter>
        {/* @ts-expect-error the actions have their own props: children would be dropped without a word */}
        <ChecklistCompact {...FULL}>un testo</ChecklistCompact>
      </MemoryRouter>,
    );

    expect(screen.queryByText('un testo')).not.toBeInTheDocument();
  });

  it('ChecklistCompact_Everything_HasNoAxeViolations', async () => {
    const { container } = renderChecklist();

    await expectNoAxeViolations(container);
  });
});
