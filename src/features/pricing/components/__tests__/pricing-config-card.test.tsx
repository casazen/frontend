import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { PricingAdapterConfig } from '@/types';
import { PricingConfigCard } from '../pricing-config-card';

const BASE_CONFIG: PricingAdapterConfig = {
  propertyId: 'prop-1',
  isEnabled: true,
  adaptationFrequency: 'daily',
  includeSeasonality: true,
  includePublicHolidays: true,
  lastAdaptedAt: null,
  nextScheduledRunAt: null,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

function card(config: PricingAdapterConfig | undefined) {
  return (
    <I18nextProvider i18n={i18n}>
      <PricingConfigCard
        config={config}
        isSaving={false}
        isSyncing={false}
        onToggle={vi.fn()}
        onSave={vi.fn()}
        onSync={vi.fn()}
      />
    </I18nextProvider>
  );
}

describe('PricingConfigCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('PricingConfigCard_ServerConfigChanges_ResyncsFormFields', () => {
    const { rerender } = render(card(BASE_CONFIG));
    expect(screen.getByTestId('frequency-daily')).toBeChecked();

    rerender(card({ ...BASE_CONFIG, adaptationFrequency: 'weekly', updatedAt: '2026-05-02T00:00:00Z' }));

    expect(screen.getByTestId('frequency-weekly')).toBeChecked();
  });

  it('PricingConfigCard_SameConfigRerendered_KeepsLocalEdits', () => {
    const { rerender } = render(card(BASE_CONFIG));

    fireEvent.click(screen.getByTestId('frequency-weekly'));
    rerender(card(BASE_CONFIG));

    expect(screen.getByTestId('frequency-weekly')).toBeChecked();
  });
});
