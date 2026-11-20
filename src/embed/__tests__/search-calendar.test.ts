import { afterEach, describe, expect, it, vi } from 'vitest';
import { freezeClock, withBrowserTimeZone } from '@/test/clock';
import { NAV_KEYS, addDays, addMonths, createCalendar, dayFormat, monthGrid, monthStart, moveFocus, nightsBetween, pickDay, todayLocal, weekStart, type CalendarConfig, type Range } from '../search-calendar';
import { SEARCH_TEXTS } from '../texts';

/**
 * The range calendar of the search bar (E41/F02/US01/T02, NF-146): the model of the days (Monday first, one night at least, the keys that move the
 * focus) and the dialog that shows it. Days are written from calendar numbers, never from an instant: the process time zone is moved to the other side of
 * the date line to prove it.
 */
const TODAY = '2026-12-01';

describe('the days of the calendar (AC1)', () => {
  it('addDays_AcrossMonthsAndYears', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-12-01', 0)).toBe('2026-12-01');
  });

  it('addDays_IsNotMovedByTheChangeOfSummerTime', () => {
    // The clocks go forward on 2026-03-29 and back on 2026-10-25 in Italy: a day is still a day.
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2028-01-31', 1, '2028-02-29'],
    ['2026-12-15', 1, '2027-01-15'],
    ['2026-01-15', -1, '2025-12-15'],
    ['2026-03-31', -1, '2026-02-28'],
    ['2026-12-10', 12, '2027-12-10'],
  ])('addMonths_%s_By_%s_Is_%s', (day, count, expected) => {
    expect(addMonths(day, count)).toBe(expected);
  });

  it('monthStart_IsTheFirstOfTheMonth', () => {
    expect(monthStart('2026-12-17')).toBe('2026-12-01');
  });

  it.each([
    ['2026-12-02', '2026-11-30'],
    ['2026-11-30', '2026-11-30'],
    ['2026-12-06', '2026-11-30'],
    ['2026-12-07', '2026-12-07'],
  ])('weekStart_%s_IsTheMonday_%s', (day, monday) => {
    expect(weekStart(day)).toBe(monday);
  });

  it('nightsBetween_CountsTheNightsAndNeverGoesBelowZero', () => {
    expect(nightsBetween('2026-12-05', '2026-12-09')).toBe(4);
    expect(nightsBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(nightsBetween('2026-12-05', '2026-12-05')).toBe(0);
    expect(nightsBetween('2026-12-09', '2026-12-05')).toBe(0);
  });

  it('monthGrid_StartsOnMondayWithBlanksBeforeTheFirst', () => {
    // 1 December 2026 is a Tuesday and 31 December a Thursday.
    const weeks = monthGrid('2026-12-01');

    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]).toEqual([null, '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06']);
    expect(weeks.at(-1)).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', null, null, null]);
    expect(weeks.flat().filter((day) => day !== null)).toHaveLength(31);
  });

  it('monthGrid_AMonthThatStartsOnMondayAndFillsItsWeeksHasNoBlank', () => {
    // 1 February 2027 is a Monday and the month has 28 days.
    const weeks = monthGrid('2027-02-01');

    expect(weeks).toHaveLength(4);
    expect(weeks.flat().every((day) => day !== null)).toBe(true);
  });

  it('monthGrid_ALeapFebruaryHas29Days', () => {
    expect(monthGrid('2028-02-01').flat().filter((day) => day !== null)).toHaveLength(29);
  });
});

describe('what a click does to the stay (AC1, AC2)', () => {
  const none: Range = { checkIn: '', checkOut: '' };

  it('pickDay_TheFirstDayIsTheArrival', () => {
    expect(pickDay(none, '2026-12-05', TODAY)).toEqual({ range: { checkIn: '2026-12-05', checkOut: '' }, step: 'arrival' });
  });

  it('pickDay_ALaterDayIsTheDeparture', () => {
    expect(pickDay({ checkIn: '2026-12-05', checkOut: '' }, '2026-12-09', TODAY)).toEqual({ range: { checkIn: '2026-12-05', checkOut: '2026-12-09' }, step: 'departure' });
  });

  it.each([
    ['the day before the arrival', '2026-12-04'],
    ['the day of the arrival', '2026-12-05'],
    ['a week before the arrival', '2026-11-28'],
  ])('pickDay_%s_IsANewArrivalNeverADeparture', (_label, day) => {
    // A departure needs one night at least: a day on or before the arrival cannot be one.
    const result = pickDay({ checkIn: '2026-12-05', checkOut: '' }, day, '2026-11-01');

    expect(result.step).toBe('arrival');
    expect(result.range).toEqual({ checkIn: day, checkOut: '' });
  });

  it('pickDay_AWholeStayStartsANewOne', () => {
    expect(pickDay({ checkIn: '2026-12-05', checkOut: '2026-12-09' }, '2026-12-20', TODAY)).toEqual({ range: { checkIn: '2026-12-20', checkOut: '' }, step: 'arrival' });
  });

  it.each([['2026-11-30'], ['2026-11-01'], ['2025-12-01']])('pickDay_APastDay_%s_IsNoChoice', (day) => {
    const range = { checkIn: '2026-12-05', checkOut: '' };

    expect(pickDay(range, day, TODAY)).toEqual({ range, step: 'past' });
    expect(pickDay(none, day, TODAY)).toEqual({ range: none, step: 'past' });
  });

  it('pickDay_TodayIsNotPast', () => {
    expect(pickDay(none, TODAY, TODAY).step).toBe('arrival');
  });
});

describe('where the keys take the focus (AC4)', () => {
  // 10 December 2026 is a Thursday.
  it.each([
    ['ArrowLeft', '2026-12-09'],
    ['ArrowRight', '2026-12-11'],
    ['ArrowUp', '2026-12-03'],
    ['ArrowDown', '2026-12-17'],
    ['Home', '2026-12-07'],
    ['End', '2026-12-13'],
    ['PageUp', '2026-11-10'],
    ['PageDown', '2027-01-10'],
  ])('moveFocus_%s_Goes_To_%s', (key, expected) => {
    expect(moveFocus('2026-12-10', key, '2026-01-01')).toBe(expected);
  });

  it('moveFocus_NeverGoesBeforeToday', () => {
    expect(moveFocus('2026-12-10', 'PageUp', TODAY)).toBe(TODAY);
    expect(moveFocus(TODAY, 'ArrowLeft', TODAY)).toBe(TODAY);
    expect(moveFocus('2026-12-03', 'ArrowUp', TODAY)).toBe(TODAY);
    expect(moveFocus('2026-12-02', 'Home', TODAY)).toBe(TODAY);
  });

  it('moveFocus_PageDownFromTheEndOfAMonthLandsOnTheEndOfTheNext', () => {
    expect(moveFocus('2026-01-31', 'PageDown', '2026-01-01')).toBe('2026-02-28');
  });

  it('moveFocus_AKeyThatIsNoMovementStaysWhereItIs', () => {
    expect(moveFocus('2026-12-10', 'a', TODAY)).toBe('2026-12-10');
  });

  it('NAV_KEYS_AreTheKeysOfTheDatePicker', () => {
    expect(NAV_KEYS).toEqual(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
  });
});

describe('the names come from Intl in the language of the bar (AC4)', () => {
  it('dayFormat_WritesTheDayInTheLanguageOfTheBar', () => {
    expect(dayFormat('it', { day: 'numeric', month: 'long' })('2026-03-12')).toBe('12 marzo');
    expect(dayFormat('en', { day: 'numeric', month: 'long' })('2026-03-12')).toBe('12 March');
    expect(dayFormat('it', { month: 'long', year: 'numeric' })('2026-12-01')).toBe('dicembre 2026');
  });

  it('dayFormat_WritesTheDayGivenWhateverTheTimeZone', () => {
    // 1 January at midnight UTC is still 31 December on the west of Greenwich, and the format is made in UTC for that.
    expect(dayFormat('en', { day: 'numeric', month: 'long', year: 'numeric' })('2027-01-01')).toBe('1 January 2027');
  });
});

describe('the day of the visitor, written from the local parts of the clock (AC1)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('with the browser on the far east, where the day has already turned', () => {
    withBrowserTimeZone('Pacific/Kiritimati');

    it('todayLocal_IsTheLocalDayNotTheUtcDay', () => {
      // 10:00 UTC of 1 December is 00:00 of 2 December in Kiritimati (UTC+14): the local day is the 2nd, the UTC day the 1st.
      freezeClock('2026-12-01T10:00:00Z');

      expect(todayLocal()).toBe('2026-12-02');
    });

    it('todayLocal_OfALocalMidnight_IsThatDay', () => {
      // A local midnight is 14 hours earlier in UTC: the day before. `toISOString()` would say 2026-12-04.
      const midnight = new Date(2026, 11, 5);

      expect(midnight.toISOString().startsWith('2026-12-04')).toBe(true);
      expect(todayLocal(midnight)).toBe('2026-12-05');
    });

    it('theDaysOfTheGridAreTheSameWhateverTheTimeZone', () => {
      expect(monthGrid('2026-12-01')[0]).toEqual([null, '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06']);
      expect(addDays('2026-12-05', 1)).toBe('2026-12-06');
      expect(pickDay({ checkIn: '', checkOut: '' }, '2026-12-05', '2026-12-02').range.checkIn).toBe('2026-12-05');
    });
  });

  describe('with the browser on the far west', () => {
    withBrowserTimeZone('Pacific/Pago_Pago');

    it('todayLocal_IsTheLocalDayNotTheUtcDay', () => {
      // 05:00 UTC of 2 December is 18:00 of 1 December in Samoa (UTC-11).
      freezeClock('2026-12-02T05:00:00Z');

      expect(todayLocal()).toBe('2026-12-01');
    });
  });
});

describe('the dialog', () => {
  const text = SEARCH_TEXTS.it;

  function open(overrides: Partial<CalendarConfig> = {}, range: Range = { checkIn: '', checkOut: '' }) {
    const calls = { picks: [] as [Range, string][], said: [] as string[], closed: [] as boolean[] };
    const calendar = createCalendar({
      lang: 'it',
      text,
      id: 'cal',
      today: () => TODAY,
      months: () => 2,
      onPick: (picked, step) => calls.picks.push([picked, step]),
      onSay: (message) => calls.said.push(message),
      onClose: (restoreFocus) => calls.closed.push(restoreFocus),
      ...overrides,
    });
    document.body.appendChild(calendar.element);
    calendar.open(range);
    return { calendar, calls };
  }

  const cell = (day: string) => document.querySelector<HTMLElement>(`[data-day="${day}"]`) as HTMLElement;
  const press = (target: Element, key: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('calendar_IsANonModalDialogWithAGridOfDays', () => {
    const { calendar } = open();

    expect(calendar.element.getAttribute('role')).toBe('dialog');
    expect(calendar.element.getAttribute('aria-modal')).toBe('false');
    expect(calendar.element.getAttribute('aria-label')).toBe('Scegli le date');
    expect(calendar.element.hidden).toBe(false);
    const grids = calendar.element.querySelectorAll('table[role="grid"]');
    expect(grids).toHaveLength(2);
    for (const grid of grids) {
      expect(document.getElementById(grid.getAttribute('aria-labelledby') as string)?.textContent).toMatch(/^(dicembre 2026|gennaio 2027)$/);
      expect(grid.querySelectorAll('td[role="gridcell"]').length).toBeGreaterThanOrEqual(28);
    }
  });

  it('calendar_ShowsOneMonthOrTwoAsTheBarAllows', () => {
    open({ months: () => 1 });
    expect(document.querySelectorAll('table[role="grid"]')).toHaveLength(1);
    expect(document.querySelector('.czs-month-title')?.textContent).toBe('dicembre 2026');

    document.body.innerHTML = '';
    open({ months: () => 2 });
    expect([...document.querySelectorAll('.czs-month-title')].map((title) => title.textContent)).toEqual(['dicembre 2026', 'gennaio 2027']);
  });

  it('calendar_WritesTheNamesOfTheWeekFromMondayInTheLanguageOfTheBar', () => {
    open();

    const names = [...document.querySelectorAll('table')[0].querySelectorAll('th')];
    expect(names.map((name) => name.textContent)).toEqual(['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']);
    expect(names.map((name) => name.getAttribute('abbr'))).toEqual(['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']);
    expect(names.every((name) => name.getAttribute('scope') === 'col')).toBe(true);
  });

  it('calendar_InEnglishWritesEnglishNames', () => {
    open({ lang: 'en', text: SEARCH_TEXTS.en });

    expect([...document.querySelectorAll('th')].slice(0, 7).map((name) => name.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(document.querySelector('.czs-month-title')?.textContent).toBe('December 2026');
    expect(cell('2026-12-05').getAttribute('aria-label')).toContain('5 December 2026');
    expect(document.querySelector('[aria-label="Previous month"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Next month"]')).not.toBeNull();
  });

  it('calendar_EachDayHasItsFullDateAsItsName', () => {
    open();

    expect(cell('2026-12-05').getAttribute('aria-label')).toBe('sabato 5 dicembre 2026');
    expect(cell('2026-12-05').textContent).toBe('5');
    expect(cell('2026-12-31').getAttribute('aria-label')).toBe('giovedì 31 dicembre 2026');
  });

  it('calendar_APastDayIsShownAndCannotBePicked', () => {
    const { calls } = open({ today: () => '2026-12-10' });

    const past = cell('2026-12-05');
    expect(past.getAttribute('aria-disabled')).toBe('true');
    expect(past.getAttribute('aria-label')).toBe('sabato 5 dicembre 2026, giorno passato');
    expect(past.className).toContain('is-past');
    expect(cell('2026-12-10').hasAttribute('aria-disabled')).toBe(false);

    past.click();
    press(past, 'Enter');

    expect(calls.picks).toEqual([]);
  });

  it('calendar_OnlyTheFocusDayIsInTheTabOrder', () => {
    open();

    const tabbable = [...document.querySelectorAll('td[tabindex="0"]')];
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toBe(cell(TODAY));
    expect(document.activeElement).toBe(cell(TODAY));
    expect(cell('2026-12-02').getAttribute('tabindex')).toBe('-1');
  });

  it('calendar_OpensOnTheArrivalWhenThereIsOne', () => {
    open({}, { checkIn: '2026-12-12', checkOut: '' });

    expect(document.activeElement).toBe(cell('2026-12-12'));
    expect(cell('2026-12-12').getAttribute('aria-selected')).toBe('true');
    expect(cell('2026-12-12').className).toContain('is-start');
    expect(cell('2026-12-12').getAttribute('aria-label')).toBe('sabato 12 dicembre 2026, Arrivo');
  });

  it('calendar_MarksTheStayAndTheDaysBetween', () => {
    open({}, { checkIn: '2026-12-05', checkOut: '2026-12-09' });

    expect(cell('2026-12-05').className).toContain('is-start');
    expect(cell('2026-12-09').className).toContain('is-end');
    expect(cell('2026-12-09').getAttribute('aria-label')).toBe('mercoledì 9 dicembre 2026, Partenza');
    for (const day of ['2026-12-06', '2026-12-07', '2026-12-08']) {
      expect(cell(day).className).toContain('is-range');
      expect(cell(day).getAttribute('aria-selected')).toBe('true');
    }
    expect(cell('2026-12-04').getAttribute('aria-selected')).toBe('false');
    expect(cell('2026-12-10').getAttribute('aria-selected')).toBe('false');
  });

  it('calendar_AClickPicksTheArrivalAndThenTheDepartureAndCloses', () => {
    const { calendar, calls } = open();

    cell('2026-12-05').click();
    expect(calls.picks).toEqual([[{ checkIn: '2026-12-05', checkOut: '' }, 'arrival']]);
    expect(calendar.isOpen()).toBe(true);
    expect(document.activeElement).toBe(cell('2026-12-05'));
    expect(cell('2026-12-05').className).toContain('is-start');

    cell('2026-12-09').click();
    expect(calls.picks[1]).toEqual([{ checkIn: '2026-12-05', checkOut: '2026-12-09' }, 'departure']);
    expect(calendar.isOpen()).toBe(false);
    expect(calendar.element.hidden).toBe(true);
    expect(calls.closed).toEqual([true]);
  });

  it('calendar_AClickOnADayBeforeTheArrivalStartsAgain', () => {
    const { calls } = open();

    cell('2026-12-09').click();
    cell('2026-12-05').click();

    expect(calls.picks.map(([, step]) => step)).toEqual(['arrival', 'arrival']);
    expect(calls.picks[1][0]).toEqual({ checkIn: '2026-12-05', checkOut: '' });
  });

  it('calendar_ArrowsMoveTheFocusByDayAndWeek', () => {
    open();

    press(document.activeElement as Element, 'ArrowRight');
    expect(document.activeElement).toBe(cell('2026-12-02'));
    press(document.activeElement as Element, 'ArrowDown');
    expect(document.activeElement).toBe(cell('2026-12-09'));
    press(document.activeElement as Element, 'ArrowLeft');
    expect(document.activeElement).toBe(cell('2026-12-08'));
    press(document.activeElement as Element, 'ArrowUp');
    expect(document.activeElement).toBe(cell('2026-12-01'));
    // Never before today.
    press(document.activeElement as Element, 'ArrowLeft');
    expect(document.activeElement).toBe(cell('2026-12-01'));
  });

  it('calendar_HomeAndEndGoToTheMondayAndTheSundayOfTheWeek', () => {
    open({}, { checkIn: '2026-12-10', checkOut: '' });

    press(document.activeElement as Element, 'Home');
    expect(document.activeElement).toBe(cell('2026-12-07'));
    press(document.activeElement as Element, 'End');
    expect(document.activeElement).toBe(cell('2026-12-13'));
  });

  it('calendar_PageDownAndPageUpChangeMonthAndTheMonthIsAnnounced', () => {
    const { calls } = open({ months: () => 1 });

    press(document.activeElement as Element, 'PageDown');
    expect(document.activeElement).toBe(cell('2027-01-01'));
    expect(document.querySelector('.czs-month-title')?.textContent).toBe('gennaio 2027');
    press(document.activeElement as Element, 'PageUp');
    expect(document.activeElement).toBe(cell(TODAY));
    expect(document.querySelector('.czs-month-title')?.textContent).toBe('dicembre 2026');
    expect(calls.said).toEqual(['gennaio 2027', 'dicembre 2026']);
  });

  it('calendar_AMonthThatIsAlreadyShownIsNotScrolled', () => {
    open({ months: () => 2 });

    press(document.activeElement as Element, 'PageDown');

    expect([...document.querySelectorAll('.czs-month-title')].map((title) => title.textContent)).toEqual(['dicembre 2026', 'gennaio 2027']);
    expect(document.activeElement).toBe(cell('2027-01-01'));
  });

  it('calendar_EnterAndSpacePickTheArrivalAndTheDeparture', () => {
    const { calendar, calls } = open();

    press(document.activeElement as Element, 'ArrowDown');
    press(document.activeElement as Element, 'Enter');
    press(document.activeElement as Element, 'ArrowRight');
    press(document.activeElement as Element, 'ArrowRight');
    press(document.activeElement as Element, ' ');

    expect(calls.picks).toEqual([
      [{ checkIn: '2026-12-08', checkOut: '' }, 'arrival'],
      [{ checkIn: '2026-12-08', checkOut: '2026-12-10' }, 'departure'],
    ]);
    expect(calendar.isOpen()).toBe(false);
  });

  it('calendar_EscapeClosesAndAsksForTheFocusBack', () => {
    const { calendar, calls } = open();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });

    (document.activeElement as Element).dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(calendar.isOpen()).toBe(false);
    expect(calls.closed).toEqual([true]);
  });

  it('calendar_CloseWithoutTheFocus_DoesNotAskForIt', () => {
    const { calendar, calls } = open();

    calendar.close(false);
    calendar.close(false);

    expect(calls.closed).toEqual([false]);
  });

  it('calendar_TheArrowsOfTheHeaderChangeTheMonthAndTheFirstMonthCannotGoBack', () => {
    const { calls } = open({ months: () => 1 });
    const previous = document.querySelector('[aria-label="Mese precedente"]') as HTMLElement;
    const next = document.querySelector('[aria-label="Mese successivo"]') as HTMLElement;

    expect(previous.getAttribute('aria-disabled')).toBe('true');
    previous.click();
    expect(document.querySelector('.czs-month-title')?.textContent).toBe('dicembre 2026');

    next.click();
    expect(document.querySelector('.czs-month-title')?.textContent).toBe('gennaio 2027');
    expect(previous.getAttribute('aria-disabled')).toBe('false');
    expect(calls.said).toEqual(['gennaio 2027']);
    // The day that has the tab stop goes with the month.
    expect(document.querySelectorAll('td[tabindex="0"]')).toHaveLength(1);
    expect(document.querySelector('td[tabindex="0"]')?.getAttribute('data-day')).toBe('2027-01-01');

    previous.click();
    expect(document.querySelector('.czs-month-title')?.textContent).toBe('dicembre 2026');
  });

  it('calendar_WritesEverythingAsText', () => {
    open();

    expect(document.querySelectorAll('.czs-cal img, .czs-cal script, .czs-cal iframe, .czs-cal a')).toHaveLength(0);
    expect(document.querySelector('.czs-cal')?.getAttribute('style')).toBeNull();
  });
});
