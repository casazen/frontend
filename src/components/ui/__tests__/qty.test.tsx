import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { Qty, type QtyProps } from '../qty';

function Harness({ initial = 2, onChange, ...props }: { initial?: number; onChange?: (value: number) => void } & Partial<QtyProps>) {
  const [value, setValue] = useState(initial);
  return (
    <Qty
      label="Adulti"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      {...props}
    />
  );
}

const decrease = () => screen.getByRole('button', { name: 'Diminuisci Adulti' });
const increase = () => screen.getByRole('button', { name: 'Aumenta Adulti' });

describe('Qty (UI-07)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  describe('the buttons', () => {
    it('Qty_Default_IsANamedGroupWithTwoNamedButtonsAndTheValueBetweenThem', () => {
      render(<Harness />);

      const group = screen.getByRole('group', { name: 'Adulti' });
      expect(group).toContainElement(decrease());
      expect(group).toContainElement(increase());
      expect(screen.getByRole('status')).toHaveTextContent('2');
    });

    it('Qty_Buttons_AreOfTheSizeOfAFinger', () => {
      render(<Harness />);

      expect(decrease()).toHaveClass('h-11', 'w-11');
      expect(increase()).toHaveClass('h-11', 'w-11');
      expect(decrease()).toHaveAttribute('type', 'button');
    });

    it('Qty_PlusAndMinus_ChangeTheValueByOne', () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);

      fireEvent.click(increase());
      expect(onChange).toHaveBeenLastCalledWith(3);
      fireEvent.click(decrease());
      fireEvent.click(decrease());
      expect(onChange).toHaveBeenLastCalledWith(1);
    });

    it('Qty_Step_IsWhatEachPressAdds', () => {
      const onChange = vi.fn();
      render(<Harness initial={10} step={5} min={0} max={40} onChange={onChange} />);

      fireEvent.click(increase());

      expect(onChange).toHaveBeenLastCalledWith(15);
    });

    it('Qty_English_NamesTheButtonsInEnglish', async () => {
      await i18n.changeLanguage('en');
      render(<Harness label="Adults" />);

      expect(screen.getByRole('button', { name: 'Decrease Adults' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Increase Adults' })).toBeInTheDocument();
    });
  });

  describe('the limits', () => {
    it('Qty_AtTheMinimum_MinusIsDimmedAndDoesNothing', () => {
      const onChange = vi.fn();
      render(<Harness initial={1} min={1} onChange={onChange} />);

      expect(decrease()).toHaveAttribute('aria-disabled', 'true');
      expect(increase()).not.toHaveAttribute('aria-disabled');
      fireEvent.click(decrease());

      expect(onChange).not.toHaveBeenCalled();
    });

    it('Qty_AtTheMaximum_PlusIsDimmedAndDoesNothing', () => {
      const onChange = vi.fn();
      render(<Harness initial={4} max={4} onChange={onChange} />);

      expect(increase()).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(increase());

      expect(onChange).not.toHaveBeenCalled();
    });

    it('Qty_AtALimit_TheButtonStaysFocusableSoTheFocusDoesNotFallOffIt', () => {
      render(<Harness initial={3} max={4} />);
      increase().focus();

      fireEvent.click(increase());

      expect(increase()).toHaveAttribute('aria-disabled', 'true');
      expect(increase()).not.toBeDisabled();
      expect(increase()).toHaveFocus();
    });

    it('Qty_ValueOutsideTheLimits_IsShownWithinThem', () => {
      render(<Qty label="Adulti" value={42} min={1} max={10} onChange={() => undefined} />);

      expect(screen.getByRole('status')).toHaveTextContent('10');
    });

    it('Qty_ValueThatIsNotANumber_IsShownAsTheMinimum', () => {
      render(<Qty label="Adulti" value={Number.NaN} min={1} max={10} onChange={() => undefined} />);

      expect(screen.getByRole('status')).toHaveTextContent('1');
    });
  });

  describe('the keyboard', () => {
    it('Qty_ArrowUpAndDown_RaiseAndLowerTheValueFromEitherButton', () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      increase().focus();

      fireEvent.keyDown(increase(), { key: 'ArrowUp' });
      expect(onChange).toHaveBeenLastCalledWith(3);
      fireEvent.keyDown(decrease(), { key: 'ArrowDown' });
      expect(onChange).toHaveBeenLastCalledWith(2);
    });

    it('Qty_PageUpAndPageDown_MoveByTenSteps', () => {
      const onChange = vi.fn();
      render(<Harness initial={20} max={50} onChange={onChange} />);

      fireEvent.keyDown(increase(), { key: 'PageUp' });
      expect(onChange).toHaveBeenLastCalledWith(30);
      fireEvent.keyDown(increase(), { key: 'PageDown' });
      expect(onChange).toHaveBeenLastCalledWith(20);
    });

    it('Qty_HomeAndEnd_GoToTheLimits', () => {
      const onChange = vi.fn();
      render(<Harness initial={5} min={1} max={8} onChange={onChange} />);

      fireEvent.keyDown(increase(), { key: 'End' });
      expect(onChange).toHaveBeenLastCalledWith(8);
      fireEvent.keyDown(increase(), { key: 'Home' });
      expect(onChange).toHaveBeenLastCalledWith(1);
    });

    it('Qty_OtherKeys_AreLeftAlone', () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);

      const notPrevented = fireEvent.keyDown(increase(), { key: 'a' });

      expect(notPrevented).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('Qty_ArrowsAtTheLimit_StayWithinIt', () => {
      const onChange = vi.fn();
      render(<Harness initial={4} max={4} onChange={onChange} />);

      fireEvent.keyDown(increase(), { key: 'ArrowUp' });
      fireEvent.keyDown(increase(), { key: 'PageUp' });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('the value is read out', () => {
    it('Qty_Value_IsALiveRegionThatSaysWhatItCounts', () => {
      render(<Harness />);

      const live = screen.getByRole('status');
      expect(live).toHaveAttribute('aria-live', 'polite');
      expect(live).toHaveAttribute('aria-atomic', 'true');
      expect(live).toHaveTextContent('Adulti: 2');
      fireEvent.click(increase());
      expect(live).toHaveTextContent('Adulti: 3');
    });

    it('Qty_ValueText_ReplacesTheDefaultSentence', () => {
      render(<Harness valueText={(value) => `${value} ospiti adulti`} />);

      expect(screen.getByRole('status')).toHaveTextContent('2 ospiti adulti');
    });

    it('Qty_TheNumberOnTheScreen_IsNotReadTwice', () => {
      render(<Harness />);

      expect(screen.getByText('2', { selector: 'span' })).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('in a form and when disabled', () => {
    it('Qty_WithAName_PutsItsValueInTheForm', () => {
      const { container } = render(
        <form>
          <Harness name="adults" initial={3} />
        </form>,
      );

      const hidden = container.querySelector('input[type="hidden"][name="adults"]') as HTMLInputElement;
      expect(hidden.value).toBe('3');
      fireEvent.click(increase());
      expect(hidden.value).toBe('4');
    });

    it('Qty_WithoutAName_PutsNothingInTheForm', () => {
      const { container } = render(<Harness />);

      expect(container.querySelector('input')).toBeNull();
    });

    it('Qty_Disabled_ChangesNothingByMouseOrKeyboard', () => {
      const onChange = vi.fn();
      render(<Harness disabled onChange={onChange} />);

      fireEvent.click(increase());
      fireEvent.click(decrease());
      fireEvent.keyDown(increase(), { key: 'ArrowUp' });

      expect(onChange).not.toHaveBeenCalled();
      expect(increase()).toHaveAttribute('aria-disabled', 'true');
      expect(decrease()).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('accessibility', () => {
    it('Qty_HasNoAxeViolations', async () => {
      const { container } = render(<Harness />);

      await expectNoAxeViolations(container);
    });

    it('Qty_AtALimitAndDisabled_HasNoAxeViolations', async () => {
      const { container } = render(<Harness initial={1} min={1} disabled />);

      await expectNoAxeViolations(container);
    });
  });
});
