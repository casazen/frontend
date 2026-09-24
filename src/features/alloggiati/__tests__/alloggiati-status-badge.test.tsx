import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AlloggiatiStatusBadge } from '../components/alloggiati-status-badge';
import {
  canMarkAlloggiatiSentManually,
  formatRecordDate,
  getAlloggiatiStatusLabel,
  isAlloggiatiSent,
  todayInRomeIso,
} from '../alloggiati-status.utils';

afterEach(() => {
  cleanup();
});

describe('AlloggiatiStatusBadge (CO-11)', () => {
  it('statusBadge_ToSendManually_IsOrangeNeverGreen', () => {
    render(<AlloggiatiStatusBadge status="DaInviareManualmente" />);
    const badge = screen.getByTestId('alloggiati-status-badge');
    expect(badge).toHaveTextContent('Da inviare manualmente');
    expect(badge.className).toContain('bg-orange-500');
    expect(badge.className).not.toContain('bg-green');
  });

  it('statusBadge_DeclaredByHost_IsNotTheReceiptGreen', () => {
    render(<AlloggiatiStatusBadge status="InviatoManualmente" />);
    const badge = screen.getByTestId('alloggiati-status-badge');
    expect(badge).toHaveTextContent('Inviato manualmente');
    expect(badge.className).not.toContain('bg-green');
  });

  it('statusBadge_SentWithReceipt_IsGreen', () => {
    render(<AlloggiatiStatusBadge status="Inviato" />);
    expect(screen.getByTestId('alloggiati-status-badge').className).toContain('bg-green-500');
  });

  it('statusBadge_WaitingForArrival_ShowsToSend', () => {
    render(<AlloggiatiStatusBadge status="DaInviare" />);
    expect(screen.getByTestId('alloggiati-status-badge')).toHaveTextContent('Da inviare');
  });

  it('statusBadge_Overdue_KeepsTheStatusAndAddsDeadlinePassed', () => {
    render(<AlloggiatiStatusBadge status="DaInviareManualmente" isOverdue />);
    expect(screen.getByTestId('alloggiati-status-badge')).toHaveTextContent('Da inviare manualmente');
    expect(screen.getByTestId('alloggiati-overdue-badge')).toHaveTextContent('Scadenza superata');
  });
});

describe('alloggiati status utils', () => {
  it('isAlloggiatiSent_OnlyReceiptOrHostDeclaration_IsSent', () => {
    expect(isAlloggiatiSent('Inviato')).toBe(true);
    expect(isAlloggiatiSent('InviatoManualmente')).toBe(true);
    expect(isAlloggiatiSent('DaInviareManualmente')).toBe(false);
    expect(isAlloggiatiSent('Errore')).toBe(false);
  });

  it('canMarkAlloggiatiSentManually_BeforeArrivalOrSent_IsFalse', () => {
    expect(canMarkAlloggiatiSentManually('DaInviare')).toBe(false);
    expect(canMarkAlloggiatiSentManually('Inviato')).toBe(false);
    expect(canMarkAlloggiatiSentManually('InviatoManualmente')).toBe(false);
    expect(canMarkAlloggiatiSentManually('DaInviareManualmente')).toBe(true);
    expect(canMarkAlloggiatiSentManually('Rifiutato')).toBe(true);
  });

  it('todayInRomeIso_AfterMidnightInRome_ReturnsTheRomeDate', () => {
    expect(todayInRomeIso(new Date('2026-09-30T22:30:00Z'))).toBe('2026-10-01');
    expect(todayInRomeIso(new Date('2026-12-31T22:59:00Z'))).toBe('2026-12-31');
  });

  it('formatRecordDate_DateOnlyValue_UsesTheRecordFormatWithoutTimezoneShift', () => {
    expect(formatRecordDate('2026-10-10T00:00:00Z')).toBe('10/10/2026');
  });

  it('getAlloggiatiStatusLabel_ReturnsTranslatedLabel', () => {
    expect(getAlloggiatiStatusLabel('Errore')).toBe('Errore');
    expect(getAlloggiatiStatusLabel('DaInviareManualmente')).toBe('Da inviare manualmente');
  });
});
