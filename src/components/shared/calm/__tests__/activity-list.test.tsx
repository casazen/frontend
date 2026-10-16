import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { ActivityList, type ActivityItem } from '../activity-list';

const ITEMS: ActivityItem[] = [
  { id: 'old', at: '2026-10-11T12:20:00Z', actor: 'Tu', text: 'hai aggiunto un immobile' },
  { id: 'new', at: '2026-10-16T08:12:00Z', actor: 'Elisa', text: 'ha firmato il contratto' },
  { id: 'mid', at: '2026-10-15T16:40:00Z', text: 'Canone incassato', when: 'ieri alle 18:40' },
  { id: 'five', at: '2026-10-10T09:00:00Z', actor: 'CasaZen', text: 'ha registrato gli ospiti' },
  { id: 'six', at: '2026-10-09T09:00:00Z', actor: 'CasaZen', text: 'ha inviato il promemoria' },
];

const texts = () => screen.getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent);

describe('ActivityList (UI-16)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('ActivityList_Default_PutsTheLatestFirstWhateverTheOrderTheyCameIn', () => {
    render(<ActivityList items={ITEMS} />);

    expect(texts()).toEqual(['ha firmato il contratto', 'Canone incassato', 'hai aggiunto un immobile', 'ha registrato gli ospiti', 'ha inviato il promemoria']);
  });

  it('ActivityList_OrderOldest_ReadsFromTheStart', () => {
    render(<ActivityList items={ITEMS} order="oldest" />);

    expect(texts()).toEqual(['ha inviato il promemoria', 'ha registrato gli ospiti', 'hai aggiunto un immobile', 'Canone incassato', 'ha firmato il contratto']);
  });

  it('ActivityList_Entry_HasATimeElementWithTheInstantTheActorAndTheSentence', () => {
    render(<ActivityList items={ITEMS.slice(1, 2)} />);

    const entry = screen.getByRole('listitem');
    expect(entry.querySelector('time')).toHaveAttribute('datetime', '2026-10-16T08:12:00Z');
    expect(within(entry).getByText('Elisa')).toBeInTheDocument();
    expect(within(entry).getByText('ha firmato il contratto')).toBeInTheDocument();
  });

  it('ActivityList_DateWithoutWhen_IsDayMonthAndTimeInRomeInTheLanguageOfTheApp', async () => {
    const { unmount } = render(<ActivityList items={ITEMS.slice(1, 2)} />);
    // 08:12 UTC of 16 October is 10:12 in Rome (summer time).
    expect(screen.getByRole('listitem').querySelector('time')).toHaveTextContent(/16 ott.*10:12/);
    unmount();

    await i18n.changeLanguage('en');
    render(<ActivityList items={ITEMS.slice(1, 2)} />);
    expect(screen.getByRole('listitem').querySelector('time')).toHaveTextContent(/Oct 16.*10:12/);
  });

  it('ActivityList_When_ReplacesTheDefaultTextButKeepsTheInstant', () => {
    render(<ActivityList items={ITEMS.slice(2, 3)} />);

    const time = screen.getByRole('listitem').querySelector('time');
    expect(time).toHaveTextContent('ieri alle 18:40');
    expect(time).toHaveAttribute('datetime', '2026-10-15T16:40:00Z');
  });

  it('ActivityList_Entry_ShowsOnlyWhatItHasAndNoFixedText', () => {
    render(<ActivityList items={[{ id: 'x', at: '2026-10-16T08:12:00Z', text: 'Canone incassato', when: '16 ott' }]} />);

    expect(screen.getByRole('listitem').textContent).toBe('Canone incassato16 ott');
  });

  it('ActivityList_DateThatCannotBeRead_GoesLastAndShowsNoEmptyTime', () => {
    render(<ActivityList items={[{ id: 'bad', at: 'non è una data', text: 'Senza data' }, ...ITEMS.slice(0, 2)]} />);

    expect(texts()).toEqual(['ha firmato il contratto', 'hai aggiunto un immobile', 'Senza data']);
    expect(screen.getAllByRole('listitem')[2].querySelector('time')).toBeNull();
  });

  it('ActivityList_Entries_AreAnOrderedList', () => {
    render(<ActivityList items={ITEMS} aria-label="Attività recente" />);

    expect(screen.getByRole('list', { name: 'Attività recente' }).tagName).toBe('OL');
  });

  it('ActivityList_NoEntries_RendersNothing', () => {
    const { container } = render(<ActivityList items={[]} more={{ limit: 3, label: 'Mostra altro' }} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('ActivityList_More_ShowsTheFirstEntriesAndAButtonWithTheLabelOfTheCaller', () => {
    render(<ActivityList items={ITEMS} more={{ limit: 2, label: 'Mostra altro' }} />);

    expect(texts()).toEqual(['ha firmato il contratto', 'Canone incassato']);
    const button = screen.getByRole('button', { name: 'Mostra altro' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', screen.getByRole('list').id);
    expect(button).toHaveClass('min-h-11');
  });

  it('ActivityList_MoreClicked_ShowsAllTheEntriesAndTheFocusGoesToTheFirstNewOne', () => {
    render(<ActivityList items={ITEMS} more={{ limit: 2, label: 'Mostra altro' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mostra altro' }));

    expect(texts()).toHaveLength(5);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getAllByRole('listitem')[2]);
    expect(document.activeElement).toHaveTextContent('hai aggiunto un immobile');
  });

  it('ActivityList_MoreWithEnoughRoom_ShowsEverythingAndNoButton', () => {
    render(<ActivityList items={ITEMS} more={{ limit: 5, label: 'Mostra altro' }} />);

    expect(texts()).toHaveLength(5);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('ActivityList_LongText_CanBreak', () => {
    render(<ActivityList items={[{ id: 'l', at: '2026-10-16T08:12:00Z', text: 'Un_testo_lunghissimo_senza_spazi_che_non_entra_nella_colonna_del_telefono' }]} />);

    expect(screen.getByRole('listitem')).toHaveClass('break-words');
  });

  it('ActivityList_Everything_HasNoAxeViolations', async () => {
    const { container } = render(<ActivityList items={ITEMS} more={{ limit: 3, label: 'Mostra altro' }} aria-label="Attività recente" />);

    await expectNoAxeViolations(container);
  });
});
