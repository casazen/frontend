import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { guestRegistrationApi } from '@/api/guest-registration.api';
import { propertiesApi } from '@/api/properties.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { SwissRegistrationGuidance } from '../swiss-registration-guidance';
import { PROPERTY_ID, card } from './guest-registration-fixtures';

vi.mock('@/api/guest-registration.api', () => ({ guestRegistrationApi: { get: vi.fn(), setOverride: vi.fn() } }));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getDetail: vi.fn(), update: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderGuidance(flagOn: boolean, variant: 'page' | 'wizard' = 'page') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, guestRegistrationRegimes: flagOn }, isLoading: false }}>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <SwissRegistrationGuidance propertyId={PROPERTY_ID} variant={variant} canWrite />
          </MemoryRouter>
        </QueryClientProvider>
      </FeatureFlagsContext.Provider>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  vi.mocked(guestRegistrationApi.get).mockReset().mockResolvedValue(card());
  vi.mocked(propertiesApi.getDetail).mockReset().mockResolvedValue({ id: PROPERTY_ID, isInTicino: true, ticinoStructureId: null } as never);
});

afterEach(() => {
  cleanup();
});

describe('SwissRegistrationGuidance, the card of the regime or the guidance it replaces (E29/F02/US02/T01)', () => {
  it('SwissRegistrationGuidance_FlagOff_IsTheGuidanceItAlwaysWasAndAsksNothing', () => {
    renderGuidance(false);

    expect(screen.getByRole('heading', { name: i18n.t('property.swissRegistration.title') })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('property.swissRegistration.description'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('property.swissRegistration.ticino'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('property.swissRegistration.link') })).toHaveAttribute('target', '_blank');
    expect(screen.queryByTestId('guest-registration-card')).not.toBeInTheDocument();
    expect(guestRegistrationApi.get).not.toHaveBeenCalled();
  });

  it('SwissRegistrationGuidance_FlagOn_IsTheCardOfTheRegimeAndTheOldGuidanceIsGone', async () => {
    renderGuidance(true);

    expect(await screen.findByTestId('guest-registration-summary')).toBeInTheDocument();
    expect(screen.getByTestId('guest-registration-card')).toHaveAttribute('data-variant', 'page');
    expect(screen.queryByText(i18n.t('property.swissRegistration.title'))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('property.swissRegistration.ticino'))).not.toBeInTheDocument();
    expect(guestRegistrationApi.get).toHaveBeenCalledWith(PROPERTY_ID);
  });

  it('SwissRegistrationGuidance_FlagOnInAWizard_TheCardNeverLeavesTheProcess', async () => {
    renderGuidance(true, 'wizard');

    await screen.findByTestId('guest-registration-summary');
    expect(screen.getByTestId('guest-registration-card')).toHaveAttribute('data-variant', 'wizard');
    expect(screen.queryByTestId('guest-registration-portal-link')).not.toBeInTheDocument();
  });
});
