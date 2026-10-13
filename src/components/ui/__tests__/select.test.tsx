import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Field } from '../field';
import { Select } from '../select';

afterEach(cleanup);

function Options() {
  return (
    <>
      <option value="">Scegli un metodo</option>
      <option value="bank">Bonifico</option>
      <option value="card">Carta</option>
    </>
  );
}

describe('Select', () => {
  it('Select_Options_AreNativeOptionsOfANativeSelect', () => {
    render(
      <Select aria-label="Metodo">
        <Options />
      </Select>,
    );

    const select = screen.getByRole('combobox', { name: 'Metodo' });
    expect(select.tagName).toBe('SELECT');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Scegli un metodo', 'Bonifico', 'Carta']);
  });

  it('Select_Change_CallsOnChangeWithTheChosenValue', () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="Metodo" name="method" onChange={onChange}>
        <Options />
      </Select>,
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'card' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('combobox')).toHaveValue('card');
    expect(screen.getByRole('combobox')).toHaveAttribute('name', 'method');
  });

  it('Select_Ref_PointsAtTheSelectElement', () => {
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select aria-label="Metodo" ref={ref}>
        <Options />
      </Select>,
    );

    expect(ref.current).toBe(screen.getByRole('combobox'));
  });

  it('Select_Disabled_IsDisabledAndLooksIt', () => {
    render(
      <Select aria-label="Metodo" disabled>
        <Options />
      </Select>,
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
    expect(select).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50');
  });

  it('Select_Invalid_SetsAriaInvalidAndTheRedState', () => {
    const { rerender } = render(
      <Select aria-label="Metodo">
        <Options />
      </Select>,
    );
    expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-invalid');

    rerender(
      <Select aria-label="Metodo" invalid>
        <Options />
      </Select>,
    );
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select.className).toContain('aria-[invalid=true]:outline-destructive');
    expect(select.className).toContain('aria-[invalid=true]:border-destructive');
  });

  it('Select_InsideAField_GetsTheIdTheLabelAndTheError', () => {
    render(
      <Field label="Metodo di pagamento" error="Scegli un metodo">
        <Select>
          <Options />
        </Select>
      </Field>,
    );

    const select = screen.getByLabelText('Metodo di pagamento');
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Scegli un metodo');
  });

  it('Select_Arrow_IsDecorativeAndDoesNotCatchTheClick', () => {
    const { container } = render(
      <Select aria-label="Metodo">
        <Options />
      </Select>,
    );

    const arrow = container.querySelector('svg');
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveClass('pointer-events-none');
  });

  it('Select_Layout_ClassNameGoesOnTheSelectAndWrapperClassNameOnTheBox', () => {
    const { container } = render(
      <Select aria-label="Metodo" className="font-bold" wrapperClassName="w-48">
        <Options />
      </Select>,
    );

    expect(screen.getByRole('combobox')).toHaveClass('font-bold');
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass('w-48');
    expect(wrapper).not.toHaveClass('w-full');
    expect(wrapper).toContainElement(screen.getByRole('combobox'));
  });

  it('Select_Sizes_AreTheHeightOfAnInputAndTheCompactOne', () => {
    const { rerender } = render(
      <Select aria-label="Metodo">
        <Options />
      </Select>,
    );
    expect(screen.getByRole('combobox')).toHaveClass('h-10');

    rerender(
      <Select aria-label="Metodo" size="sm">
        <Options />
      </Select>,
    );
    expect(screen.getByRole('combobox')).toHaveClass('h-9');
  });

  it('Select_Look_IsTheOneOfInput', () => {
    render(
      <Select aria-label="Metodo">
        <Options />
      </Select>,
    );

    // Same border, background and focus ring as the Input, so a select next to an input does not look different.
    expect(screen.getByRole('combobox')).toHaveClass(
      'rounded-md',
      'border',
      'border-input',
      'bg-background',
      'text-sm',
      'focus-visible:ring-2',
      'focus-visible:ring-ring',
      'focus-visible:ring-offset-2',
    );
  });
});
