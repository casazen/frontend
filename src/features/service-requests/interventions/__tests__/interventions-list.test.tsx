import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { LIST_MAX_DEFAULT_COLUMNS, type ListMenuEntry } from '@/components/shared/list-view/list-types';
import type { ServiceRequest } from '@/types/service-request';
import { INTERVENTION_CHIPS, type HostPermissions } from '../intervention-model';
import { useInterventionsList } from '../interventions-list';
import type { InterventionSteps } from '../use-intervention-actions';

const steps: InterventionSteps = {
  remind: vi.fn(),
  acceptProposal: vi.fn(),
  rejectProposal: vi.fn(),
  confirmAmount: vi.fn(),
  markPaid: vi.fn(),
  pay: vi.fn(),
  cancel: vi.fn(),
};

const MANAGER: HostPermissions = { canManage: true, canRequest: true };
const COLLABORATOR: HostPermissions = { canManage: false, canRequest: true };
const READER: HostPermissions = { canManage: false, canRequest: false };

function request(overrides: Partial<ServiceRequest>): ServiceRequest {
  return {
    id: 'sr-1',
    orgId: 'org-1',
    propertyId: 'prop-1',
    propertyName: 'Casa del Lago',
    supplierOrgId: 'sup-1',
    supplierName: 'Idraulica Rossi',
    category: 'plumbing',
    urgency: 'Normal',
    status: 'Richiesto',
    chargeToGuest: false,
    createdAt: '2026-10-20T08:00:00Z',
    updatedAt: '2026-10-20T08:00:00Z',
    hostAction: { kind: 'none' },
    availableActions: [],
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

function listFor(permissions: HostPermissions) {
  return renderHook(() => useInterventionsList({ steps, busy: false, permissions, properties: [], suppliers: [], categories: [] }), { wrapper }).result.current;
}

const idsOf = (entries: readonly ListMenuEntry[]) => entries.filter((entry) => entry !== 'separator').map((entry) => entry.id);

describe('useInterventionsList (SR-08)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('useInterventionsList_Definition_HasAtMostFiveColumnsAndTheChipsOfTheApi', () => {
    const list = listFor(MANAGER);

    expect(list.columns.filter((column) => column.default || column.always)).toHaveLength(LIST_MAX_DEFAULT_COLUMNS);
    expect((list.chips ?? []).map((chip) => chip.id)).toEqual([...INTERVENTION_CHIPS]);
  });

  it.each([
    ['remind', 'Sollecita', 'remind'],
    ['acceptProposal', "Accetta l'orario", 'acceptProposal'],
    ['confirmFinalAmount', "Conferma l'importo", 'confirmAmount'],
    ['pay', 'Paga', 'pay'],
    ['markPaid', 'Segna pagato', 'markPaid'],
  ] as const)('useInterventionsList_%sFromTheServer_IsTheOneActionOfTheRow', (kind, label, step) => {
    const row = request({ hostAction: { kind } });

    const action = listFor(MANAGER).primaryAction?.(row);
    action?.onSelect?.();

    expect(action?.label).toBe(label);
    expect(steps[step]).toHaveBeenCalledWith(row);
  });

  it('useInterventionsList_ReminderSentRecently_ShowsWhenItCanBeDoneAgainAndCannotBePressed', () => {
    const inTwoHoursAndAHalf = new Date(Date.now() + 150 * 60_000).toISOString();

    const action = listFor(MANAGER).primaryAction?.(request({ hostAction: { kind: 'none', remindAvailableAt: inTwoHoursAndAHalf } }));

    expect(action?.label).toBe('Puoi sollecitare tra 3 ore');
    expect(action?.disabled).toBe(true);
    expect(action?.onSelect).toBeUndefined();
  });

  it('useInterventionsList_WordTheVersionDoesNotKnow_IsNoButton', () => {
    expect(listFor(MANAGER).primaryAction?.(request({ hostAction: { kind: 'respondToQuote' } }))).toBeNull();
  });

  it('useInterventionsList_CollaboratorWithoutPropertyWrite_HasNoPayRemindOrAnswerButtonButMayMarkPaid', () => {
    const list = listFor(COLLABORATOR);

    for (const kind of ['remind', 'acceptProposal', 'confirmFinalAmount', 'pay'] as const) {
      expect(list.primaryAction?.(request({ hostAction: { kind } })), kind).toBeNull();
    }
    expect(list.primaryAction?.(request({ hostAction: { kind: 'markPaid' } }))?.label).toBe('Segna pagato');
  });

  it('useInterventionsList_PersonWhoOnlyReads_HasNoButtonAtAll', () => {
    const list = listFor(READER);

    for (const kind of ['remind', 'acceptProposal', 'confirmFinalAmount', 'pay', 'markPaid', 'requestAgain'] as const) {
      expect(list.primaryAction?.(request({ hostAction: { kind } })), kind).toBeNull();
    }
    expect(list.empty.action).toBeUndefined();
  });

  it('useInterventionsList_Menu_CancelsOnlyWhatTheServerSaysCanBeCancelledAndOnlyForWhoMayManage', () => {
    const cancellable = request({ availableActions: ['remind', 'cancel'], supplierContact: { phone: '+39 02 1234567' } });
    const over = request({ status: 'Pagato', availableActions: ['requestAgain'] });

    expect(idsOf(listFor(MANAGER).menu?.(cancellable) ?? [])).toEqual(['page', 'call', 'cancel']);
    expect(idsOf(listFor(MANAGER).menu?.(over) ?? [])).toEqual(['page']);
    expect(idsOf(listFor(COLLABORATOR).menu?.(cancellable) ?? [])).toEqual(['page', 'call']);
  });
});
