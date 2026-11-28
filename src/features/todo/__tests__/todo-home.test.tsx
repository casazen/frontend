import { describe, expect, it } from 'vitest';
import type { TodoActivity } from '@/api/internal-activities.api';
import { TODO_LIST_LIMIT, countUrgent, urgentCountOf } from '../lib/todo-model';

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

const LIST: TodoActivity[] = [
  todo({ id: 'one', activityType: 'AlloggiatiDeadline', action: 'UploadAlloggiatiProof', urgency: 'High', dueAt: '2000-01-01T10:00:00Z' }),
  todo({ id: 'two', activityType: 'ReceiptToRetrieve', action: 'UploadAlloggiatiProof', urgency: 'Low', dueAt: '2099-01-10T10:00:00Z', propertyId: 'p-2' }),
  todo({ id: 'three', activityType: 'FiscalDocument', action: 'ReviewBooking', urgency: 'High', dueAt: '2099-03-01T10:00:00Z' }),
  todo({ id: 'four', activityType: 'MessageToApprove', action: 'ApproveAiDraft', urgency: 'Medium', dueAt: null }),
  todo({ id: 'five', activityType: 'CheckOutPending', action: 'CompleteCheckOut', urgency: 'Low', dueAt: null }),
];

describe('the urgent count of the To do list (NF-07, ADR-026-R8)', () => {
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
