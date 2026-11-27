import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { guestRegistrationApi } from '@/api/guest-registration.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { PROPERTY_ID, card } from '@/features/properties/components/__tests__/guest-registration-fixtures';
import * as properties from '@/queries/use-properties';
import type { ComplianceActivationResult } from '@/types/compliance.types';
import { FinishStep } from '../steps/finish-step';
import type { PropertyWizardValues } from '../property-wizard-model';

vi.mock('@/api/guest-registration.api', () => ({ guestRegistrationApi: { get: vi.fn(), setOverride: vi.fn() } }));
vi.mock('@/queries/use-properties', () => ({ useProperty: vi.fn(), usePropertyDetail: vi.fn(), useUpdateProperty: vi.fn() }));
vi.mock('@/features/properties/components/ical-settings', () => ({ IcalSettings: () => null }));
// The sections of the last step that are not what is asked here: the CIN, the documents, what is missing, the summary and the activation.
vi.mock('../finish/cin-section', () => ({ CinSection: () => createElement('p', { 'data-testid': 'cin-section' }) }));
vi.mock('../finish/documents-section', () => ({ DocumentsSection: () => null }));
vi.mock('../finish/missing-section', () => ({ MissingSection: () => null }));
vi.mock('../finish/summary-section', () => ({ SummarySection: () => null }));
vi.mock('../finish/activation-section', () => ({ ActivationSection: () => null }));

type Hook<T extends (...args: never[]) => unknown> = ReturnType<T>;

/** The activation of a Swiss property as the server says it: the step of the notification is open and lists what the property lacks. */
function swissActivation(missing: string[]): ComplianceActivationResult {
  return {
    complianceStatus: 'Pending',
    steps: [
      {
        id: 'guest-registration',
        label: 'Notifica degli ospiti',
        status: 'pending',
        blocker: true,
        blockers: missing.map((code) => ({ step: 'guest-registration', code, message: '' })),
      },
    ],
  };
}

function renderStep(country: 'CH' | 'IT', regimes: boolean, activation?: ComplianceActivationResult) {
  vi.mocked(properties.useProperty).mockReturnValue({ data: { id: PROPERTY_ID, country, cinCode: null }, isLoading: false, isError: false } as unknown as Hook<typeof properties.useProperty>);
  const form = { watch: () => [] } as unknown as UseFormReturn<PropertyWizardValues>;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, guestRegistrationRegimes: regimes }, isLoading: false }}>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <FinishStep
              form={form}
              propertyId={PROPERTY_ID}
              activation={activation}
              activationFailed={false}
              onRetryActivation={vi.fn()}
              refused={null}
              tosAccepted={false}
              onTosChange={vi.fn()}
              remindersAccepted={false}
              onRemindersChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      </FeatureFlagsContext.Provider>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  vi.mocked(guestRegistrationApi.get).mockReset().mockResolvedValue(card({ identifierMissing: ['ticino_structure_id_missing'] }));
  vi.mocked(properties.usePropertyDetail).mockReturnValue({ data: { id: PROPERTY_ID, isInTicino: true, ticinoStructureId: null }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as Hook<typeof properties.usePropertyDetail>);
  vi.mocked(properties.useUpdateProperty).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as Hook<typeof properties.useUpdateProperty>);
});

afterEach(() => {
  cleanup();
});

describe('FinishStep, the notification of the guests in the last step of «Aggiungi immobile» (E29/F02/US02/T01)', () => {
  it('FinishStep_SwissPropertyWithTheRegimesOn_ShowsTheCardOfTheRegimeInsideTheStepAndNeverLeadsOut', async () => {
    const { container } = renderStep('CH', true);

    expect(await screen.findByTestId('guest-registration-facts')).toBeInTheDocument();
    expect(screen.getByTestId('guest-registration-card')).toHaveAttribute('data-variant', 'wizard');
    expect(screen.queryByTestId('guest-registration-portal-link')).not.toBeInTheDocument();
    expect(container.querySelector('a[target="_blank"]')).toBeNull();
    expect(screen.queryByTestId('cin-section')).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('property.swissRegistration.title'))).not.toBeInTheDocument();
    // In Ticino the structure number is asked right here, with what is missing, so nothing is lost on the way.
    expect(await screen.findByTestId('ticino-structure-id-form')).toBeInTheDocument();
  });

  it('FinishStep_SwissPropertyWithTheRegimesOff_IsTheGuidanceItAlwaysWasAndAsksNothing', () => {
    renderStep('CH', false);

    expect(screen.getByText(i18n.t('property.swissRegistration.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('guest-registration-card')).not.toBeInTheDocument();
    expect(guestRegistrationApi.get).not.toHaveBeenCalled();
  });

  // What a Swiss property lacks blocks its activation whatever the flag says (the readiness is not behind it): the host can fix it here, and «Correggi» has a place to go.
  it('FinishStep_SwissPropertyWithTheRegimesOff_ListsWhatItLacksAndAsksTheStructureNumberHere', async () => {
    renderStep('CH', false, swissActivation(['ticino_structure_id_missing']));

    expect(await screen.findByTestId('ticino-structure-id-form')).toBeInTheDocument();
    expect(screen.getByTestId('guest-registration-missing')).toHaveTextContent(i18n.t('guestRegistration.missing.ticino_structure_id_missing'));
    // The guidance it always was is still there, nothing is asked of the regimes, and the place «Correggi» leads to exists.
    expect(screen.getByText(i18n.t('property.swissRegistration.title'))).toBeInTheDocument();
    expect(guestRegistrationApi.get).not.toHaveBeenCalled();
    expect(document.getElementById('property-wizard-section-guest-registration')).toBe(screen.getByTestId('property-wizard-swiss'));
  });

  it('FinishStep_SwissPropertyWithTheRegimesOff_NothingMissing_HasNoListOfWhatIsMissing', () => {
    vi.mocked(properties.usePropertyDetail).mockReturnValue({ data: { id: PROPERTY_ID, isInTicino: false }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as Hook<typeof properties.usePropertyDetail>);
    renderStep('CH', false, swissActivation([]));

    expect(screen.queryByTestId('guest-registration-missing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ticino-structure-id-form')).not.toBeInTheDocument();
  });

  it('FinishStep_PropertyInItaly_StaysTheCinSectionWhateverTheFlagSays', () => {
    renderStep('IT', true);

    expect(screen.getByTestId('cin-section')).toBeInTheDocument();
    expect(screen.queryByTestId('guest-registration-card')).not.toBeInTheDocument();
    expect(guestRegistrationApi.get).not.toHaveBeenCalled();
  });
});
