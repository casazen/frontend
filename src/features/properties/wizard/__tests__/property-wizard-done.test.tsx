import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('keeps a failed activation read recoverable on the completion screen', () => {
    const refetch = vi.fn();
    useProperty.mockReturnValue({ data: { id: 'prop-1', name: 'Casa Mare' }, isError: false });
    useComplianceActivation.mockReturnValue({ isError: true, error: new Error('offline'), refetch });
    renderDone();
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('propertySetup.resume.statusError'));
    fireEvent.click(screen.getByRole('button', { name: /Riprova/i }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/app/short-rent/properties');
  });

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

  // E29/F02/US02/T01: a property in Switzerland is not ready to activate while its municipality (in Ticino its structure number) is missing, and this screen must never say it is.
  describe('a property in Switzerland that still lacks what it needs to be notified', () => {
    const swissStep = (code: string) => ({
      id: 'guest-registration',
      label: 'Notifica degli ospiti',
      status: 'pending',
      blocker: true,
      blockers: [{ step: 'guest-registration', code, message: '' }],
    });
    const completeStep = (id: string) => ({ id, label: id, status: 'complete', blocker: true, blockers: [] });

    it.each(['ticino_structure_id_missing', 'swiss_municipality_missing'])('PropertyLacking_%s_SaysWhatIsOpenAndNeverThatOnlyTheConfirmationIsMissing', (code) => {
      useProperty.mockReturnValue({ data: { id: 'prop-1', name: 'Casa Lugano', country: 'CH', address: 'Via Nassa 1', city: 'Lugano', maxGuests: 4 }, isError: false });
      useComplianceActivation.mockReset().mockReturnValue({
        data: { complianceStatus: 'Pending', steps: [completeStep('base-data'), completeStep('documents'), swissStep(code)] },
      });
      renderDone();

      // Not «ready»: the screen lists the point that is open, in plain words, and leads to where it is fixed (the last step, where the card of the notification is).
      expect(screen.queryByText(i18n.t('propertyWizard.done.leadReady'))).not.toBeInTheDocument();
      expect(screen.queryByText(i18n.t('propertyWizard.done.readyToActivate'))).not.toBeInTheDocument();
      expect(screen.getByText(i18n.t('propertyWizard.done.leadOpen'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('propertyWizard.done.open.guest-registration'))).toBeInTheDocument();
      const fix = screen.getByTestId('property-wizard-done-fix-guest-registration');
      expect(fix).toHaveTextContent(i18n.t('propertyWizard.done.fix.guest-registration'));
      expect(fix).toHaveAttribute('href', '/app/short-rent/properties/create?propertyId=prop-1&step=finish');
      expect(screen.getByTestId('wizard-done-primary')).toHaveAttribute('href', '/app/short-rent/properties/create?propertyId=prop-1&step=finish');
    });

    it('PropertyWhoseSwissStepIsComplete_IsReadyToActivateAsBefore', () => {
      useComplianceActivation.mockReset().mockReturnValue({
        data: { complianceStatus: 'Pending', steps: [completeStep('base-data'), { ...completeStep('guest-registration'), blockers: [] }] },
      });
      renderDone();

      expect(screen.getByText(i18n.t('propertyWizard.done.leadReady'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('propertyWizard.done.readyToActivate'))).toBeInTheDocument();
    });
  });
});
