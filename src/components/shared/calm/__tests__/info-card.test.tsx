import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Banknote } from 'lucide-react';
import { expectNoAxeViolations } from '@/test/axe';
import { InfoCard, type InfoCardProps } from '../info-card';

function renderCard(props: Partial<InfoCardProps> = {}, content: React.ReactNode = <p>Il contenuto</p>) {
  return render(
    <MemoryRouter>
      <InfoCard icon={Banknote} title="Prezzi" {...props}>
        {content}
      </InfoCard>
    </MemoryRouter>,
  );
}

describe('InfoCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('InfoCard_Default_IsARegionNamedByItsH2AndHoldsTheContent', () => {
    renderCard();

    const region = screen.getByRole('region', { name: 'Prezzi' });
    const heading = within(region).getByRole('heading');
    expect(heading.tagName).toBe('H2');
    expect(within(region).getAllByRole('heading')).toHaveLength(1);
    expect(within(region).getByText('Il contenuto')).toBeInTheDocument();
  });

  it('InfoCard_TitleAsH3_IsTheHeadingOfACardInsideAPartThatHasItsOwnH2', () => {
    renderCard({ titleAs: 'h3' });

    expect(screen.getByRole('heading', { name: 'Prezzi' }).tagName).toBe('H3');
  });

  it('InfoCard_Icon_IsDecorativeAndNeverPartOfTheName', () => {
    const { container } = renderCard();

    const tile = container.querySelector('header span[aria-hidden="true"]');
    expect(tile).toHaveAttribute('aria-hidden', 'true');
    expect(tile?.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('region')).toHaveAccessibleName('Prezzi');
  });

  it('InfoCard_WithoutStatusAsideOrAction_ShowsOnlyTheTitleAndTheContent', () => {
    const { container } = renderCard();

    expect(container.textContent).toBe('PrezziIl contenuto');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('InfoCard_StatusHintAndAside_SitInTheHeaderWithTheTitle', () => {
    renderCard({
      status: <span>Attivo</span>,
      hint: <button type="button">Cos'è</button>,
      aside: <button type="button">Modifica</button>,
    });

    const header = screen.getByRole('region').querySelector('header')!;
    expect(within(header).getByText('Attivo')).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: "Cos'è" })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Modifica' })).toBeInTheDocument();
  });

  it('InfoCard_ActionWithAnHref_IsALinkWithTheLabelOfTheCallerAndAtLeast44Px', () => {
    renderCard({ action: { label: 'Gestisci', href: '/app/short-rent/properties/1/pricing', testId: 'card-action' } });

    const link = screen.getByRole('link', { name: 'Gestisci' });
    expect(link).toHaveAttribute('href', '/app/short-rent/properties/1/pricing');
    expect(link).toHaveAttribute('data-testid', 'card-action');
    expect(link).toHaveClass('min-h-11');
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('InfoCard_ActionWithAHandler_IsAButtonThatRunsItWithoutTheClickEvent', () => {
    const onClick = vi.fn();
    renderCard({ action: { label: 'Rinnova', onClick } });

    fireEvent.click(screen.getByRole('button', { name: 'Rinnova' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith();
  });

  it('InfoCard_Tone_ColoursOnlyTheSquareOfTheIcon', () => {
    const { container } = renderCard({ tone: 'warning' });

    expect(container.querySelector('header span[aria-hidden="true"]')).toHaveClass('bg-warning-soft');
    expect(screen.getByRole('region')).not.toHaveClass('bg-warning-soft');
  });

  it('InfoCard_PropsOfTheElement_GoToTheSection', () => {
    renderCard({ id: 'property-pricing', className: 'scroll-mt-6', 'data-testid': 'pricing-card' } as Partial<InfoCardProps>);

    const region = screen.getByTestId('pricing-card');
    expect(region.tagName).toBe('SECTION');
    expect(region).toHaveAttribute('id', 'property-pricing');
    expect(region).toHaveClass('scroll-mt-6');
  });

  it('InfoCard_AllItsParts_HaveNoAccessibilityViolation', async () => {
    const { container } = renderCard({
      status: <span>Attivo</span>,
      hint: <button type="button">Maggiori informazioni</button>,
      action: { label: 'Gestisci', href: '/app' },
    });

    await expectNoAxeViolations(container);
  });
});
