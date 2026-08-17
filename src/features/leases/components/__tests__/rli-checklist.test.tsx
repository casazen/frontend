import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { RliChecklist } from '../rli-checklist';

vi.mock('@/queries/use-leases', () => ({
  useRliChecklist: vi.fn(),
  useExportRli: vi.fn(),
}));

import { useExportRli, useRliChecklist } from '@/queries/use-leases';

describe('RliChecklist', () => {
  beforeEach(() => {
    void i18n.changeLanguage('it');
    vi.mocked(useExportRli).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useExportRli>);
  });

  it('shows the empty-state copy when there are no items', () => {
    vi.mocked(useRliChecklist).mockReturnValue({
      data: {
        registrationDeadline: '2026-09-16',
        daysRemaining: 12,
        tosVersion: '2026-08-rli-delega-bozza',
        attestationText: 'bozza',
        items: [],
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useRliChecklist>);

    render(
      <I18nextProvider i18n={i18n}>
        <RliChecklist leaseId="lease-1" />
      </I18nextProvider>,
    );

    expect(screen.getByText(i18n.t('leases.rli.checklistEmpty'))).toBeInTheDocument();
  });
});
