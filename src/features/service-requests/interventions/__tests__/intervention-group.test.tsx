import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { ServiceRequestGroup, ServiceRequestGroupMember } from '@/types/service-request';
import { InterventionGroup } from '../intervention-group';
import { groupStageOf, memberStateOf } from '../intervention-group-model';

const SOON = '2026-10-30T11:30:00Z';

const member = (overrides: Partial<ServiceRequestGroupMember>): ServiceRequestGroupMember => ({
  requestId: 'r-1',
  role: 'Backup',
  supplierOrgId: 'org-1',
  supplierName: 'Alfa Srl',
  status: 'Richiesto',
  tookTheJob: false,
  ...overrides,
});

const group = (overrides: Partial<ServiceRequestGroup>): ServiceRequestGroup => ({
  id: 'g-1',
  phase: 'PrimaryWindow',
  primaryDueAt: SOON,
  createdAt: '2026-10-30T10:30:00Z',
  members: [],
  ...overrides,
});

const PRIMARY = member({ requestId: 'r-primary', role: 'Primary', supplierName: 'Pulizie Rossi' });
const ALFA = member({ requestId: 'r-alfa', supplierName: 'Alfa Srl' });
const BETA = member({ requestId: 'r-beta', supplierName: 'Beta Srl' });

describe('the group of backup suppliers of a request, for its host (SP-BKP)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('groupStageOf_ByTheWindowAndTheOutcome', () => {
    expect(groupStageOf(group({ phase: 'PrimaryWindow' }))).toBe('primaryWindow');
    expect(groupStageOf(group({ phase: 'BackupWindow', backupDueAt: SOON }))).toBe('backupWindow');
    expect(groupStageOf(group({ phase: 'Closed', members: [member({ ...PRIMARY, status: 'PresoInCarico', tookTheJob: true })] }))).toBe('primaryTookIt');
    expect(
      groupStageOf(group({ phase: 'Closed', members: [member({ ...PRIMARY, role: 'ReplacedPrimary', status: 'Annullato', cancellationReason: 'NoResponse' }), member({ ...ALFA, role: 'PromotedBackup', status: 'PresoInCarico', tookTheJob: true })] })),
    ).toBe('backupTookIt');
    expect(groupStageOf(group({ phase: 'Closed', members: [member({ ...PRIMARY, status: 'Annullato', cancellationReason: 'NoResponse' })] }))).toBe('nobody');
    expect(groupStageOf(group({ phase: 'Closed', members: [member({ ...ALFA, status: 'Annullato', cancellationReason: 'RequestCancelledByHost' })] }))).toBe('cancelled');
    // A phase this version does not know is a group that is over.
    expect(groupStageOf(group({ phase: 'SomethingNew' }))).toBe('over');
  });

  it('memberStateOf_WhatEachSupplierIsDoing', () => {
    expect(memberStateOf(member({ tookTheJob: true, status: 'PresoInCarico' }))).toBe('tookTheJob');
    expect(memberStateOf(member({ acceptedAt: '2026-10-30T10:40:00Z' }))).toBe('accepted');
    expect(memberStateOf(member({}))).toBe('waiting');
    expect(memberStateOf(member({ status: 'Rifiutato' }))).toBe('refused');
    expect(memberStateOf(member({ status: 'Annullato', cancellationReason: 'PrimaryTookIt' }))).toBe('primaryTookIt');
    expect(memberStateOf(member({ status: 'Annullato', cancellationReason: 'TakenByBackup' }))).toBe('takenByBackup');
    expect(memberStateOf(member({ status: 'Annullato', cancellationReason: 'BackupSlotUnavailable' }))).toBe('slotUnavailable');
    // The backups the race closed (another one accepted first) are told apart from the ones a take closed.
    expect(memberStateOf(member({ status: 'Annullato', cancellationReason: 'BackupRaceClosed' }))).toBe('raceClosed');
    expect(memberStateOf(member({ status: 'Annullato', cancellationReason: 'Una frase scritta da una persona' }))).toBe('cancelled');
  });

  it('InterventionGroup_TheFirstBackupThatAcceptedClosedTheRace_TheHostSeesWhoIsInAndWhoWasLeftBehind', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <InterventionGroup
          group={group({
            members: [
              PRIMARY,
              member({ ...ALFA, acceptedAt: '2026-10-30T10:40:00Z' }),
              member({ ...BETA, status: 'Annullato', cancellationReason: 'BackupRaceClosed' }),
            ],
          })}
        />
      </I18nextProvider>,
    );

    const members = within(screen.getByTestId('intervention-group-members'));
    expect(members.getByTestId('intervention-group-member-r-alfa')).toHaveTextContent('Ha accettato come riserva');
    expect(members.getByTestId('intervention-group-member-r-beta')).toHaveTextContent('Chiusa: un’altra riserva ha accettato prima');
  });

  it('InterventionGroup_WhileTheChosenSupplierHasItsHour_SaysUntilWhenAndListsTheBackupsAsWaiting', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <InterventionGroup group={group({ members: [PRIMARY, member({ ...ALFA, acceptedAt: '2026-10-30T10:40:00Z' }), BETA] })} />
      </I18nextProvider>,
    );

    const summary = screen.getByTestId('intervention-group-summary');
    expect(summary).toHaveTextContent('Pulizie Rossi ha tempo fino alle');
    expect(summary).toHaveTextContent('il lavoro passa alla prima riserva che accetta');
    const members = within(screen.getByTestId('intervention-group-members'));
    expect(members.getByTestId('intervention-group-member-r-primary')).toHaveTextContent('scelto da te');
    expect(members.getByTestId('intervention-group-member-r-alfa')).toHaveTextContent('Ha accettato come riserva');
    expect(members.getByTestId('intervention-group-member-r-beta')).toHaveTextContent('In attesa');
    expect(screen.getByTestId('intervention-group')).toHaveAttribute('data-stage', 'primaryWindow');
  });

  it('InterventionGroup_ABackupTookTheJob_SaysWhoAndWhy_AndTheOthersAreClosed', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <InterventionGroup
          group={group({
            phase: 'Closed',
            closedAt: '2026-10-30T11:31:00Z',
            members: [
              member({ requestId: 'r-alfa', role: 'PromotedBackup', supplierName: 'Alfa Srl', status: 'PresoInCarico', tookTheJob: true }),
              member({ ...PRIMARY, role: 'ReplacedPrimary', status: 'Annullato', cancellationReason: 'NoResponse' }),
              member({ ...BETA, status: 'Annullato', cancellationReason: 'TakenByBackup' }),
            ],
          })}
        />
      </I18nextProvider>,
    );

    expect(screen.getByTestId('intervention-group-summary')).toHaveTextContent('Alfa Srl, una riserva, ha preso il lavoro perché Pulizie Rossi non ha risposto in tempo.');
    const members = within(screen.getByTestId('intervention-group-members'));
    expect(members.getByTestId('intervention-group-member-r-alfa')).toHaveTextContent('Ha il lavoro');
    expect(members.getByTestId('intervention-group-member-r-primary')).toHaveTextContent('Non ha risposto in tempo');
    expect(members.getByTestId('intervention-group-member-r-beta')).toHaveTextContent('Chiusa: il lavoro l’ha preso un altro fornitore');
  });
});
