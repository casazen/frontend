import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import i18n from '@/i18n/config';
import { freezeClock } from '@/test/clock';
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

// Monday 19 to Sunday 25 October 2026.
const NEXT_WEEK: WeekStripDay[] = Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-${19 + index}` }));

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
    vi.restoreAllMocks();
    vi.useRealTimers();
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

  it('WeekStrip_Colors_AreTheOnesOfTheSystemWhenTheUserForcesColors', () => {
    render(<WeekStrip days={WEEK} today={TODAY} defaultValue="2026-10-16" />);

    // In forced-colors mode the browser drops backgrounds and shadows: the chosen day, the dot and the ring keep a cue.
    expect(radios()[4]).toHaveClass('forced-colors:bg-[Highlight]', 'forced-colors:text-[HighlightText]');
    expect(radios()[2].children[1]).toHaveClass('forced-colors:outline-1');
    expect(radios()[0].lastElementChild).toHaveClass('forced-colors:bg-[CanvasText]');
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

  it('WeekStrip_ControlledWithADayThatIsNotAmongTheDays_ChoosesNoneAndEntersOnTheFirstDay', () => {
    render(<WeekStrip days={WEEK} today={TODAY} value="2026-11-30" />);

    expect(checked()).toEqual([]);
    expect(radios().map((radio) => radio.tabIndex)).toEqual([0, -1, -1, -1, -1, -1, -1]);
  });

  it('WeekStrip_NewDays_FindTheirOwnDefaultInsteadOfADayThatIsNoLongerThere', () => {
    freezeClock('2026-10-14T10:00:00Z');
    const { rerender } = render(<WeekStrip days={WEEK} />);
    fireEvent.click(radios()[4]);
    expect(checked()).toEqual(['2026-10-16']);

    // The next week: the chosen day is gone and today is not in it: nothing is chosen, the Tab order enters on the first day.
    rerender(<WeekStrip days={NEXT_WEEK} />);
    expect(checked()).toEqual([]);
    expect(radios().map((radio) => radio.tabIndex)).toEqual([0, -1, -1, -1, -1, -1, -1]);

    // Back to the first week: the choice the person made there is back with it.
    rerender(<WeekStrip days={WEEK} />);
    expect(checked()).toEqual(['2026-10-16']);
  });

  it('WeekStrip_FirstRenderedWithoutDaysAndThenWithThem_ChoosesToday', () => {
    const { rerender } = render(<WeekStrip days={[]} today={TODAY} />);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();

    rerender(<WeekStrip days={WEEK} today={TODAY} />);

    expect(checked()).toEqual([TODAY]);
  });

  it('WeekStrip_DefaultValue_IsChosenUntilThePersonChoosesAndWinsOverToday', () => {
    render(<WeekStrip days={WEEK} today={TODAY} defaultValue="2026-10-17" />);
    expect(checked()).toEqual(['2026-10-17']);

    fireEvent.click(radios()[0]);

    expect(checked()).toEqual(['2026-10-12']);
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

  it.each([{ altKey: true }, { ctrlKey: true }, { metaKey: true }])('WeekStrip_ArrowWith%j_IsTheBrowsersAndChangesNothing', (modifier) => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} initial={TODAY} />);

    radios()[2].focus();
    // `fireEvent` says whether the event was left alone (true) or its default was prevented (false).
    const left = fireEvent.keyDown(radios()[2], { key: 'ArrowLeft', ...modifier });
    const endLeft = fireEvent.keyDown(radios()[2], { key: 'End', ...modifier });

    expect(left).toBe(true);
    expect(endLeft).toBe(true);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(radios()[2]);
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

  it('WeekStrip_OnKeyDownOfTheCaller_IsCalledAndTheKeyboardOfTheStripStillWorks', () => {
    const onKeyDown = vi.fn();
    render(<WeekStrip days={WEEK} today={TODAY} onKeyDown={onKeyDown} />);

    radios()[2].focus();
    fireEvent.keyDown(radios()[2], { key: 'ArrowRight' });

    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(radios()[3]);
    expect(checked()).toEqual(['2026-10-15']);
  });

  it('WeekStrip_OnKeyDownThatPreventsTheDefault_KeepsTheStripWhereItIs', () => {
    render(<WeekStrip days={WEEK} today={TODAY} onKeyDown={(event) => event.preventDefault()} />);

    radios()[2].focus();
    fireEvent.keyDown(radios()[2], { key: 'ArrowRight' });

    expect(checked()).toEqual([TODAY]);
  });

  it('WeekStrip_ExtraProps_GoToTheGroupButCannotTakeItsRoleOrNameAway', () => {
    render(<WeekStrip days={WEEK} today={TODAY} role="group" aria-label={undefined} data-testid="week" className="mt-4" />);

    const group = screen.getByRole('radiogroup', { name: 'Giorni della settimana' });
    expect(screen.getByTestId('week')).toBe(group);
    expect(group).toHaveClass('mt-4', 'grid-cols-7');
  });

  it('WeekStrip_DayWrittenWithATime_IsReadAsTheDayItStartsWith', () => {
    render(<WeekStrip days={[{ date: '2026-10-14T00:00:00Z', count: 1 }, { date: '2026-10-15T00:00:00Z' }]} today={TODAY} />);

    expect(radios().map((radio) => radio.getAttribute('aria-label'))).toEqual(['mercoledì 14 ottobre, oggi, 1 elemento', 'giovedì 15 ottobre']);
    expect(radios()[0]).toHaveTextContent('mer14');
  });

  it('WeekStrip_DaysWrittenWithATime_AreChosenAndReportedAsTheirCalendarDayEverywhere', () => {
    const onValueChange = vi.fn();
    const days = [{ date: '2026-10-14T00:00:00Z' }, { date: '2026-10-15T00:00:00Z' }, { date: '2026-10-16T00:00:00Z' }];
    const { rerender } = render(<WeekStrip days={days} today={TODAY} onValueChange={onValueChange} />);
    // Today is among them: it is chosen by default, although the day is written with a time.
    expect(checked()).toEqual(['2026-10-14']);

    // The page speaks in calendar days: `value` and `defaultValue` find the day, and the strip gives back the calendar day.
    rerender(<WeekStrip days={days} today={TODAY} value="2026-10-15" onValueChange={onValueChange} />);
    expect(checked()).toEqual(['2026-10-15']);
    expect(radios().map((radio) => radio.tabIndex)).toEqual([-1, 0, -1]);
    fireEvent.click(radios()[2]);
    expect(onValueChange).toHaveBeenLastCalledWith('2026-10-16');

    rerender(<WeekStrip days={days} today="2026-11-30" defaultValue="2026-10-16" />);
    expect(checked()).toEqual(['2026-10-16']);
  });

  it('WeekStrip_DayGivenAsAnInstant_IsTheDayItFallsOnInRome', () => {
    // 22:30 UTC of the 13th is half past midnight of the 14th in Rome.
    render(<WeekStrip days={[{ date: '2026-10-13T22:30:00Z' }, { date: '2026-10-15T00:00:00Z' }]} today={TODAY} />);

    expect(radios().map((radio) => radio.getAttribute('data-date'))).toEqual(['2026-10-14', '2026-10-15']);
    expect(radios()[0].getAttribute('aria-label')).toBe('mercoledì 14 ottobre, oggi');
    expect(checked()).toEqual(['2026-10-14']);
  });

  it('WeekStrip_DayThatCannotBeRead_IsStillThereWithItsOwnTextAndTheDeveloperIsTold', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<WeekStrip days={[{ date: 'giovedì' }, ...WEEK.slice(0, 2)]} today={TODAY} />);

    expect(radios()[0]).toHaveAttribute('aria-label', 'giovedì');
    expect(radios()[0].textContent).toBe('');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/WeekStrip: 1 of the days/));
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

  it('WeekStrip_CustomLabel_NamesTheGroup', () => {
    render(<WeekStrip days={WEEK} today={TODAY} label="Disponibilità della settimana" />);

    expect(screen.getByRole('radiogroup', { name: 'Disponibilità della settimana' })).toBeInTheDocument();
  });

  it('WeekStrip_Children_AreNotAccepted', () => {
    // @ts-expect-error the days are in `days`: children would be dropped without a word
    render(<WeekStrip days={WEEK} today={TODAY}>un testo</WeekStrip>);

    expect(screen.queryByText('un testo')).not.toBeInTheDocument();
  });

  it('WeekStrip_Everything_HasNoAxeViolations', async () => {
    const { container } = render(<Harness initial={TODAY} />);

    await expectNoAxeViolations(container);
  });
});
