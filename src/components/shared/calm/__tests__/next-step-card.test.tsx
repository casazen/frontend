import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expectNoAxeViolations } from '@/test/axe';
import { NextStepCard, type NextStepCardProps } from '../next-step-card';

function Arrived() {
  return <p data-testid="arrived">{JSON.stringify(useLocation().state)}</p>;
}

const FULL: NextStepCardProps = {
  kicker: 'Prossimo passo',
  title: 'Collega Stripe',
  detail: 'Servono pochi minuti.',
  position: 'Passo 3 di 7',
  cta: { label: 'Collega Stripe', href: '/app/short-rent/settings/payments', state: { completeStep: true }, testId: 'cta' },
};

function renderCard(props: Partial<NextStepCardProps> = {}) {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route path="/start" element={<NextStepCard {...FULL} {...props} />} />
        <Route path="*" element={<Arrived />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NextStepCard (UI-16)', () => {
  afterEach(() => {
    cleanup();
  });

  it('NextStepCard_Everything_ShowsExactlyTheWordsOfTheCallerInTheOrderOfTheActivationChecklist', () => {
    const { container } = renderCard();

    // Kicker, title, detail, position, the button: the order and the elements of the step it was taken from.
    expect(container.textContent).toBe('Prossimo passoCollega StripeServono pochi minuti.Passo 3 di 7Collega Stripe');
    expect(Array.from(container.firstElementChild!.children).map((child) => child.tagName)).toEqual(['P', 'H2', 'P', 'P', 'A']);
  });

  it('NextStepCard_CtaAsAPage_IsALinkWithTheTestIdTheHrefAndTheStateOfTheLink', () => {
    renderCard();

    const link = screen.getByTestId('cta');
    expect(link).toHaveAttribute('href', '/app/short-rent/settings/payments');
    fireEvent.click(link);

    expect(screen.getByTestId('arrived')).toHaveTextContent('{"completeStep":true}');
  });

  it('NextStepCard_CtaAsAnAction_IsAButton', () => {
    const onClick = vi.fn();
    renderCard({ cta: { label: 'Continua', onClick } });

    fireEvent.click(screen.getByRole('button', { name: 'Continua' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('NextStepCard_WithoutACta_OnlyTells', () => {
    renderCard({ cta: undefined });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('NextStepCard_TitleAs_ChoosesTheElementOfTheTitle', () => {
    const { unmount } = renderCard();
    expect(screen.getByRole('heading', { level: 2, name: 'Collega Stripe' })).toBeInTheDocument();
    unmount();

    renderCard({ titleAs: 'h3' });
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    cleanup();

    // Inside a block with a heading of its own (the activation checklist) the title is not a heading.
    renderCard({ titleAs: 'p' });
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Collega Stripe', { selector: 'p' })).toBeInTheDocument();
  });

  it('NextStepCard_DetailAndPosition_AreOptional', () => {
    const { container } = renderCard({ detail: undefined, position: undefined, cta: undefined });

    expect(container.textContent).toBe('Prossimo passoCollega Stripe');
  });

  it('NextStepCard_Look_IsTheOneOfTheStepOfTheChecklistAndItsSecondaryTextMeetsAA', () => {
    const { container } = renderCard();

    const card = container.firstElementChild!;
    expect(card).toHaveClass('rounded-lg', 'border', 'border-primary/30', 'bg-primary/5', 'p-4', 'text-left');
    // `foreground/70`, not `muted-foreground` (4.4:1 on white): the same choice as the other primitives.
    expect(screen.getByText('Servono pochi minuti.')).toHaveClass('text-foreground/70');
    expect(screen.getByText('Passo 3 di 7')).toHaveClass('text-foreground/70');
    expect(screen.getByText('Prossimo passo')).toHaveClass('text-primary-text');
  });

  it('NextStepCard_ExtraProps_GoToTheCard', () => {
    renderCard({ 'data-testid': 'activation-next-step' } as Partial<NextStepCardProps>);

    expect(screen.getByTestId('activation-next-step')).toHaveClass('p-4');
  });

  it('NextStepCard_Children_AreNotAccepted', () => {
    render(
      <MemoryRouter>
        {/* @ts-expect-error the card has its own parts: children would be dropped without a word */}
        <NextStepCard {...FULL}>un testo</NextStepCard>
      </MemoryRouter>,
    );

    expect(screen.queryByText('un testo')).not.toBeInTheDocument();
  });

  it('NextStepCard_Everything_HasNoAxeViolations', async () => {
    const { container } = renderCard();

    await expectNoAxeViolations(container);
  });
});
