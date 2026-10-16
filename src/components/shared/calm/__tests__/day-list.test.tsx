import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expectNoAxeViolations } from '@/test/axe';
import { DayList, TodayList, type DayListItem, type TodayListItem } from '../day-list';

const ROWS: DayListItem[] = [
  { id: 'a', date: '28 ott', dateTime: '2026-10-28', title: 'Registrazione Rossi', subtitle: 'Elisa Rossi · Via Roma 12', meta: 'tra 12 giorni', href: '/app/long-rent/contracts/a' },
  { id: 'b', date: '5 ott', title: 'Canone Bianchi', subtitle: 'Marco Bianchi', meta: 'in ritardo', tone: 'danger', onOpen: () => undefined, action: { label: 'Invia il sollecito', ariaLabel: 'Invia il sollecito: canone Bianchi', onClick: () => undefined } },
  { id: 'c', date: '10 nov', title: 'Una riga da leggere' },
];

function renderList(items: readonly DayListItem[] = ROWS) {
  return render(
    <MemoryRouter>
      <DayList items={items} aria-label="Scadenze" />
    </MemoryRouter>,
  );
}

describe('DayList (UI-16)', () => {
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

  it('DayList_DateWithAMachineValue_IsATimeElementOtherwiseAPlainSpan', () => {
    renderList();

    const rows = screen.getAllByRole('listitem');
    const time = rows[0].querySelector('time');
    expect(time).toHaveAttribute('datetime', '2026-10-28');
    expect(time).toHaveTextContent('28 ott');
    expect(rows[1].querySelector('time')).toBeNull();
  });

  it('DayList_TitleWithAnHref_IsALinkWhoseHitAreaIsTheWholeRow', () => {
    renderList();

    const link = screen.getByRole('link', { name: 'Registrazione Rossi' });
    expect(link).toHaveAttribute('href', '/app/long-rent/contracts/a');
    expect(link).toHaveClass('after:absolute', 'after:inset-0');
    expect(link.closest('li')).toHaveClass('relative');
  });

  it('DayList_TitleWithOnOpen_IsAButtonThatRunsIt', () => {
    const onOpen = vi.fn();
    renderList([{ id: 'b', date: '5 ott', title: 'Canone Bianchi', onOpen }]);

    fireEvent.click(screen.getByRole('button', { name: 'Canone Bianchi' }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('DayList_RowWithoutHrefOrOnOpen_IsOnlyToRead', () => {
    renderList([{ id: 'c', date: '10 nov', title: 'Una riga da leggere' }]);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('DayList_DirectAction_IsASeparateButtonAboveTheHitAreaOfTheTitle', () => {
    const onClick = vi.fn();
    renderList([{ id: 'b', date: '5 ott', title: 'Canone Bianchi', onOpen: () => undefined, action: { label: 'Invia il sollecito', ariaLabel: 'Invia il sollecito: canone Bianchi', onClick } }]);

    const action = screen.getByRole('button', { name: 'Invia il sollecito: canone Bianchi' });
    expect(action).toHaveTextContent('Invia il sollecito');
    expect(action).toHaveClass('min-h-11');
    // The title and the action are two controls; the action sits in a layer above the one the title stretches over the row.
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(action.closest('div')).toHaveClass('relative', 'z-10');
    fireEvent.click(action);

    expect(onClick).toHaveBeenCalledTimes(1);
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

  it('DayList_LongTitles_CanBreak', () => {
    renderList([{ id: 'l', date: '1 nov', title: 'Titolo_lunghissimo_senza_spazi_che_non_entra_nella_colonna_del_telefono', subtitle: 'Sottoriga_lunghissima_senza_spazi_che_non_entra_nella_colonna' }]);

    expect(screen.getByText(/Titolo_lunghissimo/)).toHaveClass('break-words');
    expect(screen.getByText(/Sottoriga_lunghissima/)).toHaveClass('break-words');
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
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T22:30:00Z'));
    render(
      <MemoryRouter>
        <TodayList items={DAYS} labels={LABELS} />
      </MemoryRouter>,
    );

    expect(titlesOf('Oggi')).toEqual(['14 ottRimasto indietro', '09:30Arrivo Neri', '15:00Partenza Verdi']);
    expect(screen.queryByRole('list', { name: 'Domani' })).not.toBeInTheDocument();
    expect(titlesOf('Più avanti')).toEqual(['19 ottCaldaia', '1 dicRinnovo']);
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
