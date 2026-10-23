import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expectNoAxeViolations } from '@/test/axe';
import { PlainSection, type PlainSectionProps } from '../plain-section';

function renderSection(props: Partial<PlainSectionProps> = {}, content: React.ReactNode = <p>Il contenuto</p>) {
  return render(
    <MemoryRouter>
      <PlainSection title="Scadenze e rinnovi" {...(props as PlainSectionProps)}>
        {content}
      </PlainSection>
    </MemoryRouter>,
  );
}

describe('PlainSection (UI-16)', () => {
  afterEach(() => {
    cleanup();
  });

  it('PlainSection_Default_IsARegionNamedByItsH2AndHoldsTheContent', () => {
    renderSection();

    const region = screen.getByRole('region', { name: 'Scadenze e rinnovi' });
    const heading = within(region).getByRole('heading');
    expect(heading.tagName).toBe('H2');
    expect(within(region).getAllByRole('heading')).toHaveLength(1);
    expect(within(region).getByText('Il contenuto')).toBeInTheDocument();
  });

  it('PlainSection_WithoutAnAction_ShowsOnlyTheTitleAndTheContent', () => {
    const { container } = renderSection();

    expect(container.textContent).toBe('Scadenze e rinnoviIl contenuto');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('PlainSection_NoBox_HasNoBorderBackgroundShadowOrRadius', () => {
    renderSection({ actionLabel: 'Tutte', href: '/app/long-rent/deadlines' });

    // Not the section, not the header around the title: a card inside a card is what the calm screens took away.
    const region = screen.getByRole('region');
    for (const node of [region, region.firstElementChild!]) {
      expect(node.className).not.toMatch(/\b(border|bg-|shadow|rounded|ring)/);
    }
  });

  it('PlainSection_ActionWithAnHref_IsALinkWithTheLabelOfTheCaller', () => {
    renderSection({ actionLabel: 'Tutte le scadenze', href: '/app/long-rent/deadlines' });

    const link = screen.getByRole('link', { name: 'Tutte le scadenze' });
    expect(link).toHaveAttribute('href', '/app/long-rent/deadlines');
    expect(link).toHaveClass('min-h-11');
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('PlainSection_ActionWithAHandler_IsAButtonThatRunsItWithoutTheClickEvent', () => {
    const onAction = vi.fn();
    renderSection({ actionLabel: 'Segna tutto come letto', onAction });

    fireEvent.click(screen.getByRole('button', { name: 'Segna tutto come letto' }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith();
  });

  it('PlainSection_TwoActionsThatSayTheSame_CanBeToldApartByAnAriaLabelAndATestId', () => {
    renderSection({ actionLabel: 'Vedi tutto', actionAriaLabel: 'Vedi tutto: scadenze', actionTestId: 'scadenze-tutto', href: '/app/long-rent/deadlines' });

    const link = screen.getByRole('link', { name: 'Vedi tutto: scadenze' });
    expect(link).toHaveTextContent('Vedi tutto');
    expect(link).toHaveAttribute('data-testid', 'scadenze-tutto');
  });

  it('PlainSection_ActionWithAState_HandsItToThePageThatOpens', () => {
    render(
      <MemoryRouter initialEntries={['/start']}>
        <Routes>
          <Route
            path="/start"
            element={
              <PlainSection title="Da fare" actionLabel="Vedi tutto" href="/app/long-rent/todo" state={{ from: 'home' }}>
                <p>Il contenuto</p>
              </PlainSection>
            }
          />
          <Route path="*" element={<Arrived />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Vedi tutto' }));

    expect(screen.getByTestId('arrived')).toHaveTextContent('{"from":"home"}');
  });

  it('PlainSection_Count_IsANumberBesideTheTitleAndZeroShowsNothing', () => {
    const { unmount } = renderSection({ count: 3 });
    expect(screen.getByRole('heading')).toHaveAccessibleName('Scadenze e rinnovi 3');
    unmount();

    renderSection({ count: 0 });
    expect(screen.getByRole('heading')).toHaveTextContent(/^Scadenze e rinnovi$/);
  });

  it('PlainSection_ExtraProps_GoToTheSectionButCannotTakeItsNameAway', () => {
    renderSection({ id: 'lc-scadenze', 'data-testid': 'scadenze', className: 'mt-6', 'aria-labelledby': 'altro' } as Partial<PlainSectionProps>);

    const region = screen.getByRole('region', { name: 'Scadenze e rinnovi' });
    expect(screen.getByTestId('scadenze')).toBe(region);
    expect(region).toHaveAttribute('id', 'lc-scadenze');
    expect(region).toHaveClass('mt-6');
  });

  it('PlainSection_LongTitle_IsTextThatWrapsNotAFlexItemThatKeepsItsWidth', () => {
    renderSection({ title: 'Una_sezione_dal_titolo_lunghissimo_senza_spazi_che_non_entra_in_una_riga_stretta', count: 12 });

    const heading = screen.getByRole('heading');
    expect(heading).toHaveClass('break-words', 'min-w-0');
    // A flex box would make the words of the title an anonymous flex item, which does not shrink below its longest word.
    expect(heading).not.toHaveClass('flex');
    expect(heading.parentElement).toHaveClass('flex-wrap');
  });

  it('PlainSection_WithEveryPart_HasNoAxeViolations', async () => {
    const { container } = renderSection({ count: 2, actionLabel: 'Tutte', href: '/app/long-rent/deadlines' });

    await expectNoAxeViolations(container);
  });
});

function Arrived() {
  return <p data-testid="arrived">{JSON.stringify(useLocation().state)}</p>;
}
