import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { Bath, Banknote, MapPin } from 'lucide-react';
import { expectNoAxeViolations } from '@/test/axe';
import { Figure, Figures, IconFact, IconFacts } from '../icon-fact';

describe('IconFacts', () => {
  afterEach(() => {
    cleanup();
  });

  it('IconFacts_Default_IsAListWithOneFactOnEachLine', () => {
    render(
      <IconFacts>
        <IconFact icon={MapPin}>Via Roma 1, Como</IconFact>
        <IconFact icon={Bath}>1 bagno</IconFact>
      </IconFacts>,
    );

    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(list).toHaveClass('space-y-2');
  });

  it('IconFacts_Inline_PutsTheFactsSideBySideAndWrapsThem', () => {
    render(
      <IconFacts layout="inline">
        <IconFact icon={MapPin}>Via Roma 1</IconFact>
      </IconFacts>,
    );

    expect(screen.getByRole('list')).toHaveClass('flex', 'flex-wrap');
  });

  it('IconFact_Label_IsReadByAScreenReaderAndShownAsTheTooltipButNeverWrittenOnThePage', () => {
    const { container } = render(
      <IconFacts>
        <IconFact icon={MapPin} label="Indirizzo">
          Via Roma 1, Como
        </IconFact>
      </IconFacts>,
    );

    const item = screen.getByRole('listitem');
    expect(item).toHaveAttribute('title', 'Indirizzo');
    expect(item).toHaveTextContent('Indirizzo: Via Roma 1, Como');
    expect(item.querySelector('.sr-only')).toHaveTextContent('Indirizzo:');
    expect(container.querySelectorAll('span:not(.sr-only)')).not.toHaveLength(0);
  });

  it('IconFact_WithoutALabel_IsOnlyTheIconAndTheValue', () => {
    render(
      <IconFacts>
        <IconFact icon={Bath}>1 bagno</IconFact>
      </IconFacts>,
    );

    const item = screen.getByRole('listitem');
    expect(item).not.toHaveAttribute('title');
    expect(item).toHaveTextContent('1 bagno');
    expect(item.querySelector('.sr-only')).toBeNull();
    expect(item.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('IconFact_PropsOfTheElement_GoToTheItem', () => {
    render(
      <IconFacts>
        <IconFact icon={MapPin} data-testid="fact-address">
          Via Roma 1
        </IconFact>
      </IconFacts>,
    );

    expect(screen.getByTestId('fact-address').tagName).toBe('LI');
  });

  it('IconFacts_WithLabels_HaveNoAccessibilityViolation', async () => {
    const { container } = render(
      <IconFacts>
        <IconFact icon={MapPin} label="Indirizzo">
          Via Roma 1
        </IconFact>
        <IconFact icon={Bath}>1 bagno</IconFact>
      </IconFacts>,
    );

    await expectNoAxeViolations(container);
  });
});

describe('Figures', () => {
  afterEach(() => {
    cleanup();
  });

  it('Figure_Default_IsATermAndItsNumberInADefinitionList', () => {
    const { container } = render(
      <Figures className="grid-cols-2">
        <Figure icon={Banknote} label="Pulizia">
          70,00 CHF
        </Figure>
        <Figure icon={Bath} label="Deposito">
          0,00 CHF
        </Figure>
      </Figures>,
    );

    const list = container.querySelector('dl')!;
    expect(list).toHaveClass('grid-cols-2');
    expect(list.querySelectorAll('dt')).toHaveLength(2);
    expect(list.querySelector('dt')).toHaveTextContent('Pulizia');
    expect(list.querySelector('dd')).toHaveTextContent('70,00 CHF');
    expect(list.querySelector('dt svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('Figure_Size_SetsHowBigTheNumberIs', () => {
    const { container } = render(
      <Figures>
        <Figure icon={Banknote} label="Uno" size="lg">
          14
        </Figure>
        <Figure icon={Banknote} label="Due" size="sm">
          Notifica
        </Figure>
        <Figure icon={Banknote} label="Tre">
          3
        </Figure>
      </Figures>,
    );

    const [big, small, plain] = Array.from(container.querySelectorAll('dd'));
    expect(big).toHaveClass('text-2xl');
    expect(small).toHaveClass('text-sm');
    expect(plain).toHaveClass('text-base');
  });

  it('Figure_PropsOfTheElement_GoToTheWrapperOfTheTermAndItsNumber', () => {
    render(
      <Figures>
        <Figure icon={Banknote} label="Scadenza" data-testid="fact-deadline">
          24 ore
        </Figure>
      </Figures>,
    );

    expect(screen.getByTestId('fact-deadline')).toContainElement(screen.getByText('Scadenza'));
  });

  it('Figures_Several_HaveNoAccessibilityViolation', async () => {
    const { container } = render(
      <Figures>
        <Figure icon={Banknote} label="Pulizia">
          70,00 CHF
        </Figure>
      </Figures>,
    );

    await expectNoAxeViolations(container);
  });
});
