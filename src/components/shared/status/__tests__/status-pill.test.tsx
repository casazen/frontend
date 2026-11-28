import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CheckCircle2, CircleOff } from 'lucide-react';
import { expectNoAxeViolations } from '@/test/axe';
import { StatusPill } from '../status-pill';
import { STATUS_TONE_CLASSES } from '../status-view';

describe('StatusPill', () => {
  afterEach(() => {
    cleanup();
  });

  it('StatusPill_Default_IsAnIconAndTheWordsOfTheCaller', () => {
    const { container } = render(<StatusPill icon={CheckCircle2}>Attivi</StatusPill>);

    expect(container.textContent).toBe('Attivi');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('StatusPill_Tone_UsesTheSoftColoursOfThatTone', () => {
    render(
      <>
        <StatusPill tone="success" icon={CheckCircle2}>
          Attivi
        </StatusPill>
        <StatusPill icon={CircleOff}>Disattivati</StatusPill>
      </>,
    );

    for (const className of STATUS_TONE_CLASSES.success.split(' ')) expect(screen.getByText('Attivi').parentElement).toHaveClass(className);
    for (const className of STATUS_TONE_CLASSES.neutral.split(' ')) expect(screen.getByText('Disattivati').parentElement).toHaveClass(className);
  });

  it('StatusPill_PropsOfTheElement_GoToTheSpanSoAPageCanTestAndStyleIt', () => {
    render(
      <StatusPill icon={CheckCircle2} data-testid="state" className="self-start">
        Verificato
      </StatusPill>,
    );

    const pill = screen.getByTestId('state');
    expect(pill.tagName).toBe('SPAN');
    expect(pill).toHaveClass('self-start', 'rounded-full');
  });

  it('StatusPill_LongWords_WrapInsteadOfPushingTheLayout', () => {
    render(<StatusPill icon={CheckCircle2}>Non previsto fuori dall'Italia per questa struttura</StatusPill>);

    expect(screen.getByText(/Non previsto/)).toHaveClass('break-words', 'min-w-0');
    expect(screen.getByText(/Non previsto/).parentElement).toHaveClass('max-w-full');
  });

  it('StatusPill_InAParagraph_HasNoAccessibilityViolation', async () => {
    const { container } = render(
      <p>
        Stato: <StatusPill icon={CheckCircle2}>Attivi</StatusPill>
      </p>,
    );

    await expectNoAxeViolations(container);
  });
});
