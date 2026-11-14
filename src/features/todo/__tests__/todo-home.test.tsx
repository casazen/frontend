import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { TodoActivity } from '@/api/internal-activities.api';
import { TODO_LIST_LIMIT, countUrgent, urgentCountOf } from '../lib/todo-model';
import { TodoPath } from '../todo-path';

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

function steps() {
  return within(screen.getByTestId('home-todo-steps')).getAllByRole('listitem');
}

describe('the To do list on the Home as a road (NF-07, ADR-026-R8)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('TodoPath_FirstItem_IsTheStepToDoNowWithWhatWhereWhyByWhenAndDoNow', () => {
    wrap(<TodoPath items={LIST} urgent={2} propertyNames={NAMES} />);

    const [first] = steps();
    expect(first).toHaveAttribute('aria-current', 'step');
    expect(first).toHaveTextContent('Adesso');
    expect(first).toHaveTextContent('Alloggiati Web in scadenza');
    expect(first).toHaveTextContent('Prenotazione · Casa Mare');
    expect(first).toHaveTextContent('Gli ospiti vanno comunicati alla Questura entro la scadenza.');
    // The deadline has passed: said in words on its note, never by painting the whole step.
    expect(first).toHaveTextContent(/Scaduta: /);
    expect(within(first).getByText(/Scaduta: /).closest('p')).toHaveClass('text-danger-foreground');
    expect(screen.getByTestId('home-todo-path').className).not.toMatch(/bg-danger/);
    expect(screen.getByTestId('home-todo-do-now')).toHaveAttribute('href', '/app/short-rent/alloggiati');
  });

  it('TodoPath_Items_KeepTheOrderOfTheArrayAndOnlyTheFirstIsCurrent', () => {
    wrap(<TodoPath items={[LIST[2], LIST[1]]} urgent={2} propertyNames={NAMES} />);

    const rows = steps();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Documento fiscale da sistemare');
    expect(rows[1]).toHaveTextContent('Ricevuta da recuperare');
    expect(rows[1]).not.toHaveAttribute('aria-current');
    expect(rows[1]).toHaveTextContent('(da fare)');
  });

  it('TodoPath_NoFocus_ListsTheRoadWithNoCurrentStep', () => {
    // What carries a risk of a sanction holds the one highlight of the Home: the road has no step to do now of its own.
    wrap(<TodoPath items={LIST} urgent={2} propertyNames={NAMES} focus={false} />);

    expect(steps().some((row) => row.getAttribute('aria-current') === 'step')).toBe(false);
    expect(screen.getByTestId('home-todo-path')).not.toHaveTextContent('Adesso');
  });

  it('TodoPath_Summary_ShowsTheCountOfTheUrgentItemsAndTheWayToTheWholeList', () => {
    wrap(<TodoPath items={LIST} urgent={countUrgent(LIST)} propertyNames={NAMES} />);

    expect(screen.getByTestId('home-todo-counts')).toHaveTextContent('5 attività da fare');
    expect(screen.getByTestId('home-todo-urgent')).toHaveTextContent('2 urgenti');
    expect(screen.getByTestId('home-todo-see-all')).toHaveAttribute('href', '/app/short-rent/activities');
  });

  it('TodoPath_NothingUrgent_SaysNothingAboutUrgency', () => {
    wrap(<TodoPath items={[LIST[1]]} urgent={0} propertyNames={NAMES} />);

    expect(screen.queryByTestId('home-todo-urgent')).not.toBeInTheDocument();
  });

  it('TodoPath_MoreItemsThanTheHomeHolds_ShowsTheFirstFourAndCountsTheRest', () => {
    wrap(<TodoPath items={LIST} urgent={2} propertyNames={NAMES} />);

    expect(steps()).toHaveLength(4);
    expect(screen.getByTestId('home-todo-more')).toHaveTextContent("E un'altra nell'elenco completo.");
  });

  it('TodoPath_Step_OffersDoNowToThePageWhereTheItemIsDone', () => {
    wrap(<TodoPath items={[LIST[3]]} urgent={0} propertyNames={NAMES} />);

    expect(screen.getByRole('link', { name: /^Fallo ora/ })).toHaveAttribute('href', '/app/short-rent/approval-queue');
  });

  it('TodoPath_StepWhosePageThePersonCannotOpen_LeadsToTheList', () => {
    wrap(<TodoPath items={[LIST[3]]} urgent={0} propertyNames={NAMES} hasPermission={() => false} />);

    expect(screen.queryByRole('link', { name: /^Fallo ora/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Apri: Messaggio da approvare/ })).toHaveAttribute('href', '/app/short-rent/activities');
  });

  it('TodoPath_ListCutByTheServer_SaysTheFirstOnesAndNoTotalNorUrgentCountItDoesNotKnow', () => {
    // 50 is the most the server sends: there may be more behind them, so the line is no total and does not count the rest either.
    const cut = Array.from({ length: TODO_LIST_LIMIT }, (_, index) => todo({ id: `cut-${index}` }));
    wrap(<TodoPath items={cut} urgent={null} propertyNames={NAMES} />);

    expect(screen.getByTestId('home-todo-counts')).toHaveTextContent('Le prime 50 attività da fare');
    expect(screen.queryByTestId('home-todo-urgent')).not.toBeInTheDocument();
  });

  describe('countUrgent', () => {
    it('countUrgent_Items_CountsOnlyHigh_LikeTheNavBadge', () => {
      expect(countUrgent(LIST)).toBe(2);
      expect(countUrgent([])).toBe(0);
    });
  });

  describe('urgentCountOf', () => {
    const cut = Array.from({ length: TODO_LIST_LIMIT }, (_, index) => todo({ id: `cut-${index}`, urgency: 'Medium' }));

    it('urgentCountOf_NumberOfTheMenu_WinsOverTheListBecauseTheServerCutsTheList', () => {
      expect(urgentCountOf(cut, 61)).toBe(61);
      expect(urgentCountOf(LIST, 7)).toBe(7);
      expect(urgentCountOf(LIST, 0)).toBe(0);
    });

    it('urgentCountOf_NoNumberFromTheMenu_CountsTheListOnlyWhileItIsWhole', () => {
      expect(urgentCountOf(LIST, undefined)).toBe(2);
      expect(urgentCountOf(cut, undefined)).toBeNull();
    });
  });
});
