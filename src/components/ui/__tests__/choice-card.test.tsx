import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Building2, Home } from 'lucide-react';
import { expectNoAxeViolations } from '@/test/axe';
import { ChoiceCard, ChoiceGroup } from '../choice-card';

function Regime({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('cedolare');
  return (
    <ChoiceGroup legend="Quale regime fiscale?">
      <ChoiceCard
        name="regime"
        value="cedolare"
        title="Cedolare secca"
        description="Imposta fissa, niente registro"
        icon={Home}
        checked={value === 'cedolare'}
        onChange={() => {
          setValue('cedolare');
          onChange?.('cedolare');
        }}
      />
      <ChoiceCard
        name="regime"
        value="ordinario"
        title="Regime ordinario"
        description="IRPEF sul canone"
        icon={Building2}
        checked={value === 'ordinario'}
        onChange={() => {
          setValue('ordinario');
          onChange?.('ordinario');
        }}
      />
      <ChoiceCard name="regime" value="concordato" title="Canone concordato" disabled />
    </ChoiceGroup>
  );
}

describe('ChoiceCard (UI-07)', () => {
  afterEach(() => {
    cleanup();
  });

  describe('radio cards', () => {
    it('ChoiceCard_Radio_IsANativeRadioInAGroupWithAQuestion', () => {
      render(<Regime />);

      const group = screen.getByRole('group', { name: 'Quale regime fiscale?' });
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
      for (const radio of radios) {
        expect(radio.tagName).toBe('INPUT');
        expect(radio).toHaveAttribute('type', 'radio');
        expect(group).toContainElement(radio);
      }
    });

    it('ChoiceCard_Card_IsTheLabelOfItsInputSoTheNameCarriesTheTitleAndTheDescription', () => {
      render(<Regime />);

      expect(screen.getByRole('radio', { name: /Cedolare secca/ })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Imposta fissa, niente registro/ })).toBeChecked();
      expect(screen.getByLabelText(/Regime ordinario/)).toBe(screen.getByRole('radio', { name: /Regime ordinario/ }));
    });

    it('ChoiceCard_ClickOnTheCard_ChoosesIt', () => {
      const onChange = vi.fn();
      render(<Regime onChange={onChange} />);

      fireEvent.click(screen.getByText('Regime ordinario'));

      expect(onChange).toHaveBeenCalledWith('ordinario');
      expect(screen.getByRole('radio', { name: /Regime ordinario/ })).toBeChecked();
      expect(screen.getByRole('radio', { name: /Cedolare secca/ })).not.toBeChecked();
    });

    it('ChoiceCard_Chosen_ShowsItselfByMoreThanColor', () => {
      render(<Regime />);

      const card = screen.getByRole('radio', { name: /Cedolare secca/ }).closest('label')!;
      // A thick outline and a tinted background, when the radio inside is checked...
      expect(card).toHaveClass('has-checked:ring-2', 'has-checked:ring-primary', 'has-checked:bg-primary/5');
      // ...and a tick in the corner: a disc for one choice, empty until it is chosen.
      const tick = card.querySelector('span[aria-hidden="true"].absolute');
      expect(tick).toHaveClass('rounded-full', 'peer-checked:bg-primary', 'peer-checked:text-primary-foreground');
      expect(tick?.querySelector('svg')).toBeInTheDocument();
    });

    it('ChoiceCard_Focus_HasItsOwnOutlineForTheKeyboard', () => {
      render(<Regime />);

      const card = screen.getByRole('radio', { name: /Cedolare secca/ }).closest('label')!;
      expect(card).toHaveClass('has-focus-visible:outline-2', 'has-focus-visible:outline-ring');
    });

    it('ChoiceCard_Disabled_CannotBeChosenAndLooksIt', () => {
      const onChange = vi.fn();
      render(<Regime onChange={onChange} />);

      const radio = screen.getByRole('radio', { name: /Canone concordato/ });
      expect(radio).toBeDisabled();
      expect(radio.closest('label')).toHaveClass('has-disabled:cursor-not-allowed', 'has-disabled:opacity-60');
    });

    it('ChoiceCard_Icon_IsDecorativeAndTheTitleAndDescriptionAreText', () => {
      render(<Regime />);

      const card = screen.getByRole('radio', { name: /Cedolare secca/ }).closest('label')!;
      expect(card.querySelector('svg')).toBeInTheDocument();
      for (const svg of card.querySelectorAll('svg')) expect(svg.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(card).toHaveTextContent('Cedolare secca');
      expect(card).toHaveTextContent('Imposta fissa, niente registro');
    });

    it('ChoiceCard_Input_IsHiddenFromTheEyeNotFromTheKeyboard', () => {
      render(<Regime />);

      const radio = screen.getByRole('radio', { name: /Cedolare secca/ });
      expect(radio).toHaveClass('sr-only', 'peer');
      radio.focus();
      expect(radio).toHaveFocus();
    });
  });

  describe('checkbox cards', () => {
    it('ChoiceCard_Checkbox_ChoosesSeveralAtOnce', () => {
      const onChange = vi.fn();
      render(
        <ChoiceGroup legend="Servizi">
          <ChoiceCard type="checkbox" name="services" value="cleaning" title="Pulizie" onChange={(e) => onChange(e.target.checked)} />
          <ChoiceCard type="checkbox" name="services" value="laundry" title="Lavanderia" defaultChecked />
        </ChoiceGroup>,
      );

      expect(screen.getAllByRole('checkbox')).toHaveLength(2);
      expect(screen.getByRole('checkbox', { name: 'Lavanderia' })).toBeChecked();
      fireEvent.click(screen.getByRole('checkbox', { name: 'Pulizie' }));
      expect(onChange).toHaveBeenCalledWith(true);
      expect(screen.getByRole('checkbox', { name: 'Lavanderia' })).toBeChecked();
    });

    it('ChoiceCard_Checkbox_HasASquareTickInsteadOfADisc', () => {
      render(<ChoiceCard type="checkbox" name="x" value="a" title="Pulizie" />);

      const tick = screen.getByRole('checkbox').closest('label')!.querySelector('span[aria-hidden="true"].absolute');
      expect(tick).toHaveClass('rounded-md');
      expect(tick).not.toHaveClass('rounded-full');
    });
  });

  describe('with a form', () => {
    it('ChoiceCard_WithReactHookForm_RegistersLikeAnyInput', () => {
      const submitted = vi.fn();
      function Form() {
        const { register, handleSubmit } = useForm({ defaultValues: { regime: 'cedolare' } });
        return (
          <form onSubmit={handleSubmit((values) => submitted(values))}>
            <ChoiceGroup legend="Regime">
              <ChoiceCard title="Cedolare" value="cedolare" {...register('regime')} />
              <ChoiceCard title="Ordinario" value="ordinario" {...register('regime')} />
            </ChoiceGroup>
            <button type="submit">Salva</button>
          </form>
        );
      }
      render(<Form />);

      fireEvent.click(screen.getByLabelText('Ordinario'));
      fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

      return vi.waitFor(() => expect(submitted).toHaveBeenCalledWith({ regime: 'ordinario' }));
    });

    it('ChoiceCard_Ref_ReachesTheInput', () => {
      let input: HTMLInputElement | null = null;
      function WithRef() {
        const ref = useRef<HTMLInputElement>(null);
        return (
          <>
            <ChoiceCard ref={ref} name="x" value="a" title="Una" />
            <button
              type="button"
              onClick={() => {
                input = ref.current;
              }}
            >
              leggi
            </button>
          </>
        );
      }
      render(<WithRef />);

      fireEvent.click(screen.getByRole('button', { name: 'leggi' }));

      expect(input).toBe(screen.getByRole('radio'));
    });
  });

  describe('ChoiceGroup', () => {
    it('ChoiceGroup_QuestionIsHiddenByDefaultAndVisibleOnRequest', () => {
      const { rerender } = render(
        <ChoiceGroup legend="Quale regime?">
          <ChoiceCard name="x" value="a" title="A" />
        </ChoiceGroup>,
      );
      expect(screen.getByText('Quale regime?')).toHaveClass('sr-only');

      rerender(
        <ChoiceGroup legend="Quale regime?" legendVisible>
          <ChoiceCard name="x" value="a" title="A" />
        </ChoiceGroup>,
      );
      expect(screen.getByText('Quale regime?')).not.toHaveClass('sr-only');
    });

    it('ChoiceGroup_Cards_FillTheRowAndWrapWithAMinimumWidthOfTheCallersChoice', () => {
      render(
        <ChoiceGroup legend="Q" minCardWidth={14}>
          <ChoiceCard name="x" value="a" title="A" />
        </ChoiceGroup>,
      );

      const grid = screen.getByRole('group').lastElementChild as HTMLElement;
      expect(grid).toHaveClass('grid');
      expect(grid.style.getPropertyValue('--choice-min')).toBe('14rem');
    });

    it('ChoiceGroup_LongTitles_BreakInsteadOfWideningThePage', () => {
      render(
        <ChoiceGroup legend="Q">
          <ChoiceCard name="x" value="a" title="Un titolo lunghissimo senzaspaziincuipuòspezzarsiilconcetto" />
        </ChoiceGroup>,
      );

      expect(screen.getByRole('radio').closest('label')).toHaveClass('min-w-0');
      expect(screen.getByText(/Un titolo lunghissimo/)).toHaveClass('break-words');
    });
  });

  describe('accessibility', () => {
    it('ChoiceCard_RadioGroup_HasNoAxeViolations', async () => {
      const { container } = render(<Regime />);

      await expectNoAxeViolations(container);
    });

    it('ChoiceCard_CheckboxGroup_HasNoAxeViolations', async () => {
      const { container } = render(
        <ChoiceGroup legend="Servizi" legendVisible>
          <ChoiceCard type="checkbox" name="s" value="1" title="Pulizie" description="Dopo ogni soggiorno" />
          <ChoiceCard type="checkbox" name="s" value="2" title="Lavanderia" defaultChecked />
        </ChoiceGroup>,
      );

      await expectNoAxeViolations(container);
    });
  });
});
