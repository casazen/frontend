import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { TodoActivity } from '@/api/internal-activities.api';
import { TodoFocusBlock } from '../focus-block';
import { countUrgent } from '../lib/todo-model';
import { TodoTodayList } from '../today-list';

const NAMES = new Map([
  ['p-1', 'Casa Mare'],
  ['p-2', 'Villa Monti'],
]);

function todo(overrides: Partial<TodoActivity> & { id: string }): TodoActivity {
  return {
    activityType: 'CheckInPending',
    action: 'StartCheckIn',
    entityType: 'Booking',
    entityId: 'b-1',
    propertyId: 'p-1',
    dueAt: '2099-01-20T10:00:00Z',
    urgency: 'Medium',
    reason: null,
    createdAt: '2026-11-01T08:00:00Z',
    ...overrides,
  };
}

/** The array of the server: the first is the most urgent, and the later ones are not sorted again by the Home. */
const LIST: TodoActivity[] = [
  todo({ id: 'one', activityType: 'AlloggiatiDeadline', action: 'UploadAlloggiatiProof', urgency: 'High', dueAt: '2000-01-01T10:00:00Z' }),
  todo({ id: 'two', activityType: 'ReceiptToRetrieve', action: 'UploadAlloggiatiProof', urgency: 'Low', dueAt: '2099-01-10T10:00:00Z', propertyId: 'p-2' }),
  todo({ id: 'three', activityType: 'FiscalDocument', action: 'ReviewBooking', urgency: 'High', dueAt: '2099-03-01T10:00:00Z' }),
  todo({ id: 'four', activityType: 'MessageToApprove', action: 'ApproveAiDraft', urgency: 'Medium', dueAt: null }),
  todo({ id: 'five', activityType: 'CheckOutPending', action: 'CompleteCheckOut', urgency: 'Low', dueAt: null }),
];

function wrap(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('the To do list on the Home (NF-07, ADR-026-R8)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  describe('TodoFocusBlock', () => {
    it('TodoFocusBlock_FirstItem_SaysWhatWhereByWhenAndOffersDoNow', () => {
      wrap(<TodoFocusBlock activity={LIST[0]} others={4} propertyNames={NAMES} />);

      const block = screen.getByTestId('home-todo-focus');
      expect(within(block).getByRole('heading', { level: 2 })).toHaveTextContent('Alloggiati Web in scadenza');
      expect(block).toHaveTextContent('Adesso');
      expect(block).toHaveTextContent('Prenotazione · Casa Mare');
      expect(block).toHaveTextContent('Gli ospiti vanno comunicati alla Questura entro la scadenza.');
      // The deadline of the item has passed: said in words, and the block is in the tone of what cannot wait.
      expect(block).toHaveTextContent(/Scaduta: /);
      expect(block).toHaveAttribute('data-tone', 'danger');
      expect(screen.getByTestId('home-todo-do-now')).toHaveAttribute('href', '/app/short-rent/alloggiati');
      expect(screen.getByTestId('home-todo-all')).toHaveAttribute('href', '/app/short-rent/activities');
    });

    it('TodoFocusBlock_OtherItemsWaiting_SaysHowManyAreAfterIt', () => {
      wrap(<TodoFocusBlock activity={LIST[0]} others={4} propertyNames={NAMES} />);

      expect(screen.getByTestId('home-todo-focus')).toHaveTextContent('Poi: altre 4 attività');
    });

    it('TodoFocusBlock_LastItem_SaysNothingAfterIt', () => {
      wrap(<TodoFocusBlock activity={LIST[0]} others={0} propertyNames={NAMES} />);

      expect(screen.getByTestId('home-todo-focus')).not.toHaveTextContent('Poi:');
    });

    it('TodoFocusBlock_UrgentItemStillInTime_IsAWarningAndNotAnAlarm', () => {
      wrap(<TodoFocusBlock activity={LIST[2]} others={0} propertyNames={NAMES} />);

      expect(screen.getByTestId('home-todo-focus')).toHaveAttribute('data-tone', 'warning');
    });

    it('TodoFocusBlock_ItemWithoutDeadlineAndNotUrgent_IsInTheAccentOfTheArea', () => {
      wrap(<TodoFocusBlock activity={LIST[3]} others={0} propertyNames={NAMES} />);

      expect(screen.getByTestId('home-todo-focus')).toHaveAttribute('data-tone', 'neutral');
    });

    it('TodoFocusBlock_PersonWhoCannotOpenThePage_GetsTheWayToTheListInstead', () => {
      wrap(<TodoFocusBlock activity={LIST[0]} others={1} propertyNames={NAMES} hasPermission={() => false} />);

      expect(screen.queryByTestId('home-todo-do-now')).not.toBeInTheDocument();
      expect(screen.getByTestId('home-todo-all')).toHaveAttribute('href', '/app/short-rent/activities');
    });
  });

  describe('TodoTodayList', () => {
    it('TodoTodayList_Items_AreListedInTheOrderOfTheArrayAndNotRegroupedByDay', () => {
      // `two` is due before `three` but the server put `three` (urgent) after it only because of the order it sent: the Home keeps it.
      wrap(<TodoTodayList items={[LIST[2], LIST[1]]} total={5} urgent={2} propertyNames={NAMES} />);

      const rows = within(screen.getByTestId('home-todo-rows')).getAllByRole('listitem');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('Documento fiscale da sistemare');
      expect(rows[1]).toHaveTextContent('Ricevuta da recuperare');
      // Each row says its urgency in words.
      expect(rows[0]).toHaveTextContent('Urgente');
      expect(rows[1]).toHaveTextContent('Quando puoi');
    });

    it('TodoTodayList_Summary_ShowsTheCountOfTheUrgentItemsAndTheWayToTheWholeList', () => {
      wrap(<TodoTodayList items={LIST.slice(1)} total={LIST.length} urgent={countUrgent(LIST)} propertyNames={NAMES} />);

      const summary = screen.getByTestId('home-todo-summary');
      expect(within(summary).getByTestId('home-todo-counts')).toHaveTextContent('5 attività da fare');
      expect(within(summary).getByTestId('home-todo-urgent')).toHaveTextContent('2 urgenti');
      expect(within(summary).getByTestId('home-todo-see-all')).toHaveAttribute('href', '/app/short-rent/activities');
    });

    it('TodoTodayList_NothingUrgent_SaysNothingAboutUrgency', () => {
      wrap(<TodoTodayList items={[LIST[1]]} total={2} urgent={0} propertyNames={NAMES} />);

      expect(screen.queryByTestId('home-todo-urgent')).not.toBeInTheDocument();
    });

    it('TodoTodayList_MoreItemsThanTheHomeHolds_ShowsTheFirstFewAndCountsTheRest', () => {
      wrap(<TodoTodayList items={LIST} total={LIST.length} urgent={2} propertyNames={NAMES} />);

      expect(within(screen.getByTestId('home-todo-rows')).getAllByRole('listitem')).toHaveLength(3);
      expect(screen.getByTestId('home-todo-more')).toHaveTextContent('E altre 2 nell\'elenco completo.');
    });

    it('TodoTodayList_Row_OffersDoNowToThePageWhereTheItemIsDone', () => {
      wrap(<TodoTodayList items={[LIST[3]]} total={2} urgent={0} propertyNames={NAMES} />);

      expect(screen.getByRole('link', { name: /^Fallo ora/ })).toHaveAttribute('href', '/app/short-rent/approval-queue');
    });

    it('TodoTodayList_RowWhosePageThePersonCannotOpen_LeadsToTheList', () => {
      wrap(<TodoTodayList items={[LIST[3]]} total={2} urgent={0} propertyNames={NAMES} hasPermission={() => false} />);

      expect(screen.queryByRole('link', { name: /^Fallo ora/ })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Messaggio da approvare/ })).toHaveAttribute('href', '/app/short-rent/activities');
    });

    it('TodoTodayList_NothingAfterTheFocusedItem_SaysSo', () => {
      wrap(<TodoTodayList items={[]} total={1} urgent={1} propertyNames={NAMES} />);

      expect(screen.getByTestId('home-todo-nothing-else')).toBeInTheDocument();
      expect(screen.getByTestId('home-todo-urgent')).toHaveTextContent('1 urgente');
    });
  });

  describe('countUrgent', () => {
    it('countUrgent_Items_CountsOnlyHigh_LikeTheNavBadge', () => {
      expect(countUrgent(LIST)).toBe(2);
      expect(countUrgent([])).toBe(0);
    });
  });
});
