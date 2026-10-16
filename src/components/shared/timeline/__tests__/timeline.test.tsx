import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import i18n from '@/i18n/config';
import italian from '@/i18n/locales/it.json';
import english from '@/i18n/locales/en.json';
import { expectNoAxeViolations } from '@/test/axe';
import { freezeClock } from '@/test/clock';
import { Timeline, type TimelineEvent, type TimelineProps } from '../timeline';

// 12:00 UTC of Friday 16 October 2026: 14:00 in Rome.
const NOW = '2026-10-16T12:00:00Z';

const EVENTS: TimelineEvent[] = [
  { id: 'created', at: '2026-10-14T08:00:00Z', title: 'Prenotazione creata', actor: 'Giulia' },
  { id: 'paid', at: '2026-10-16T09:30:00Z', title: 'Pagamento ricevuto', description: 'Acconto del 30%', tone: 'success' },
  { id: 'link', at: '2026-10-15T15:00:00Z', title: 'Link di check-in inviato', tone: 'info' },
];

function renderTimeline(props: Partial<TimelineProps> = {}) {
  return render(
    <MemoryRouter>
      <Timeline events={EVENTS} {...props} />
    </MemoryRouter>,
  );
}

/** The title line of each event, without the word for a screen reader that tells its tone. */
const titles = () =>
  screen.getAllByRole('listitem').map((item) =>
    Array.from((item.querySelector('p') as HTMLElement).childNodes)
      .filter((node) => !(node instanceof HTMLElement && node.classList.contains('sr-only')))
      .map((node) => node.textContent)
      .join(''),
  );
const numbered = (count: number): TimelineEvent[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `e${index + 1}`,
    // One a day, the first the most recent.
    at: new Date(Date.parse(NOW) - index * 86_400_000).toISOString(),
    title: `Evento ${index + 1}`,
  }));

describe('Timeline (UI-15)', () => {
  beforeEach(async () => {
    freezeClock(NOW);
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('structure', () => {
    it('Timeline_Events_AreAnOrderedListNamedForAScreenReader', () => {
      renderTimeline();

      const list = screen.getByRole('list', { name: 'Cronologia' });
      expect(list.tagName).toBe('OL');
      expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    });

    it('Timeline_Label_NamesTheList', () => {
      renderTimeline({ label: 'Cronologia della prenotazione' });

      expect(screen.getByRole('list', { name: 'Cronologia della prenotazione' })).toBeInTheDocument();
    });

    it('Timeline_Description_AndActor_AreShownUnderTheTitle', () => {
      renderTimeline();

      expect(screen.getByText('Acconto del 30%')).toBeInTheDocument();
      expect(screen.getByText(/da Giulia/)).toBeInTheDocument();
    });

    it('Timeline_Actor_IsToldInTheLanguageOfThePage', async () => {
      await i18n.changeLanguage('en');
      renderTimeline();

      expect(screen.getByText(/by Giulia/)).toBeInTheDocument();
    });
  });

  describe('order', () => {
    it('Timeline_ByDefault_PutsTheLatestFirst', () => {
      renderTimeline();

      expect(titles()).toEqual(['Pagamento ricevuto', 'Link di check-in inviato', 'Prenotazione creata']);
    });

    it('Timeline_OrderAsc_PutsTheOldestFirst', () => {
      renderTimeline({ order: 'asc' });

      expect(titles()).toEqual(['Prenotazione creata', 'Link di check-in inviato', 'Pagamento ricevuto']);
    });

    it('Timeline_EventsAtTheSameTime_KeepTheOrderTheyWereGiven', () => {
      renderTimeline({
        events: [
          { id: 'a', at: '2026-10-16T09:00:00Z', title: 'Primo' },
          { id: 'b', at: '2026-10-16T09:00:00Z', title: 'Secondo' },
        ],
      });

      expect(titles()).toEqual(['Primo', 'Secondo']);
    });

    it('Timeline_AnEventWithADateThatCannotBeRead_GoesLastInEitherOrderAndHasNoTime', () => {
      const events: TimelineEvent[] = [{ id: 'x', at: 'ieri sera', title: 'Senza data' }, ...EVENTS];

      for (const order of ['desc', 'asc'] as const) {
        const { unmount } = renderTimeline({ events, order });
        expect(titles().at(-1)).toBe('Senza data');
        expect(within(screen.getAllByRole('listitem').at(-1) as HTMLElement).queryByText(/./, { selector: 'time' })).not.toBeInTheDocument();
        unmount();
      }
    });
  });

  describe('the time', () => {
    it('Timeline_Time_IsATimeElementWithTheInstantTheDateAndHourInRomeAndHowLongAgo', () => {
      renderTimeline();

      const paid = screen.getByText('Pagamento ricevuto').closest('li') as HTMLElement;
      const time = paid.querySelector('time') as HTMLElement;
      expect(time).toHaveAttribute('datetime', '2026-10-16T09:30:00.000Z');
      // 09:30 UTC is 11:30 in Rome; two and a half hours before the frozen "now".
      expect(time).toHaveTextContent('16 ott, 11:30 · 2 ore fa');
    });

    it('Timeline_OlderThanAWeek_ShowsTheDateAlone', () => {
      renderTimeline({ events: [{ id: 'old', at: '2026-09-01T09:30:00Z', title: 'Molto prima' }] });

      expect(screen.getByText('Molto prima').closest('li')?.querySelector('time')).toHaveTextContent(/^1 set, 11:30$/);
    });

    it('Timeline_TheRelativeTime_FollowsTheClockEveryMinute', () => {
      vi.useRealTimers();
      vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
      vi.setSystemTime(new Date(NOW));
      renderTimeline({ events: [{ id: 'now', at: '2026-10-16T11:59:40Z', title: 'Appena successo' }] });
      expect(screen.getByText('Appena successo').closest('li')?.querySelector('time')).toHaveTextContent('ora');

      act(() => {
        vi.advanceTimersByTime(3 * 60_000);
      });

      expect(screen.getByText('Appena successo').closest('li')?.querySelector('time')).toHaveTextContent('3 minuti fa');
    });
  });

  describe('tone', () => {
    it.each([
      ['danger', 'Problema'],
      ['warning', 'Attenzione'],
      ['success', 'Completato'],
      ['info', 'Informazione'],
    ] as const)('Timeline_Tone%s_IsColorIconAndAWordForAScreenReader', (tone, word) => {
      renderTimeline({ events: [{ id: 't', at: NOW, title: 'Accaduto', tone }] });

      const item = screen.getByRole('listitem');
      expect(item).toHaveAttribute('data-tone', tone);
      expect(item.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(item.querySelector('[class*="ring-"]')?.className).toContain(`bg-${tone}-soft`);
      expect(within(item).getByText(`${word}:`, { exact: false })).toHaveClass('sr-only');
      expect(item).toHaveTextContent(`${word}: Accaduto`);
    });

    it('Timeline_NoTone_IsNeutralAndAddsNoWord', () => {
      renderTimeline({ events: [{ id: 't', at: NOW, title: 'Accaduto' }] });

      const item = screen.getByRole('listitem');
      expect(item).toHaveAttribute('data-tone', 'neutral');
      expect(item.querySelector('.sr-only')).toBeNull();
    });

    it('Timeline_Icon_ReplacesTheIconOfTheTone', () => {
      const { container } = renderTimeline({ events: [{ id: 't', at: NOW, title: 'Intervento', tone: 'info', icon: Wrench }] });

      expect(container.querySelector('svg.lucide-wrench')).toBeInTheDocument();
      expect(container.querySelector('svg.lucide-info')).not.toBeInTheDocument();
    });

    it('Timeline_ToneWords_ExistInBothLanguages', () => {
      for (const tone of ['danger', 'info', 'success', 'warning']) {
        expect(italian.detailDrawer.timeline.tone).toHaveProperty(tone);
        expect(english.detailDrawer.timeline.tone).toHaveProperty(tone);
      }
    });
  });

  describe('links', () => {
    it('Timeline_Href_MakesTheTitleALinkToThePageOfTheApp', () => {
      renderTimeline({ events: [{ id: 'p', at: NOW, title: 'Pagamento ricevuto', href: '/app/short-rent/payments/p-1' }] });

      expect(screen.getByRole('link', { name: 'Pagamento ricevuto' })).toHaveAttribute('href', '/app/short-rent/payments/p-1');
    });

    it('Timeline_LinkTitle_IsUnderlinedAtRestAndPaddedToAFingerOnATouchScreen', () => {
      renderTimeline({ events: [{ id: 'p', at: NOW, title: 'Pagamento ricevuto', href: '/app/short-rent/payments/p-1' }] });

      expect(screen.getByRole('link', { name: 'Pagamento ricevuto' })).toHaveClass('underline', 'pointer-coarse:py-2.5');
    });

    // A tab or a newline is dropped by the browser when it reads an address: '/' + TAB + '/evil.example' is '//evil.example' to it.
    it.each(['javascript:alert(1)', '//evil.example/x', 'https://evil.example', '/\\evil.example', 'payments/1', '/\t/evil.example', '/\n/evil.example', '/\r/evil.example', '/app/\u0000x'])(
      'Timeline_Href%j_IsNotMadeALinkBecauseItIsNotAPageOfTheApp',
      (href) => {
        renderTimeline({ events: [{ id: 'p', at: NOW, title: 'Pagamento ricevuto', href }] });

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('Pagamento ricevuto')).toBeInTheDocument();
      },
    );
  });

  describe('nothing yet', () => {
    it('Timeline_NoEvents_SaysSoInsteadOfDrawingAnEmptyList', () => {
      renderTimeline({ events: [] });

      expect(screen.queryByRole('list')).not.toBeInTheDocument();
      expect(screen.getByText('Ancora nessun evento.')).toBeInTheDocument();
    });

    it('Timeline_NoEvents_CanSayItInItsOwnWords', () => {
      renderTimeline({ events: [], emptyText: 'Nessun movimento su questa prenotazione.' });

      expect(screen.getByText('Nessun movimento su questa prenotazione.')).toBeInTheDocument();
    });
  });

  describe('show more', () => {
    it('Timeline_MoreThanTheLimit_ShowsTheFirstOnesAndAButtonThatSaysHowManyAreLeft', () => {
      renderTimeline({ events: numbered(8), limit: 3 });

      expect(titles()).toEqual(['Evento 1', 'Evento 2', 'Evento 3']);
      expect(screen.getByRole('button', { name: 'Mostra altri 3 eventi' })).toBeInTheDocument();
    });

    it('Timeline_ShowMore_AddsAnotherLimitAndGoesOnUntilThereIsNothingLeft', () => {
      renderTimeline({ events: numbered(8), limit: 3 });

      fireEvent.click(screen.getByRole('button', { name: 'Mostra altri 3 eventi' }));
      expect(screen.getAllByRole('listitem')).toHaveLength(6);

      fireEvent.click(screen.getByRole('button', { name: 'Mostra altri 2 eventi' }));
      expect(screen.getAllByRole('listitem')).toHaveLength(8);
      expect(screen.queryByTestId('timeline-show-more')).not.toBeInTheDocument();
    });

    it('Timeline_OneEventLeft_SaysItInTheSingular', () => {
      renderTimeline({ events: numbered(4), limit: 3 });

      expect(screen.getByRole('button', { name: 'Mostra 1 altro evento' })).toBeInTheDocument();
    });

    it('Timeline_ShowMore_PutsTheFocusOnTheFirstEventThatWasAddedSoTheKeyboardDoesNotStartOver', () => {
      renderTimeline({ events: numbered(8), limit: 3 });

      fireEvent.click(screen.getByRole('button', { name: 'Mostra altri 3 eventi' }));

      expect(screen.getAllByRole('listitem')[3]).toHaveFocus();
      expect(screen.getAllByRole('listitem')[3]).toHaveTextContent('Evento 4');
    });

    it('Timeline_ShowMoreTwice_MovesTheFocusToTheFirstOfTheNewOnesEachTime', () => {
      renderTimeline({ events: numbered(8), limit: 3 });

      fireEvent.click(screen.getByRole('button', { name: 'Mostra altri 3 eventi' }));
      fireEvent.click(screen.getByRole('button', { name: 'Mostra altri 2 eventi' }));

      expect(screen.getAllByRole('listitem')[6]).toHaveFocus();
    });

    it('Timeline_ByDefault_ShowsFiveAndKeepsTheRestBehindAButton', () => {
      renderTimeline({ events: numbered(12) });

      expect(screen.getAllByRole('listitem')).toHaveLength(5);
      expect(screen.getByRole('button', { name: 'Mostra altri 5 eventi' })).toBeInTheDocument();
    });

    it('Timeline_LimitInfinity_ShowsEverythingAtOnce', () => {
      renderTimeline({ events: numbered(12), limit: Infinity });

      expect(screen.getAllByRole('listitem')).toHaveLength(12);
      expect(screen.queryByTestId('timeline-show-more')).not.toBeInTheDocument();
    });

    it('Timeline_ShowMoreButton_IsAFingerSizedTarget', () => {
      renderTimeline({ events: numbered(8), limit: 3 });

      expect(screen.getByTestId('timeline-show-more')).toHaveClass('pointer-coarse:min-h-11');
    });
  });

  describe('accessibility', () => {
    it('Timeline_WithEveryTone_HasNoAxeViolations', async () => {
      const { container } = renderTimeline({
        events: [
          ...EVENTS,
          { id: 'bad', at: '2026-10-16T10:00:00Z', title: 'Pagamento rifiutato', tone: 'danger', href: '/app/short-rent/payments/p-9' },
          { id: 'warn', at: '2026-10-16T08:00:00Z', title: 'Scade domani', tone: 'warning', icon: Wrench },
          ...numbered(7),
        ],
        limit: 4,
      });

      await expectNoAxeViolations(container);
    });

    it('Timeline_Empty_HasNoAxeViolations', async () => {
      const { container } = renderTimeline({ events: [] });

      await expectNoAxeViolations(container);
    });
  });
});
