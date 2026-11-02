import { describe, it, expect } from 'vitest';
import type { ServiceRequest } from '@/types/service-request';
import { groupRequests, isToFollow, lastStep } from '../request-list';

function request(overrides: Partial<ServiceRequest>): ServiceRequest {
  return {
    id: 'sr-1',
    orgId: 'org-1',
    bookingId: 'b-1',
    propertyId: 'p-1',
    supplierOrgId: 'sup-1',
    category: 'cleaning',
    urgency: 'Normal',
    status: 'Richiesto',
    chargeToGuest: false,
    createdAt: '2026-09-20T08:00:00Z',
    updatedAt: '2026-09-20T08:00:00Z',
    ...overrides,
  };
}

const ids = (requests: readonly ServiceRequest[]) => requests.map((r) => r.id);

describe('groupRequests (supplier requests of a stay)', () => {
  it('groupRequests_OpenAndOverRequests_KeepsTheOpenOnesInTheListAndTheOthersApart', () => {
    const requests = [
      request({ id: 'new', status: 'Richiesto' }),
      request({ id: 'taken', status: 'PresoInCarico' }),
      request({ id: 'working', status: 'InCorso' }),
      request({ id: 'toPay', status: 'Completato' }),
      request({ id: 'paid', status: 'Pagato' }),
      request({ id: 'cancelled', status: 'Annullato' }),
    ];

    const { toFollow, closed } = groupRequests(requests);

    expect(ids(toFollow).sort()).toEqual(['new', 'taken', 'toPay', 'working']);
    expect(ids(closed).sort()).toEqual(['cancelled', 'paid']);
  });

  it('groupRequests_RefusedRequestNobodyAskedAgain_StaysToFollowBecauseTheHostHasToDecide', () => {
    const refused = request({ id: 'refused', status: 'Rifiutato' });

    expect(ids(groupRequests([refused]).toFollow)).toEqual(['refused']);
  });

  it('groupRequests_RefusedRequestAskedOfAnotherSupplier_IsOver', () => {
    const refused = request({ id: 'refused', status: 'Rifiutato' });
    const again = request({ id: 'again', supplierOrgId: 'sup-2', createdAt: '2026-09-21T08:00:00Z' });

    const { toFollow, closed } = groupRequests([again, refused]);

    expect(ids(toFollow)).toEqual(['again']);
    expect(ids(closed)).toEqual(['refused']);
  });

  it('groupRequests_ToFollow_NearestJobFirstThenTheOnesWithoutATimeNewestFirst', () => {
    const requests = [
      request({ id: 'noTimeOld', createdAt: '2026-09-01T08:00:00Z' }),
      request({ id: 'later', scheduledStart: '2026-10-20T10:00:00Z' }),
      request({ id: 'noTimeNew', createdAt: '2026-09-10T08:00:00Z' }),
      request({ id: 'sooner', scheduledStart: '2026-10-05T10:00:00Z' }),
    ];

    expect(ids(groupRequests(requests).toFollow)).toEqual(['sooner', 'later', 'noTimeNew', 'noTimeOld']);
  });

  it('groupRequests_Closed_LastClosedFirstWhateverTheOrderOfTheAnswer', () => {
    const cancelledAt = (id: string, at: string) =>
      request({
        id,
        status: 'Annullato',
        history: [
          { status: 'Richiesto', at: '2026-09-01T08:00:00Z', actor: 'Host' },
          { status: 'Annullato', at, actor: 'Supplier' },
        ],
      });
    const requests = [
      cancelledAt('middle', '2026-09-10T08:00:00Z'),
      cancelledAt('last', '2026-09-30T08:00:00Z'),
      cancelledAt('first', '2026-09-02T08:00:00Z'),
    ];

    expect(ids(groupRequests(requests).closed)).toEqual(['last', 'middle', 'first']);
  });

  it('groupRequests_NoRequests_BothPartsAreEmpty', () => {
    expect(groupRequests([])).toEqual({ toFollow: [], closed: [] });
  });

  it('groupRequests_ListOfTheAnswer_IsNotReordered', () => {
    const requests = [request({ id: 'b', status: 'Pagato' }), request({ id: 'a', status: 'Richiesto' })];

    groupRequests(requests);

    expect(ids(requests)).toEqual(['b', 'a']);
  });
});

describe('isToFollow', () => {
  it.each(['Richiesto', 'PresoInCarico', 'InCorso', 'Completato'] as const)('isToFollow_%sRequest_IsTrue', (status) => {
    const open = request({ status });

    expect(isToFollow(open, [open])).toBe(true);
  });

  it.each(['Pagato', 'Annullato'] as const)('isToFollow_%sRequest_IsFalse', (status) => {
    const over = request({ status });

    expect(isToFollow(over, [over])).toBe(false);
  });
});

describe('lastStep', () => {
  it('lastStep_RequestWithHistory_IsTheLastStepOfTheHistory', () => {
    const cancelled = request({
      status: 'Annullato',
      history: [
        { status: 'Richiesto', at: '2026-09-01T08:00:00Z', actor: 'Host' },
        { status: 'Annullato', at: '2026-09-02T09:30:00Z', actor: 'System' },
      ],
    });

    expect(lastStep(cancelled)).toEqual({ at: '2026-09-02T09:30:00Z', actor: 'System' });
  });

  it('lastStep_CancelledWithoutHistory_UsesTheDatesAndTheAuthorTheRequestKeeps', () => {
    const cancelled = request({ status: 'Annullato', cancelledAt: '2026-09-03T10:00:00Z', cancelledBy: 'Host' });

    expect(lastStep(cancelled)).toEqual({ at: '2026-09-03T10:00:00Z', actor: 'Host' });
  });

  it('lastStep_PaidWithoutHistory_UsesThePaymentDate', () => {
    const paid = request({ status: 'Pagato', paidAt: '2026-09-04T10:00:00Z' });

    expect(lastStep(paid)).toEqual({ at: '2026-09-04T10:00:00Z', actor: null });
  });

  it('lastStep_NothingElse_FallsBackOnTheLastUpdate', () => {
    expect(lastStep(request({ status: 'Rifiutato', updatedAt: '2026-09-05T10:00:00Z' }))).toEqual({
      at: '2026-09-05T10:00:00Z',
      actor: null,
    });
  });
});
