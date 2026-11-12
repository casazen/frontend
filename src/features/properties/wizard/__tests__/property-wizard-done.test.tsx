import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { PropertyWizardDone } from '../property-wizard-done';

/**
 * The first wizard of the path «Inizia con CasaZen» to end with its next step (UX-10, E10/F03/US01/T03): the done screen of the property
 * wizard shows `WizardNextStep` for the part `listings`, under «Cosa succede ora». The suggestion itself has its own test.
 */
const useProperty = vi.hoisted(() => vi.fn());
const useComplianceActivation = vi.hoisted(() => vi.fn());
vi.mock('@/queries/use-properties', () => ({ useProperty }));
vi.mock('@/features/compliance/use-compliance', () => ({ useComplianceActivation }));
vi.mock('@/features/onboarding/components/wizard-next-step', () => ({
  WizardNextStep: ({ currentPart }: { currentPart: string }) => <aside data-testid="wizard-next-step-stub" data-current-part={currentPart} />,
}));

function renderDone() {
  return render(
    <MemoryRouter>
      <PropertyWizardDone propertyId="prop-1" />
    </MemoryRouter>,
  );
}

describe('PropertyWizardDone: the next step of the path at the end of the wizard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    useProperty.mockReset().mockReturnValue({ data: { id: 'prop-1', name: 'Casa Mare', publishedOnSite: true }, isError: false });
  });

  afterEach(() => cleanup());

  it('PropertyActive_ShowsTheSuggestionForThePartListingsUnderWhatHappensNow', () => {
    useComplianceActivation.mockReset().mockReturnValue({ data: { complianceStatus: 'Active', steps: [] } });
    renderDone();

    const suggestion = screen.getByTestId('wizard-next-step-stub');
    const whatNext = screen.getByRole('heading', { name: i18n.t('wizard.done.whatNext') });

    expect(suggestion).toHaveAttribute('data-current-part', 'listings');
    // After «Cosa succede ora» and before the two actions of the screen.
    expect(whatNext.compareDocumentPosition(suggestion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(suggestion.compareDocumentPosition(screen.getByTestId('wizard-done-primary')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('PropertyHiddenFromTheSite_ShowsTheSuggestionToo', () => {
    useProperty.mockReturnValue({ data: { id: 'prop-1', name: 'Casa Mare', publishedOnSite: false }, isError: false });
    useComplianceActivation.mockReset().mockReturnValue({ data: { complianceStatus: 'Active', steps: [] } });
    renderDone();

    expect(screen.getByTestId('property-wizard-show-on-site-link')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-next-step-stub')).toHaveAttribute('data-current-part', 'listings');
  });

  it('PropertyStillToComplete_ShowsTheSuggestionToo', () => {
    useComplianceActivation.mockReset().mockReturnValue({ data: { complianceStatus: 'Pending', steps: [] } });
    renderDone();

    expect(screen.getByTestId('wizard-next-step-stub')).toHaveAttribute('data-current-part', 'listings');
  });
});
