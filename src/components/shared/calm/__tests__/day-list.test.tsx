import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { freezeClock } from '@/test/clock';
import { expectNoAxeViolations } from '@/test/axe';
import { DayList, TodayList, type DayListItem, type TodayListItem } from '../day-list';

const ROWS: DayListItem[] = [
  { id: 'a', day: '2026-10-28', title: 'Registrazione Rossi', subtitle: 'Elisa Rossi · Via Roma 12', meta: 'tra 12 giorni', href: '/app/long-rent/contracts/a' },
  { id: 'b', date: '5 ott', dateTime: '2026-10-05', title: 'Canone Bianchi', subtitle: 'Marco Bianchi', meta: 'in ritardo', tone: 'danger', onOpen: () => undefined, action: { label: 'Invia il sollecito', ariaLabel: 'Invia il sollecito: canone Bianchi', onClick: () => undefined } },
  { id: 'c', date: '10 nov', title: 'Una riga da leggere' },
];

function Arrived() {
  return <p data-testid="arrived">{JSON.stringify(useLocation().state)}</p>;
}

function renderList(items: readonly DayListItem[] = ROWS) {
  return render(
    <MemoryRouter>
      <DayList items={items} aria-label="Scadenze" />
    </MemoryRouter>,
  );
}

describe('DayList (UI-16)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('DayList_Rows_ShowDateTitleSublineAndNoteAsTheCallerWroteThem', () => {
    renderList();

    const rows = within(screen.getByRole('list', { name: 'Scadenze' })).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      '28 ottRegistrazione RossiElisa Rossi · Via Roma 12tra 12 giorni',
      '5 ottCanone BianchiMarco Bianchiin ritardoInvia il sollecito',
      '10 novUna riga da leggere',
    ]);
  });

  it('DayList_DayWithoutADate_SaysItShortInTheLanguageOfTheAppAndIsTheMachineValue', async () => {
    const { unmount } = renderList([{ id: 'a', day: '2026-10-28', title: 'Registrazione' }]);
    expect(screen.getByRole('listitem').querySelector('time')).toHaveAttribute('datetime', '2026-10-28');
    expect(screen.getByRole('listitem').querySelector('time')).toHaveTextContent('28 ott');
    unmount();

    await i18n.changeLanguage('en');
    renderList([{ id: 'a', day: '2026-10-28', title: 'Registration' }]);
    expect(screen.getByRole('listitem').querySelector('time')).toHaveTextContent('Oct 28');
  });

  it('DayList_DateAndDateTime_AreTheCallersWordsAndBeatTheDay', () => {
    renderList([{ id: 'a', day: '2026-10-16', date: '09:30', dateTime: '2026-10-16T09:30', title: 'Arrivo' }]);

    const time = screen.getByRole('listitem').querySelector('time');
    expect(time).toHaveTextContent('09:30');
    expect(time).toHaveAttribute('datetime', '2026-10-16T09:30');
  });

  it('DayList_DateWithoutAMachineValue_IsAPlainSpanAndNoDayAtAllLeavesTheCellEmpty', () => {
    renderList([
      { id: 'a', date: '5 ott', title: 'Solo testo' },
      { id: 'b', title: 'Senza data', day: 'non è un giorno' },
    ]);

    const rows = screen.getAllByRole('listitem');
    expect(rows[0].querySelector('time')).toBeNull();
    expect(rows[0].firstElementChild).toHaveTextContent('5 ott');
    expect(rows[1].querySelector('time')).toBeNull();
    expect(rows[1].firstElementChild).toBeEmptyDOMElement();
  });

  it('DayList_TitleWithAnHref_IsALinkAroundTheTitleAndTheLineUnderItAndNothingIsStretchedOverTheRow', () => {
    renderList();

    const link = screen.getByRole('link', { name: /Registrazione Rossi/ });
    expect(link).toHaveAttribute('href', '/app/long-rent/contracts/a');
    expect(link.textContent).toBe('Registrazione RossiElisa Rossi · Via Roma 12');
    // 44 px high at least, as wide as its column, and no overlay: the redesign has its own hit area for links and buttons of a phone.
    expect(link).toHaveClass('min-h-11', 'min-w-0');
    expect(link.className).not.toMatch(/after:|absolute/);
    // The date and the note are outside it.
    expect(link).not.toHaveTextContent('28 ott');
    expect(link).not.toHaveTextContent('tra 12 giorni');
  });

  it('DayList_LinkWithAState_HandsItToThePageThatOpens', () => {
    render(
      <MemoryRouter initialEntries={['/start']}>
        <Routes>
          <Route path="/start" element={<DayList items={[{ id: 'a', day: '2026-10-28', title: 'Registrazione', href: '/app/long-rent/contracts/a', state: { from: 'home' } }]} />} />
          <Route path="*" element={<Arrived />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: /Registrazione/ }));

    expect(screen.getByTestId('arrived')).toHaveTextContent('{"from":"home"}');
  });

  it('DayList_TitleWithOnOpen_IsAButtonThatRunsItWithoutTheClickEvent', () => {
    const onOpen = vi.fn();
    renderList([{ id: 'b', date: '5 ott', title: 'Canone Bianchi', subtitle: 'Marco Bianchi', onOpen }]);

    const button = screen.getByRole('button', { name: /Canone Bianchi/ });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.textContent).toBe('Canone BianchiMarco Bianchi');
    fireEvent.click(button);

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith();
  });

  it('DayList_RowWithoutHrefOrOnOpen_IsOnlyToRead', () => {
    renderList([{ id: 'c', date: '10 nov', title: 'Una riga da leggere' }]);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('DayList_DirectAction_IsASeparateButtonThatDoesNotOpenTheRow', () => {
    const onClick = vi.fn();
    const onOpen = vi.fn();
    renderList([{ id: 'b', date: '5 ott', title: 'Canone Bianchi', onOpen, action: { label: 'Invia il sollecito', ariaLabel: 'Invia il sollecito: canone Bianchi', onClick } }]);

    const action = screen.getByRole('button', { name: 'Invia il sollecito: canone Bianchi' });
    expect(action).toHaveTextContent('Invia il sollecito');
    expect(action).toHaveClass('min-h-11');
    expect(screen.getAllByRole('button')).toHaveLength(2);
    // Two siblings, not one inside the other.
    expect(screen.getByRole('button', { name: /Canone Bianchi/ })).not.toContainElement(action);
    fireEvent.click(action);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('DayList_ActionAsAPage_IsALink', () => {
    renderList([{ id: 'd', date: '3 nov', title: 'Restituzione deposito', action: { label: 'Prepara', href: '/app/long-rent/contracts/d?tab=deposito' } }]);

    expect(screen.getByRole('link', { name: 'Prepara' })).toHaveAttribute('href', '/app/long-rent/contracts/d?tab=deposito');
  });

  it('DayList_NoteWithATone_HasTheIconOfTheToneAndAPlainNoteHasNone', () => {
    renderList();

    const rows = screen.getAllByRole('listitem');
    const urgent = within(rows[1]).getByText('in ritardo');
    expect(urgent.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(urgent).toHaveClass('text-danger-foreground');
    expect(rows[1]).toHaveAttribute('data-tone', 'danger');
    const plain = within(rows[0]).getByText('tra 12 giorni');
    expect(plain.querySelector('svg')).toBeNull();
    expect(plain).toHaveClass('text-foreground/70');
  });

  it('DayList_NoRows_RendersNothing', () => {
    const { container } = renderList([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('DayList_LongTitlesAndDates_CanBreak', () => {
    renderList([{ id: 'l', date: 'Mercoledì_prossimo', title: 'Titolo_lunghissimo_senza_spazi_che_non_entra_nella_colonna_del_telefono', subtitle: 'Sottoriga_lunghissima_senza_spazi_che_non_entra_nella_colonna' }]);

    expect(screen.getByText(/Titolo_lunghissimo/)).toHaveClass('break-words');
    expect(screen.getByText(/Sottoriga_lunghissima/)).toHaveClass('break-words');
    expect(screen.getByText(/Mercoledì_prossimo/)).toHaveClass('break-words', 'min-w-0');
    // The title is a block inside a column that can shrink (the link or the button around it has `min-w-0` too).
    expect(screen.getByText(/Titolo_lunghissimo/).parentElement).toHaveClass('min-w-0');
  });

  it('DayList_Children_AreNotAccepted', () => {
    render(
      <MemoryRouter>
        {/* @ts-expect-error a list has its rows in `items`: children would be dropped without a word */}
        <DayList items={ROWS}>un testo</DayList>
      </MemoryRouter>,
    );

    expect(screen.queryByText('un testo')).not.toBeInTheDocument();
  });

  it('DayList_WithEveryKindOfRow_HasNoAxeViolations', async () => {
    const { container } = renderList();

    await expectNoAxeViolations(container);
  });
});

const TODAY = '2026-10-16';
const LABELS = { today: 'Oggi', tomorrow: 'Domani', later: 'Più avanti' };

const DAYS: TodayListItem[] = [
  { id: 'late', day: '2026-10-14', date: '14 ott', title: 'Rimasto indietro' },
  { id: 'now', day: TODAY, date: '09:30', title: 'Arrivo Neri' },
  { id: 'next', day: '2026-10-17', date: '15:00', title: 'Partenza Verdi' },
  { id: 'later1', day: '2026-10-19', date: '19 ott', title: 'Caldaia' },
  { id: 'later2', day: '2026-12-01', date: '1 dic', title: 'Rinnovo' },
];

function renderToday(items: readonly TodayListItem[] = DAYS) {
  return render(
    <MemoryRouter>
      <TodayList items={items} labels={LABELS} today={TODAY} />
    </MemoryRouter>,
  );
}

const titlesOf = (group: string) => within(screen.getByRole('list', { name: group })).getAllByRole('listitem').map((row) => row.textContent);

describe('TodayList (UI-16)', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('TodayList_Rows_GoToTodayTomorrowAndLaterAndAPastDayStaysWithToday', () => {
    renderToday();

    expect(titlesOf('Oggi')).toEqual(['14 ottRimasto indietro', '09:30Arrivo Neri']);
    expect(titlesOf('Domani')).toEqual(['15:00Partenza Verdi']);
    expect(titlesOf('Più avanti')).toEqual(['19 ottCaldaia', '1 dicRinnovo']);
  });

  it('TodayList_DayWrittenWithATime_IsReadAsTheDayItStartsWith', () => {
    renderToday([
      { id: 'a', day: '2026-10-16T09:30:00', date: '09:30', title: 'Oggi alle nove e mezza' },
      { id: 'b', day: '2026-10-17T15:00:00Z', date: '15:00', title: 'Domani alle tre' },
    ]);

    expect(titlesOf('Oggi')).toEqual(['09:30Oggi alle nove e mezza']);
    expect(titlesOf('Domani')).toEqual(['15:00Domani alle tre']);
  });

  it('TodayList_DayThatCannotBeRead_GoesLastAndNeverWithToday', () => {
    renderToday([
      { id: 'a', day: '', date: '—', title: 'Senza giorno' },
      { id: 'b', day: 'domani forse', date: '?', title: 'Giorno strano' },
      { id: 'c', day: TODAY, date: '09:30', title: 'Arrivo Neri' },
    ]);

    expect(titlesOf('Oggi')).toEqual(['09:30Arrivo Neri']);
    expect(titlesOf('Più avanti')).toEqual(['—Senza giorno', '?Giorno strano']);
  });

  it('TodayList_Groups_AreH3WithTheNamesOfTheCaller', () => {
    renderToday();

    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Oggi', 'Domani', 'Più avanti']);
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });

  it('TodayList_EmptyGroups_AreNotShown', () => {
    renderToday(DAYS.filter((item) => item.id === 'next'));

    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['Domani']);
    expect(screen.getAllByRole('list')).toHaveLength(1);
  });

  it('TodayList_NoRows_RendersNothing', () => {
    const { container } = renderToday([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('TodayList_RowsOfAGroup_KeepTheOrderTheyCameIn', () => {
    renderToday([
      { id: 'second', day: TODAY, date: '14:00', title: 'Secondo' },
      { id: 'first', day: TODAY, date: '09:00', title: 'Primo' },
    ]);

    expect(titlesOf('Oggi')).toEqual(['14:00Secondo', '09:00Primo']);
  });

  it('TodayList_WithoutToday_TakesTodayInRomeNotTheDayOfUtc', () => {
    // 22:30 UTC of the 16th is half past midnight of the 17th in Rome (summer time): there, the 17th is today.
    freezeClock('2026-10-16T22:30:00Z');
    render(
      <MemoryRouter>
        <TodayList items={DAYS} labels={LABELS} />
      </MemoryRouter>,
    );

    expect(titlesOf('Oggi')).toEqual(['14 ottRimasto indietro', '09:30Arrivo Neri', '15:00Partenza Verdi']);
    expect(screen.queryByRole('list', { name: 'Domani' })).not.toBeInTheDocument();
    expect(titlesOf('Più avanti')).toEqual(['19 ottCaldaia', '1 dicRinnovo']);
  });

  it('TodayList_TodayThatCannotBeRead_IsTodayInRome', () => {
    freezeClock('2026-10-16T10:00:00Z');
    render(
      <MemoryRouter>
        <TodayList items={DAYS} labels={LABELS} today="oggi" />
      </MemoryRouter>,
    );

    expect(titlesOf('Domani')).toEqual(['15:00Partenza Verdi']);
  });

  it('TodayList_ExtraProps_GoToTheRoot', () => {
    const { container } = render(
      <MemoryRouter>
        <TodayList items={DAYS} labels={LABELS} today={TODAY} data-testid="oggi" className="mt-4" />
      </MemoryRouter>,
    );

    expect(container.querySelector('[data-testid="oggi"]')).toHaveClass('mt-4');
  });

  it('TodayList_WithEveryGroup_HasNoAxeViolations', async () => {
    const { container } = renderToday();

    await expectNoAxeViolations(container);
  });
});
