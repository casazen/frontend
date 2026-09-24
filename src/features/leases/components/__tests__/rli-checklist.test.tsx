import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { RliChecklist } from '../rli-checklist';
import { httpError } from '../../__tests__/lease-test-utils';

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

  it('render_EnglishUi_TranslatesItemsByKeyInsteadOfShowingTheServerText', async () => {
    await i18n.changeLanguage('en');
    vi.mocked(useRliChecklist).mockReturnValue({
      data: {
        registrationDeadline: '2026-09-16',
        daysRemaining: 12,
        tosVersion: '2026-08-rli-delega-bozza',
        attestationText: 'bozza',
        items: [
          { key: 'contract_signed', label: 'Contratto firmato da tutte le parti', done: true },
          { key: 'future_item', label: 'Server-localized label', done: false },
        ],
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useRliChecklist>);

    render(
      <I18nextProvider i18n={i18n}>
        <RliChecklist leaseId="lease-1" />
      </I18nextProvider>,
    );

    expect(screen.getByText('Contract signed by all parties')).toBeInTheDocument();
    expect(screen.queryByText('Contratto firmato da tutte le parti')).not.toBeInTheDocument();
    expect(screen.getByText('Server-localized label')).toBeInTheDocument();
  });

  it('render_LoadError_ShowsTheProblemMessageInsteadOfTheList', () => {
    vi.mocked(useRliChecklist).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: httpError(403, { code: 'forbidden' }),
    } as unknown as ReturnType<typeof useRliChecklist>);

    render(
      <I18nextProvider i18n={i18n}>
        <RliChecklist leaseId="lease-1" />
      </I18nextProvider>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('apiErrors.forbidden'));
    expect(screen.queryByText(i18n.t('leases.rli.checklistEmpty'))).not.toBeInTheDocument();
  });
});
