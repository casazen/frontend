import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, type AxiosResponse } from 'axios';
import i18n from '@/i18n/config';
import { LegalApi } from '@/api/legal.api';
import { ConsentsStep } from '../consents-step';

vi.mock('@/api/legal.api', () => ({
  LegalApi: { getTos: vi.fn(), getPrivacy: vi.fn(), getDpa: vi.fn(), getSubprocessors: vi.fn() },
}));

const doc = (title: string) => ({
  version: '2026-06-v1',
  effectiveAt: '2026-06-01T00:00:00Z',
  title,
  summary: title,
  documentUrl: null,
});

function serverError(): AxiosError {
  return new AxiosError('request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status: 503,
    data: {},
  } as AxiosResponse);
}

function renderStep(onBack = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ConsentsStep onBack={onBack} onContinue={vi.fn()} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return { onBack };
}

describe('ConsentsStep load error (A1-39)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  function mockDocuments() {
    vi.mocked(LegalApi.getTos).mockResolvedValue(doc('ToS'));
    vi.mocked(LegalApi.getPrivacy).mockResolvedValue(doc('Privacy'));
    vi.mocked(LegalApi.getSubprocessors).mockResolvedValue({
      version: '2026-06-v1',
      effectiveAt: '2026-06-01T00:00:00Z',
      items: [{ name: 'Supabase', purpose: 'Database', region: 'EU' }],
    });
  }

  it('ConsentsStep_DocumentFailsToLoad_RetryLoadsItAndShowsTheConsents', async () => {
    await i18n.changeLanguage('it');
    mockDocuments();
    vi.mocked(LegalApi.getDpa).mockRejectedValueOnce(serverError()).mockResolvedValueOnce(doc('DPA'));

    renderStep();

    expect(await screen.findByTestId('onboarding-consents-error')).toHaveTextContent(
      i18n.t('onboarding.cannotLoadLegalDocs'),
    );
    fireEvent.click(screen.getByTestId('onboarding-consents-retry'));

    expect(await screen.findByTestId('onboarding-consents-step')).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('onboarding.acceptDpa', { title: 'DPA', version: '2026-06-v1' }))).toBeInTheDocument();
    // Only the failed document is requested again.
    expect(LegalApi.getDpa).toHaveBeenCalledTimes(2);
    expect(LegalApi.getTos).toHaveBeenCalledTimes(1);
  });

  it('ConsentsStep_DocumentFailsToLoad_BackReturnsToThePreviousStep', async () => {
    await i18n.changeLanguage('it');
    mockDocuments();
    vi.mocked(LegalApi.getDpa).mockRejectedValue(serverError());

    const { onBack } = renderStep();

    await screen.findByTestId('onboarding-consents-error');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('onboarding.back') }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
