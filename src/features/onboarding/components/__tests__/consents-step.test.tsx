import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { ConsentsStep } from '../consents-step';

const { useLegalDocuments } = vi.hoisted(() => ({ useLegalDocuments: vi.fn() }));

vi.mock('@/queries/use-legal', () => ({ useLegalDocuments }));

const doc = (title: string) => ({
  version: '2026-06-v1',
  effectiveAt: '2026-06-01T00:00:00Z',
  title,
  summary: title,
  documentUrl: null,
});

function renderStep() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ConsentsStep onBack={vi.fn()} onContinue={vi.fn()} />
    </I18nextProvider>,
  );
}

describe('ConsentsStep subprocessors', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    useLegalDocuments.mockReturnValue({
      tos: doc('ToS'),
      privacy: doc('Privacy'),
      dpa: doc('DPA'),
      subprocessors: {
        version: '2026-06-v1+ai-deepseek',
        effectiveAt: '2026-06-01T00:00:00Z',
        items: [
          { name: 'Supabase', purpose: 'Database', region: 'EU', detailsPending: false },
          { name: 'DeepSeek', purpose: 'AI text generation', region: '', transferMechanism: null, detailsPending: true },
        ],
      },
      isLoading: false,
      isError: false,
    });
  });

  it('ConsentsStep_AiProviderWithMissingLegalDetails_ListsItAsPending', () => {
    renderStep();

    // FD-21 (A8-15): an active AI provider is declared even before its legal details are known, never with "()".
    const ai = screen.getByTestId('subprocessor-DeepSeek');
    expect(ai).toHaveTextContent('DeepSeek — AI text generation');
    expect(ai).toHaveTextContent(i18n.t('onboarding.subprocessorDetailsPending'));
    expect(ai.textContent).not.toContain('()');
    expect(screen.getByTestId('subprocessor-Supabase')).toHaveTextContent('Supabase — Database (EU)');
    expect(screen.getByTestId('subprocessor-Supabase')).not.toHaveTextContent(i18n.t('onboarding.subprocessorDetailsPending'));
  });
});
