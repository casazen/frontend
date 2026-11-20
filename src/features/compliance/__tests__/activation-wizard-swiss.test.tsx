import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { guestRegistrationApi } from '@/api/guest-registration.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import * as compliance from '@/features/compliance/use-compliance';
import { card, unknownPlaceCard } from '@/features/properties/components/__tests__/guest-registration-fixtures';
import * as properties from '@/queries/use-properties';
import * as cin from '@/queries/use-cin';
import type { ComplianceActivationResult, ComplianceWizardStep } from '@/types/compliance.types';
import type { Property } from '@/types';
import { PropertyActivationWizard } from '../activation-wizard';

vi.mock('@/features/compliance/use-compliance', () => ({
  useComplianceActivation: vi.fn(),
  useCompleteComplianceActivation: vi.fn(),
  useSafetyChecklist: vi.fn(),
  useSaveSafetyChecklist: vi.fn(),
}));
vi.mock('@/queries/use-properties', () => ({
  useProperty: vi.fn(),
  usePropertyDetail: vi.fn(),
  useUpdateProperty: vi.fn(),
  useUploadPropertyDocument: vi.fn(),
}));
vi.mock('@/queries/use-cin', () => ({ useUpdatePropertyCin: vi.fn() }));
vi.mock('@/api/guest-registration.api', () => ({ guestRegistrationApi: { get: vi.fn(), setOverride: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/shared/breadcrumb', () => ({ Breadcrumb: () => null }));
vi.mock('@/features/properties/components/document-upload-dialog', () => ({ DocumentUploadDialog: () => null }));
vi.mock('@/features/properties/components/ical-settings', () => ({ IcalSettings: () => createElement('p', { 'data-testid': 'ical-settings' }) }));
vi.mock('@/features/properties/components/property-form', () => ({
  PropertyForm: () => createElement('p', { 'data-testid': 'fake-property-form' }),
}));

type Hook<T extends (...args: never[]) => unknown> = ReturnType<T>;

const PROPERTY_ID = 'prop-1';

/** A house in Lugano, already active or not: the wizard reads only these fields of it. */
const property = {
  id: PROPERTY_ID,
  name: 'Casa Lugano',
  description: 'Bilocale vicino al lago',
  address: 'Via Nassa 1',
  city: 'Lugano',
  postalCode: '6900',
  country: 'CH',
  bedrooms: 1,
  bathrooms: 1,
  maxGuests: 4,
  nightlyRate: 150,
  cleaningFee: 30,
  damageDeposit: 0,
  amenities: ['WiFi'],
  houseRules: '',
  timezone: 'Europe/Zurich',
  cancellationPolicyId: null,
  isActive: false,
  cinCode: null,
  slug: 'casa-lugano',
  updatedAt: '2026-11-20T10:00:00Z',
} as unknown as Property;

function step(id: string, patch: Partial<ComplianceWizardStep> = {}): ComplianceWizardStep {
  const blocker = !['tourist-tax', 'ical'].includes(id);
  return { id, label: id, status: blocker ? 'complete' : 'warning', blocker, blockers: [], ...patch };
}

/** The step of a property in Switzerland as the server sends it: pending and blocking, with what it lacks. */
function swissStep(missing: string[]): ComplianceWizardStep {
  return step('guest-registration', {
    label: 'Notifica degli ospiti',
    status: missing.length > 0 ? 'pending' : 'complete',
    blocker: missing.length > 0,
    message: missing.length > 0 ? 'Manca qualcosa' : null,
    blockers: missing.map((code) => ({ step: 'guest-registration', code, message: 'Messaggio del server' })),
  });
}

function activation(missing: string[]): ComplianceActivationResult {
  return {
    complianceStatus: 'Pending',
    steps: [
      step('base-data'),
      step('documents'),
      step('tourist-tax', { touristTax: { city: 'Lugano', rate: null, publicPageSlug: null } }),
      step('ical'),
      swissStep(missing),
    ],
  };
}

const refetchActivation = vi.fn();
const updateProperty = vi.fn();

function mockActivation(data: ComplianceActivationResult) {
  vi.mocked(compliance.useComplianceActivation).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    isFetching: false,
    isFetchedAfterMount: true,
    error: null,
    refetch: refetchActivation,
  } as unknown as Hook<typeof compliance.useComplianceActivation>);
}

function mockDetail(detail: Record<string, unknown>) {
  vi.mocked(properties.usePropertyDetail).mockReturnValue({
    data: { documents: [], ...detail },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as Hook<typeof properties.usePropertyDetail>);
}

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.search}</p>;
}

function renderWizard(search: string, regimes: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, guestRegistrationRegimes: regimes }, isLoading: false }}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/app/short-rent/properties/${PROPERTY_ID}/activation${search}`]}>
          <Routes>
            <Route
              path="/app/short-rent/properties/:id/activation"
              element={
                <>
                  <PropertyActivationWizard />
                  <Where />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </FeatureFlagsContext.Provider>,
  );
}

const stepButton = (stepId: string) => screen.getByTestId(`activation-step-${stepId}`);
const panel = (stepId: string) => screen.getByTestId(`activation-panel-${stepId}`);
const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

describe('PropertyActivationWizard, the step «Notifica degli ospiti» of a property in Switzerland (E29/F02/US02/T01)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    refetchActivation.mockResolvedValue({});
    mockActivation(activation(['ticino_structure_id_missing']));
    mockDetail({ isInTicino: true, ticinoStructureId: null });
    vi.mocked(guestRegistrationApi.get).mockResolvedValue(card({ identifierMissing: ['ticino_structure_id_missing'] }));
    vi.mocked(compliance.useCompleteComplianceActivation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as Hook<typeof compliance.useCompleteComplianceActivation>);
    vi.mocked(compliance.useSafetyChecklist).mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() } as unknown as Hook<typeof compliance.useSafetyChecklist>);
    vi.mocked(compliance.useSaveSafetyChecklist).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as Hook<typeof compliance.useSaveSafetyChecklist>);
    vi.mocked(properties.useProperty).mockReturnValue({ data: property, isLoading: false, isError: false, isFetching: false, error: null, refetch: vi.fn() } as unknown as Hook<typeof properties.useProperty>);
    updateProperty.mockResolvedValue({});
    vi.mocked(properties.useUpdateProperty).mockReturnValue({ mutateAsync: updateProperty, isPending: false } as unknown as Hook<typeof properties.useUpdateProperty>);
    vi.mocked(properties.useUploadPropertyDocument).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as Hook<typeof properties.useUploadPropertyDocument>);
    vi.mocked(cin.useUpdatePropertyCin).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as Hook<typeof cin.useUpdatePropertyCin>);
  });

  afterEach(() => {
    cleanup();
  });

  // AC3: the Swiss step is in the wizard, inside the layer, with the card; AC4: the old guidance is gone when the flag is on.
  it('Wizard_SwissPropertyWithTheRegimesOn_OpensOnTheSwissStepWithTheCardAndNoOldGuidance', async () => {
    const { container } = renderWizard('', true);

    // The first blocking step that is still open is the one of Switzerland: the wizard opens on it, with its title in the progress.
    expect(stepButton('guest-registration')).toHaveAttribute('aria-current', 'step');
    expect(stepButton('guest-registration')).toHaveTextContent(t('compliance.activation.steps.guest-registration'));
    expect(panel('guest-registration')).toBeVisible();
    expect(await within(panel('guest-registration')).findByTestId('guest-registration-summary')).toBeInTheDocument();
    expect(within(panel('guest-registration')).getByTestId('guest-registration-card')).toHaveAttribute('data-variant', 'wizard');
    // What is missing is in the panel, once: the header of the step does not repeat it.
    expect(within(panel('guest-registration')).getByTestId('guest-registration-missing')).toHaveTextContent(t('guestRegistration.missing.ticino_structure_id_missing'));
    expect(screen.queryByTestId('activation-step-blockers-guest-registration')).not.toBeInTheDocument();
    // The old guidance is gone, and nothing in the wizard leads out of it: no link opens another tab.
    expect(screen.queryByText(t('property.swissRegistration.title'))).not.toBeInTheDocument();
    expect(container.querySelector('a[target="_blank"]')).toBeNull();
    expect(guestRegistrationApi.get).toHaveBeenCalledWith(PROPERTY_ID);
  });

  it('Wizard_TheSwissStep_ComesAfterTheOtherStepsAndBeforeTheSummary', () => {
    renderWizard('?step=base-data', true);

    const order = Array.from(screen.getByTestId('activation-wizard-progress').querySelectorAll('button')).map((button) => button.getAttribute('data-testid'));
    expect(order).toEqual(['activation-step-base-data', 'activation-step-documents', 'activation-step-tourist-tax', 'activation-step-ical', 'activation-step-guest-registration', 'activation-step-review']);
  });

  it('Wizard_TheHostLeavesForTheSwissStepFromAnotherStep_TheWayBackToThatStepIsAtHand', async () => {
    renderWizard('?step=base-data', true);
    // Nothing leads back while the host is where they started.
    expect(screen.queryByTestId('guest-registration-back-to-origin')).not.toBeInTheDocument();

    fireEvent.click(stepButton('guest-registration'));

    const back = await screen.findByTestId('guest-registration-back-to-origin');
    expect(back).toHaveTextContent(t('compliance.activation.backToStep', { step: t('compliance.activation.steps.base-data') }));
    expect(screen.getByTestId('where')).toHaveTextContent('step=guest-registration');
    expect(screen.getByTestId('where')).toHaveTextContent('from=base-data');

    fireEvent.click(back);

    expect(panel('base-data')).toBeVisible();
    expect(panel('guest-registration')).not.toBeVisible();
    // The step it came back to forgets where it was: the address has no `from`.
    expect(screen.getByTestId('where')).not.toHaveTextContent('from=');
    expect(screen.queryByTestId('guest-registration-back-to-origin')).not.toBeInTheDocument();
  });

  it('Wizard_TheHostComesFromTheSummary_TheSwissStepLeadsBackToTheSummary', async () => {
    renderWizard('?step=review', true);

    fireEvent.click(await screen.findByTestId('activation-blocker-link-guest-registration'));

    expect(panel('guest-registration')).toBeVisible();
    const back = await screen.findByTestId('guest-registration-back-to-origin');
    expect(back).toHaveTextContent(t('compliance.activation.backToStep', { step: t('compliance.activation.steps.review') }));
    fireEvent.click(back);
    expect(await screen.findByTestId('activation-review')).toBeInTheDocument();
  });

  it('Wizard_AnOriginThatIsNotAStepOfTheWizard_IsIgnored', () => {
    renderWizard('?step=guest-registration&from=somewhere-else', true);

    expect(panel('guest-registration')).toBeVisible();
    expect(screen.queryByTestId('guest-registration-back-to-origin')).not.toBeInTheDocument();
  });

  // «Resumable, nothing typed is lost»: the step stays mounted while another one is shown.
  it('Wizard_TheNumberTypedInTheSwissStep_SurvivesGoingToAnotherStepAndBack', async () => {
    renderWizard('', true);
    const input = await within(panel('guest-registration')).findByLabelText(t('swiss.structureId.label'));

    fireEvent.change(input, { target: { value: 'nl-12' } });
    fireEvent.click(stepButton('base-data'));
    expect(panel('guest-registration')).not.toBeVisible();
    fireEvent.click(stepButton('guest-registration'));

    expect(panel('guest-registration')).toBeVisible();
    expect(within(panel('guest-registration')).getByLabelText(t('swiss.structureId.label'))).toHaveValue('NL-12');
  });

  it('Wizard_TheStructureNumberIsSavedInTheStep_ThePropertyIsUpdatedAndTheStepsAreReadAgain', async () => {
    renderWizard('', true);

    fireEvent.change(await within(panel('guest-registration')).findByLabelText(t('swiss.structureId.label')), { target: { value: 'nl-12345678' } });
    fireEvent.click(within(panel('guest-registration')).getByRole('button', { name: t('swiss.structureId.save') }));

    await waitFor(() => expect(updateProperty).toHaveBeenCalledWith({ id: PROPERTY_ID, data: { ticinoStructureId: 'NL-12345678' } }));
    await waitFor(() => expect(refetchActivation).toHaveBeenCalled());
    // The host is still where they were: the step did not send them anywhere.
    expect(panel('guest-registration')).toBeVisible();
  });

  it('Wizard_TheMunicipalityIsMissing_TheWizardGoesToItsStepWhereItIsSetAndNeverLeavesTheProcess', async () => {
    mockActivation(activation(['swiss_municipality_missing']));
    mockDetail({ isInTicino: false, ticinoStructureId: null });
    vi.mocked(guestRegistrationApi.get).mockResolvedValue(unknownPlaceCard());
    renderWizard('', true);

    const fix = await within(panel('guest-registration')).findByTestId('guest-registration-fix-municipality');
    expect(fix.tagName).toBe('BUTTON');
    fireEvent.click(fix);

    expect(panel('base-data')).toBeVisible();
    expect(screen.getByTestId('where')).toHaveTextContent('step=base-data');
    expect(screen.getByTestId('activation-wizard-progress')).toBeInTheDocument();
  });

  describe('with the regimes off', () => {
    it('Wizard_SwissPropertyWithTheRegimesOff_TheOldGuidanceIsAboveTheStepsAndTheStepAsksWhatItLacksWithoutTheCard', async () => {
      renderWizard('', false);

      // The guidance it always was, above the steps; nothing is asked of the regimes.
      expect(screen.getByText(t('property.swissRegistration.title'))).toBeInTheDocument();
      expect(guestRegistrationApi.get).not.toHaveBeenCalled();
      // The step does not depend on the flag: it lists what is missing and has the field of the number, so the host can finish.
      expect(panel('guest-registration')).toBeVisible();
      expect(within(panel('guest-registration')).queryByTestId('guest-registration-card')).not.toBeInTheDocument();
      expect(within(panel('guest-registration')).getByTestId('guest-registration-missing')).toHaveTextContent(t('guestRegistration.missing.ticino_structure_id_missing'));
      expect(await within(panel('guest-registration')).findByLabelText(t('swiss.structureId.label'))).toBeInTheDocument();
    });

    it('Wizard_SwissStepComplete_SaysNothingIsMissing', () => {
      mockActivation(activation([]));
      mockDetail({ isInTicino: false, ticinoStructureId: null });
      renderWizard('?step=guest-registration', false);

      expect(within(panel('guest-registration')).getByTestId('guest-registration-step-complete')).toHaveTextContent(t('guestRegistration.step.complete'));
      expect(within(panel('guest-registration')).queryByTestId('guest-registration-missing')).not.toBeInTheDocument();
    });
  });

  it('Wizard_PropertyInItaly_HasNoSwissStepAndNoCard', () => {
    vi.mocked(properties.useProperty).mockReturnValue({ data: { ...property, country: 'IT' }, isLoading: false, isError: false, isFetching: false, error: null, refetch: vi.fn() } as unknown as Hook<typeof properties.useProperty>);
    mockActivation({ complianceStatus: 'Pending', steps: [step('base-data'), step('cin'), step('documents'), step('safety'), step('tourist-tax'), step('ical')] });
    renderWizard('?step=base-data', true);

    expect(screen.queryByTestId('activation-step-guest-registration')).not.toBeInTheDocument();
    expect(screen.queryByTestId('activation-panel-guest-registration')).not.toBeInTheDocument();
    expect(guestRegistrationApi.get).not.toHaveBeenCalled();
  });
});
