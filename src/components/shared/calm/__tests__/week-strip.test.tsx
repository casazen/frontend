import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { WeekStrip, type WeekStripDay } from '../week-strip';

// Monday 12 to Sunday 18 October 2026.
const WEEK: WeekStripDay[] = [
  { date: '2026-10-12', count: 2 },
  { date: '2026-10-13' },
  { date: '2026-10-14', count: 1 },
  { date: '2026-10-15', count: 0 },
  { date: '2026-10-16', count: 4 },
  { date: '2026-10-17' },
  { date: '2026-10-18', count: 3 },
];

const TODAY = '2026-10-14';

function Harness({ onValueChange, initial }: { onValueChange?: (date: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <WeekStrip
      days={WEEK}
      today={TODAY}
      value={value}
      onValueChange={(date) => {
        setValue(date);
        onValueChange?.(date);
      }}
    />
  );
}

const radios = () => screen.getAllByRole('radio');
const checked = () => radios().filter((radio) => radio.getAttribute('aria-checked') === 'true').map((radio) => radio.getAttribute('data-date'));

describe('WeekStrip (UI-16)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('WeekStrip_Default_IsANamedGroupOfSevenRadioButtonsWithTodayChosen', () => {
    render(<WeekStrip days={WEEK} today={TODAY} />);

    const group = screen.getByRole('radiogroup', { name: 'Giorni della settimana' });
    expect(within(group).getAllByRole('radio')).toHaveLength(7);
    expect(checked()).toEqual([TODAY]);
  });

  it('WeekStrip_EachDay_IsReadInFullWithTodayAndTheNumberOfThings', () => {
    render(<WeekStrip days={WEEK} today={TODAY} />);

    expect(radios().map((radio) => radio.getAttribute('aria-label'))).toEqual([
      'lunedì 12 ottobre, 2 elementi',
      'martedì 13 ottobre',
      'mercoledì 14 ottobre, oggi, 1 elemento',
      'giovedì 15 ottobre',
      'venerdì 16 ottobre, 4 elementi',
      'sabato 17 ottobre',
      'domenica 18 ottobre, 3 elementi',
    ]);
  });

  it('WeekStrip_InEnglish_ReadsTheDaysAndTheCountsInEnglish', async () => {
    await i18n.changeLanguage('en');
    render(<WeekStrip days={WEEK} today={TODAY} />);

    expect(screen.getByRole('radiogroup', { name: 'Days of the week' })).toBeInTheDocument();
    expect(radios()[0].getAttribute('aria-label')).toMatch(/^Monday.*12.*, 2 items$/);
    expect(radios()[2].getAttribute('aria-label')).toMatch(/, today, 1 item$/);
  });

  it('WeekStrip_DaysWithThings_HaveADotAndTheOthersHaveNone', () => {
    render(<WeekStrip days={WEEK} today={TODAY} />);

    const dots = radios().map((radio) => radio.lastElementChild!.className);
    // 2, none, 1, 0, 4, none, 3: a dot (a shape, not only a color) where the count is above zero.
    expect(dots.map((cls) => (cls.includes('bg-transparent') ? 'empty' : 'dot'))).toEqual(['dot', 'empty', 'dot', 'empty', 'dot', 'empty', 'dot']);
  });

  it('WeekStrip_ShownText_IsTheShortNameOfTheDayAndItsNumberAndTheNameInFullIsTheLabel', () => {
    render(<WeekStrip days={WEEK} today={TODAY} />);

    expect(radios()[0]).toHaveTextContent('lun12');
    for (const radio of radios()) {
      for (const part of Array.from(radio.children)) expect(part).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('WeekStrip_Today_HasARingAndTheChosenDayIsFilled', () => {
    render(<WeekStrip days={WEEK} today={TODAY} defaultValue="2026-10-16" />);

    const today = radios()[2];
    expect(today).toHaveAttribute('data-today', 'true');
    expect(today.children[1]).toHaveClass('ring-1');
    expect(radios()[4]).toHaveClass('bg-primary', 'text-primary-foreground');
    expect(today).not.toHaveClass('bg-primary');
    expect(radios()[0]).not.toHaveAttribute('data-today');
  });

  it('WeekStrip_Click_ChoosesTheDayAndReportsIt', () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} initial={TODAY} />);

    fireEvent.click(radios()[4]);

    expect(onValueChange).toHaveBeenCalledWith('2026-10-16');
    expect(checked()).toEqual(['2026-10-16']);
  });

  it('WeekStrip_NotControlled_RemembersTheChoiceItself', () => {
    render(<WeekStrip days={WEEK} today={TODAY} />);

    fireEvent.click(radios()[6]);

    expect(checked()).toEqual(['2026-10-18']);
  });

  it('WeekStrip_Controlled_FollowsTheValueOfThePageAndNotTheClick', () => {
    const onValueChange = vi.fn();
    render(<WeekStrip days={WEEK} today={TODAY} value="2026-10-13" onValueChange={onValueChange} />);

    fireEvent.click(radios()[6]);

    expect(onValueChange).toHaveBeenCalledWith('2026-10-18');
    expect(checked()).toEqual(['2026-10-13']);
  });

  it('WeekStrip_TabOrder_EntersOnTheChosenDayOnly', () => {
    render(<WeekStrip days={WEEK} today={TODAY} value="2026-10-16" />);

    expect(radios().map((radio) => radio.tabIndex)).toEqual([-1, -1, -1, -1, 0, -1, -1]);
  });

  it('WeekStrip_NoDayChosen_EntersOnTheFirstDay', () => {
    render(<WeekStrip days={WEEK} today="2026-11-30" />);

    expect(checked()).toEqual([]);
    expect(radios().map((radio) => radio.tabIndex)).toEqual([0, -1, -1, -1, -1, -1, -1]);
  });

  it('WeekStrip_ArrowRightAndDown_MoveTheFocusAndTheChoiceToTheNextDayAndGoRoundAtTheEnd', () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} initial="2026-10-17" />);

    radios()[5].focus();
    fireEvent.keyDown(radios()[5], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(radios()[6]);
    expect(checked()).toEqual(['2026-10-18']);

    fireEvent.keyDown(radios()[6], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(radios()[0]);
    expect(checked()).toEqual(['2026-10-12']);
    expect(onValueChange).toHaveBeenLastCalledWith('2026-10-12');
  });

  it('WeekStrip_ArrowLeftAndUp_MoveBackAndGoRoundAtTheStart', () => {
    render(<Harness initial="2026-10-13" />);

    radios()[1].focus();
    fireEvent.keyDown(radios()[1], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(radios()[0]);
    fireEvent.keyDown(radios()[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(radios()[6]);
    expect(checked()).toEqual(['2026-10-18']);
  });

  it('WeekStrip_HomeAndEnd_GoToTheFirstAndTheLastDay', () => {
    render(<Harness initial="2026-10-15" />);

    radios()[3].focus();
    fireEvent.keyDown(radios()[3], { key: 'End' });
    expect(document.activeElement).toBe(radios()[6]);
    fireEvent.keyDown(radios()[6], { key: 'Home' });
    expect(document.activeElement).toBe(radios()[0]);
    expect(checked()).toEqual(['2026-10-12']);
  });

  it('WeekStrip_OtherKeys_ChangeNothing', () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} initial={TODAY} />);

    radios()[2].focus();
    fireEvent.keyDown(radios()[2], { key: 'a' });
    fireEvent.keyDown(radios()[2], { key: 'Tab' });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(radios()[2]);
  });

  it('WeekStrip_EveryDay_IsATargetOfAtLeast44PxHigh', () => {
    render(<WeekStrip days={WEEK} today={TODAY} />);

    for (const radio of radios()) expect(radio).toHaveClass('min-h-14');
    expect(screen.getByRole('radiogroup')).toHaveClass('grid-cols-7');
  });

  it('WeekStrip_NoDays_RendersNothing', () => {
    const { container } = render(<WeekStrip days={[]} today={TODAY} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('WeekStrip_CustomLabelAndProps_GoToTheGroup', () => {
    render(<WeekStrip days={WEEK} today={TODAY} label="Disponibilità della settimana" data-testid="week" />);

    expect(screen.getByTestId('week')).toBe(screen.getByRole('radiogroup', { name: 'Disponibilità della settimana' }));
  });

  it('WeekStrip_Everything_HasNoAxeViolations', async () => {
    const { container } = render(<Harness initial={TODAY} />);

    await expectNoAxeViolations(container);
  });
});
