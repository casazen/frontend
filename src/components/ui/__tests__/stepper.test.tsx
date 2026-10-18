import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import { Stepper, type StepperStep } from '../stepper';

const STEPS: StepperStep[] = [
  { id: 'dati', label: 'Dati' },
  { id: 'immobile', label: 'Immobile' },
  { id: 'documenti', label: 'Documenti' },
  { id: 'riepilogo', label: 'Riepilogo' },
];

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(cleanup);

/** The extended version (from `md` up); the compact one is a different block of the same component. */
const extended = () => screen.getByRole('list', { name: 'Passaggi' });
const itemsOf = () => within(extended()).getAllByRole('listitem');

describe('Stepper extended', () => {
  it('Stepper_Steps_AreAnOrderedListWithOneItemEach', () => {
    render(<Stepper steps={STEPS} current={1} />);

    expect(extended().tagName).toBe('OL');
    const items = itemsOf();
    expect(items).toHaveLength(4);
    // Every item reads "name (state)"; the number is drawn for the eyes.
    expect(items[0]).toHaveTextContent('Dati (completato)');
    expect(items[1]).toHaveTextContent('Immobile (passo attuale)');
    expect(items[2]).toHaveTextContent('Documenti (da fare)');
    expect(items[3]).toHaveTextContent('Riepilogo (da fare)');
  });

  it('Stepper_Current_IsTheOnlyAriaCurrentStep', () => {
    render(<Stepper steps={STEPS} current={2} />);

    const current = extended().querySelectorAll('[aria-current]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('aria-current', 'step');
    expect(current[0]).toHaveTextContent('Documenti');
  });

  it('Stepper_States_AreSaidInWordsAndDoneStepsHaveACheck', () => {
    render(<Stepper steps={STEPS} current={2} />);

    const [done, , current, todo] = [itemsOf()[0], itemsOf()[1], itemsOf()[2], itemsOf()[3]];
    expect(within(done).getByText(/completato/)).toHaveClass('sr-only');
    expect(done.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(within(current).getByText(/passo attuale/)).toHaveClass('sr-only');
    expect(within(todo).getByText(/da fare/)).toHaveClass('sr-only');
    // To do and current steps show their number, never a check.
    expect(current.querySelector('svg')).toBeNull();
    expect(within(todo).getByText('4')).toBeInTheDocument();
  });

  it('Stepper_OnlyDoneSteps_AreButtonsAndTheyReportTheirIndex', () => {
    const onStepSelect = vi.fn();
    render(<Stepper steps={STEPS} current={2} onStepSelect={onStepSelect} />);

    const buttons = within(extended()).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    // The name is the label followed by the state (browsers put a space between them, jsdom does not).
    expect(buttons[1]).toHaveAccessibleName(/^Immobile ?\(completato\)$/);
    expect(buttons[0]).toHaveAccessibleName(/^Dati ?\(completato\)$/);

    fireEvent.click(buttons[1]);
    expect(onStepSelect).toHaveBeenCalledTimes(1);
    expect(onStepSelect).toHaveBeenCalledWith(1);
  });

  it('Stepper_CurrentAndTodoSteps_AreNotFocusable', () => {
    render(<Stepper steps={STEPS} current={1} onStepSelect={vi.fn()} />);

    const focusable = within(extended()).queryAllByRole('button');
    expect(focusable).toHaveLength(1);
    for (const button of focusable) {
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).not.toHaveAttribute('tabindex', '-1');
    }
    // The steps that are not done are plain blocks: no role, no tab stop.
    expect(itemsOf()[1].querySelector('[tabindex]')).toBeNull();
    expect(itemsOf()[3].querySelector('[tabindex]')).toBeNull();
  });

  it('Stepper_WithoutOnStepSelect_NoStepIsAButton', () => {
    render(<Stepper steps={STEPS} current={3} />);

    expect(within(extended()).queryAllByRole('button')).toHaveLength(0);
  });

  it('Stepper_FirstStep_HasNothingDone', () => {
    render(<Stepper steps={STEPS} current={0} onStepSelect={vi.fn()} />);

    expect(within(extended()).queryAllByRole('button')).toHaveLength(0);
    expect(itemsOf()[0]).toHaveTextContent('passo attuale');
  });

  it('Stepper_LastStep_HasEveryOtherStepDone', () => {
    render(<Stepper steps={STEPS} current={3} onStepSelect={vi.fn()} />);

    expect(within(extended()).getAllByRole('button')).toHaveLength(3);
  });

  it('Stepper_Label_CanBeReplaced', () => {
    render(<Stepper steps={STEPS} current={0} label="Attivazione dell'immobile" />);

    expect(screen.getByRole('list', { name: "Attivazione dell'immobile" })).toBeInTheDocument();
  });

  it('Stepper_LongLabel_TruncatesButKeepsTheFullNameAsTitle', () => {
    render(<Stepper steps={[{ id: 'a', label: 'Una denominazione molto lunga del passaggio' }]} current={0} />);

    const label = within(extended()).getByTitle('Una denominazione molto lunga del passaggio');
    expect(label).toHaveClass('truncate');
    expect(label).toHaveAttribute('title', 'Una denominazione molto lunga del passaggio');
  });
});

describe('Stepper compact', () => {
  it('Stepper_Compact_SaysWhichStepOfHowManyWithABar', () => {
    render(<Stepper steps={STEPS} current={1} />);

    expect(screen.getAllByText('Passo 2 di 4')).toHaveLength(1);
    const bar = screen.getByRole('progressbar', { name: 'Passo 2 di 4' });
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(bar).toHaveAttribute('aria-valuetext', 'Passo 2 di 4');
  });

  it('Stepper_Compact_ShowsTheNameOfTheCurrentStep', () => {
    render(<Stepper steps={STEPS} current={2} />);

    const compact = screen.getByText('Passo 3 di 4').parentElement as HTMLElement;
    expect(compact).toHaveTextContent('Documenti');
  });

  it('Stepper_Compact_ReachesTheFullBarOnTheLastStep', () => {
    render(<Stepper steps={STEPS} current={3} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('Stepper_TwoVersions_AreSwitchedByTheBreakpointNotShownTogether', () => {
    const { container } = render(<Stepper steps={STEPS} current={1} />);

    // Below `md` only the compact block is displayed, from `md` up only the list: `display: none` takes the other out of
    // the accessibility tree, so a screen reader reads one version.
    const compact = screen.getByRole('progressbar').closest('.md\\:hidden');
    expect(compact).not.toBeNull();
    expect(compact).toHaveClass('md:hidden');
    expect(extended()).toHaveClass('hidden', 'md:flex');
    expect(container.firstElementChild).toContainElement(compact as HTMLElement);
  });
});

describe('Stepper edge cases', () => {
  it('Stepper_CurrentOutOfRange_IsClamped', () => {
    const { rerender } = render(<Stepper steps={STEPS} current={99} />);
    expect(screen.getByText('Passo 4 di 4')).toBeInTheDocument();

    rerender(<Stepper steps={STEPS} current={-3} />);
    expect(screen.getByText('Passo 1 di 4')).toBeInTheDocument();

    rerender(<Stepper steps={STEPS} current={Number.NaN} />);
    expect(screen.getByText('Passo 1 di 4')).toBeInTheDocument();
  });

  it('Stepper_NoSteps_RendersNothing', () => {
    const { container } = render(<Stepper steps={[]} current={0} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('Stepper_English_TranslatesTheTexts', async () => {
    render(<Stepper steps={STEPS} current={1} />);

    await act(async () => {
      await i18n.changeLanguage('en');
    });

    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Steps' })).toBeInTheDocument();
    expect(screen.getByText(/current step/)).toBeInTheDocument();
  });

  it('Stepper_ClassName_GoesOnTheRoot', () => {
    const { container } = render(<Stepper steps={STEPS} current={0} className="mb-6" />);

    expect(container.firstElementChild).toHaveClass('mb-6');
  });

  it('Stepper_DoneStepsOnATouchScreen_AreAtLeast44PixelsTall', () => {
    render(<Stepper steps={STEPS} current={2} onStepSelect={vi.fn()} />);

    for (const button of within(extended()).getAllByRole('button')) {
      expect(button).toHaveClass('pointer-coarse:min-h-11');
    }
  });
});
