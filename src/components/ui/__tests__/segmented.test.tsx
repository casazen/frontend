import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { LayoutList, CalendarDays } from 'lucide-react';
import { expectNoAxeViolations } from '@/test/axe';
import { Segmented, type SegmentedOption } from '../segmented';

const OPTIONS: SegmentedOption<'all' | 'active' | 'paused'>[] = [
  { value: 'all', label: 'Tutti (5)', testId: 'filter-all' },
  { value: 'active', label: 'Attivi (3)', testId: 'filter-active' },
  { value: 'paused', label: 'In pausa (2)', testId: 'filter-paused' },
];

function Harness({ onValueChange, initial = 'all' }: { onValueChange?: (value: string) => void; initial?: 'all' | 'active' | 'paused' }) {
  const [value, setValue] = useState(initial);
  return (
    <Segmented
      label="Stato degli immobili"
      options={OPTIONS}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
    />
  );
}

describe('Segmented (UI-07)', () => {
  afterEach(() => {
    cleanup();
  });

  it('Segmented_Default_IsANamedGroupOfButtonsWithTheCurrentOnePressed', () => {
    render(<Harness />);

    const group = screen.getByRole('group', { name: 'Stato degli immobili' });
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Tutti (5)', 'Attivi (3)', 'In pausa (2)']);
    expect(group).toContainElement(buttons[0]);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    for (const button of buttons) expect(button).toHaveAttribute('type', 'button');
  });

  it('Segmented_Click_PressesTheOtherButtonAndReportsTheValue', () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'In pausa (2)' }));

    expect(onValueChange).toHaveBeenCalledWith('paused');
    expect(screen.getByRole('button', { name: 'In pausa (2)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Tutti (5)' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Segmented_ClickOnThePressedOne_ChangesNothing', () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} initial="active" />);

    fireEvent.click(screen.getByRole('button', { name: 'Attivi (3)' }));

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Attivi (3)' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Segmented_PressedButton_LooksDifferentNotOnlyByColor', () => {
    render(<Harness />);

    // The raised white tile and the shadow, as well as the darker text.
    expect(screen.getByTestId('filter-all')).toHaveClass('bg-background', 'shadow-sm', 'text-foreground');
    expect(screen.getByTestId('filter-active')).toHaveClass('text-foreground/65');
    expect(screen.getByTestId('filter-active')).not.toHaveClass('shadow-sm');
  });

  it('Segmented_TestIds_ArePassedToTheButtons', () => {
    render(<Harness />);

    expect(screen.getByTestId('filter-paused')).toHaveTextContent('In pausa (2)');
  });

  it('Segmented_Buttons_AreAtLeast44PxTallForAFinger', () => {
    render(<Harness />);

    expect(screen.getByTestId('filter-all')).toHaveClass('pointer-coarse:min-h-11');
  });

  // A choice that is only an icon (the list / columns switch of the unified list, UI-14) is a square the finger can hit.
  it('Segmented_Buttons_AreAtLeast44PxWideForAFinger', () => {
    render(<Harness />);

    expect(screen.getByTestId('filter-all')).toHaveClass('pointer-coarse:min-w-11');
  });

  it('Segmented_Keyboard_EveryButtonIsInTheTabOrder', () => {
    render(<Harness />);

    for (const button of screen.getAllByRole('button')) {
      button.focus();
      expect(button).toHaveFocus();
      expect(button).not.toHaveAttribute('tabindex', '-1');
    }
  });

  it('Segmented_DisabledOption_CannotBePressed', () => {
    const onValueChange = vi.fn();
    render(
      <Segmented
        label="Vista"
        options={[
          { value: 'list', label: 'Elenco' },
          { value: 'calendar', label: 'Calendario', disabled: true },
        ]}
        value="list"
        onValueChange={onValueChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Calendario' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Calendario' }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('Segmented_WithIcons_TheIconsAreDecorative', () => {
    render(
      <Segmented
        label="Vista"
        options={[
          { value: 'list', label: 'Elenco', icon: LayoutList },
          { value: 'calendar', label: 'Calendario', icon: CalendarDays },
        ]}
        value="list"
        onValueChange={() => undefined}
      />,
    );

    for (const button of screen.getAllByRole('button')) {
      expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
    expect(screen.getByRole('button', { name: 'Elenco' })).toBeInTheDocument();
  });

  it('Segmented_OnANarrowScreen_ScrollsInsideItselfAndNeverWidensThePage', () => {
    render(<Harness />);

    expect(screen.getByRole('group')).toHaveClass('max-w-full', 'overflow-x-auto');
  });

  it('Segmented_HasNoAxeViolations', async () => {
    const { container } = render(<Harness />);

    await expectNoAxeViolations(container);
  });
});
