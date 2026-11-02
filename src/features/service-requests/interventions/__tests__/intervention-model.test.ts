import { describe, expect, it } from 'vitest';
import type { ListState } from '@/components/shared/list-view/list-state';
import { currentInterventionsSearch, hostActionKind, INTERVENTION_CHIPS, interventionListParams, mayDo, readBookingId } from '../intervention-model';

const state = (overrides: Partial<ListState> = {}): ListState => ({ q: '', chip: 'all', filters: {}, sort: null, columns: null, layout: 'list', page: 1, ...overrides });

describe('the list of the interventions asks the server (SR-08)', () => {
  it('interventionListParams_ChipAndFilters_AreWhatTheServerIsAsked', () => {
    const params = interventionListParams(
      state({ chip: 'topay', q: 'idraulico', page: 3, filters: { property: 'p1', supplier: 's1', type: 'plumbing', date: '2026-10-01..2026-10-31' } }),
    );

    expect(params).toEqual({
      view: 'topay',
      q: 'idraulico',
      propertyId: 'p1',
      supplierOrgId: 's1',
      category: 'plumbing',
      from: '2026-10-01',
      to: '2026-10-31',
      sort: 'scheduled:desc',
      page: 3,
      pageSize: 20,
    });
  });

  it('interventionListParams_EveryChip_IsAViewOfTheApi', () => {
    for (const chip of INTERVENTION_CHIPS) expect(interventionListParams(state({ chip })).view).toBe(chip);
    // An address with a chip that does not exist opens the plain list.
    expect(interventionListParams(state({ chip: 'nope' })).view).toBe('all');
  });

  it('currentInterventionsSearch_OldLinks_BecomeTheAddressOfTheList', () => {
    const next = currentInterventionsSearch(new URLSearchParams('status=Completato&propertyId=p1'));

    expect(next?.get('chip')).toBe('topay');
    expect(next?.get('f_property')).toBe('p1');
    expect(currentInterventionsSearch(new URLSearchParams('chip=topay&bookingId=b1'))).toBeNull();
  });

  it('readBookingId_OnlyAnIdTheApiCanRead_NarrowsTheList', () => {
    const id = '3f2a9c1e-7b1d-4c3a-9e2f-0a1b2c3d4e5f';

    expect(readBookingId(new URLSearchParams(`bookingId=${id}`))).toBe(id);
    expect(readBookingId(new URLSearchParams('bookingId=not-an-id'))).toBeUndefined();
  });
});

describe('what the host may do (SR-08, decision SR-D30)', () => {
  const collaborator = { canManage: false, canRequest: true };
  const manager = { canManage: true, canRequest: true };
  const reader = { canManage: false, canRequest: false };

  it('mayDo_CollaboratorWithoutPropertyWrite_CannotRemindAnswerPayOrCancel', () => {
    for (const action of ['remind', 'acceptProposal', 'rejectProposal', 'confirmFinalAmount', 'pay', 'cancel']) {
      expect(mayDo(action, collaborator), action).toBe(false);
      expect(mayDo(action, manager), action).toBe(true);
    }
  });

  it('mayDo_ServiceRequestWrite_IsWhatMarksPaidAndRequestsAgain', () => {
    expect(mayDo('markPaid', collaborator)).toBe(true);
    expect(mayDo('requestAgain', collaborator)).toBe(true);
    expect(mayDo('markPaid', reader)).toBe(false);
  });

  it('hostActionKind_WordTheVersionDoesNotKnow_IsNothingToDo', () => {
    expect(hostActionKind({ hostAction: { kind: 'respondToQuote' } })).toBe('none');
    expect(hostActionKind({ hostAction: { kind: 'pay' } })).toBe('pay');
    expect(hostActionKind({})).toBe('none');
  });
});
