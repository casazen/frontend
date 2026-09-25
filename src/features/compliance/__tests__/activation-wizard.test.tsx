import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createElement, useState, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import * as compliance from '@/features/compliance/use-compliance';
import * as properties from '@/queries/use-properties';
import * as cin from '@/queries/use-cin';
import { propertyFormPayload } from '@/features/compliance/activation-wizard-model';
import {
  SAFETY_ITEM_CODES,
  type ComplianceActivationResult,
  type ComplianceWizardStep,
  type SafetyChecklist,
  type SafetyChecklistItem,
  type SafetyItemCode,
} from '@/types/compliance.types';
import type { CreatePropertyDto, Property } from '@/types';
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
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/shared/breadcrumb', () => ({ Breadcrumb: () => null }));
vi.mock('@/features/properties/components/document-upload-dialog', () => ({ DocumentUploadDialog: () => null }));
vi.mock('@/features/properties/components/ical-settings', () => ({
  IcalSettings: () => createElement('p', { 'data-testid': 'ical-settings' }),
}));

/** Stand-in of the property form: one field (name), sends the whole form like the real one. */
function FakePropertyForm({
  property,
  onSubmit,
  onDirtyChange,
}: {
  property: Property;
  onSubmit: (data: CreatePropertyDto) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [name, setName] = useState(property.name);
  return createElement(
    'div',
    null,
    createElement('input', {
      'aria-label': 'base-name',
      value: name,
      onChange: (e: { target: { value: string } }) => {
        setName(e.target.value);
        onDirtyChange?.(e.target.value !== property.name);
      },
    }),
    createElement(
      'button',
      { type: 'button', onClick: () => onSubmit({ ...propertyFormPayload(property), name }) },
      'save-base-data',
    ),
  );
}
vi.mock('@/features/properties/components/property-form', () => ({
  PropertyForm: (props: Parameters<typeof FakePropertyForm>[0]) => createElement(FakePropertyForm, props),
}));

// The wizard reads only these fields: partial objects are cast to the full hook results.
type Hook<T extends (...args: never[]) => unknown> = ReturnType<T>;

const CIN_GUIDANCE_URL = 'https://www.ministeroturismo.gov.it/banca-dati-strutture-ricettive/';

const property = {
  id: 'prop-1',
  name: 'Casa Palermo',
  description: 'Bilocale in centro storico',
  address: 'Via Roma 1',
  city: 'Palermo',
  postalCode: '90133',
  bedrooms: 1,
  bathrooms: 1,
  maxGuests: 4,
  nightlyRate: 90,
  cleaningFee: 30,
  damageDeposit: 0,
  amenities: ['WiFi'],
  houseRules: '',
  timezone: 'Europe/Rome',
  cancellationPolicyId: null,
  isActive: true,
  cinCode: 'IT082053C2ABCDEFGH',
  slug: 'casa-palermo',
  updatedAt: '2026-09-20T10:00:00Z',
} as unknown as Property;

function step(id: string, patch: Partial<ComplianceWizardStep> = {}): ComplianceWizardStep {
  const blocker = !['tourist-tax', 'ical'].includes(id);
  return { id, label: id, status: blocker ? 'complete' : 'warning', blocker, blockers: [], ...patch };
}

function activation(
  complianceStatus: ComplianceActivationResult['complianceStatus'],
  patches: Record<string, Partial<ComplianceWizardStep>> = {},
): ComplianceActivationResult {
  return {
    complianceStatus,
    steps: [
      step('base-data', patches['base-data']),
      step('cin', { linkUrl: CIN_GUIDANCE_URL, ...patches.cin }),
      step('documents', patches.documents),
      step('safety', patches.safety),
      step('tourist-tax', {
        message: 'Server message not shown twice',
        touristTax: { city: 'Palermo', rate: null, publicPageSlug: 'palermo' },
        ...patches['tourist-tax'],
      }),
      step('ical', patches.ical),
    ],
  };
}

function checklistItem(code: SafetyItemCode, patch: Partial<SafetyChecklistItem> = {}): SafetyChecklistItem {
  return {
    code,
    requirement: 'Required',
    status: 'NotAnswered',
    notApplicableReason: null,
    answer: null,
    quantity: null,
    location: null,
    detectorType: null,
    checkedOn: null,
    expiresOn: null,
    evidenceDocumentId: null,
    evidenceFileName: null,
    notes: null,
    ...patch,
  };
}

/** Checklist saved and confirmed on an all-electric flat of one floor: the server says it is complete. */
const savedChecklist: SafetyChecklist = {
  schemaVersion: 2,
  legalBasis: 'DL145/2023 art.13-ter, RS-3 2026-09',
  declarationTextVersion: '2026-09-v1',
  saved: true,
  importedFromLegacy: false,
  facts: { entrepreneurial: false, hasGasSupply: false, combustionAppliances: [], floorCount: 1, floorAreasSqm: [70] },
  items: SAFETY_ITEM_CODES.map((code) => {
    if (code === 'FireExtinguishers') {
      return checklistItem(code, { status: 'Present', answer: 'Present', quantity: 1, location: 'Cucina' });
    }
    if (code === 'BdsrDeclaration') return checklistItem(code, { status: 'Present', answer: 'Present' });
    if (code === 'GasDetector' || code === 'CoDetector') {
      return checklistItem(code, { requirement: 'NotApplicable', status: 'NotApplicable', notApplicableReason: 'NoGasNoCombustion' });
    }
    if (code === 'SystemsCompliance') {
      return checklistItem(code, { requirement: 'NotApplicable', status: 'NotApplicable', notApplicableReason: 'NotEntrepreneurial' });
    }
    return checklistItem(code, { requirement: 'Optional' });
  }),
  minimumExtinguishers: 1,
  isComplete: true,
  blockers: [],
  warnings: [],
  confirmedAt: '2026-09-20T10:00:00Z',
  confirmedTextVersion: '2026-09-v1',
  updatedAt: '2026-09-20T10:00:00Z',
};

function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  });
}

const completeActivation = vi.fn();
const updateProperty = vi.fn();
const updateCin = vi.fn();
const saveChecklist = vi.fn();
const refetchActivation = vi.fn();

function mockActivation(data: ComplianceActivationResult | undefined, state: Record<string, unknown> = {}) {
  vi.mocked(compliance.useComplianceActivation).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    isFetching: false,
    isFetchedAfterMount: true,
    error: null,
    refetch: refetchActivation,
    ...state,
  } as unknown as Hook<typeof compliance.useComplianceActivation>);
}

function renderWizard(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/app/short-rent/properties/prop-1/activation${search}`]}>
      <Routes>
        <Route path="/app/short-rent/properties/:id/activation" element={<PropertyActivationWizard />} />
        <Route path="/app/short-rent/properties/:id" element={<p>property-detail</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const stepButton = (stepId: string) => screen.getByTestId(`activation-step-${stepId}`);
const panel = (stepId: string) => screen.getByTestId(`activation-panel-${stepId}`);
const tosCheckbox = () => screen.queryByRole('checkbox', { name: /Confermo che l'immobile soddisfa/ });

describe('PropertyActivationWizard', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    refetchActivation.mockResolvedValue({});
    mockActivation(activation('Pending'));
    completeActivation.mockResolvedValue({ complianceStatus: 'Active' });
    vi.mocked(compliance.useCompleteComplianceActivation).mockReturnValue({
      mutateAsync: completeActivation,
      isPending: false,
    } as unknown as Hook<typeof compliance.useCompleteComplianceActivation>);
    vi.mocked(compliance.useSafetyChecklist).mockReturnValue({
      data: savedChecklist,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as Hook<typeof compliance.useSafetyChecklist>);
    vi.mocked(compliance.useSaveSafetyChecklist).mockReturnValue({
      mutateAsync: saveChecklist,
      isPending: false,
    } as unknown as Hook<typeof compliance.useSaveSafetyChecklist>);
    vi.mocked(properties.useProperty).mockReturnValue({
      data: property,
      isLoading: false,
      isError: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as Hook<typeof properties.useProperty>);
    vi.mocked(properties.usePropertyDetail).mockReturnValue({
      data: { documents: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as Hook<typeof properties.usePropertyDetail>);
    updateProperty.mockResolvedValue({});
    vi.mocked(properties.useUpdateProperty).mockReturnValue({
      mutateAsync: updateProperty,
      isPending: false,
    } as unknown as Hook<typeof properties.useUpdateProperty>);
    vi.mocked(properties.useUploadPropertyDocument).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as Hook<typeof properties.useUploadPropertyDocument>);
    updateCin.mockResolvedValue({});
    vi.mocked(cin.useUpdatePropertyCin).mockReturnValue({
      mutateAsync: updateCin,
      isPending: false,
    } as unknown as Hook<typeof cin.useUpdatePropertyCin>);
  });

  it('reload_ActivePropertyWithSavedChecklist_PrefilledFromServerAndCompletingSendsOnlyTheTerms', async () => {
    mockActivation(activation('Active'));
    renderWizard();

    // Everything complete on the server: the wizard opens on the summary, with the status of the API.
    expect(screen.getByTestId('compliance-status-badge')).toHaveTextContent('Attivo');
    expect(screen.getByTestId('activation-review')).toBeInTheDocument();
    expect(screen.getByTestId('activation-review-active')).toBeInTheDocument();
    expect(screen.getByTestId('activation-no-blockers')).toBeInTheDocument();

    // Safety step: the saved answers, never empty defaults.
    fireEvent.click(stepButton('safety'));
    expect(panel('safety')).toBeVisible();
    const entrepreneurial = screen.getByRole('group', { name: /forma imprenditoriale/ });
    expect(within(entrepreneurial).getByRole('radio', { name: 'No' })).toBeChecked();
    const gas = screen.getByRole('group', { name: /impianto o una fornitura di gas/ });
    expect(within(gas).getByRole('radio', { name: 'No' })).toBeChecked();
    expect(screen.getByLabelText("Numero di piani dell'unità")).toHaveValue(1);
    const extinguishers = screen.getByTestId('safety-item-FireExtinguishers');
    expect(within(extinguishers).getByLabelText('Numero di estintori')).toHaveValue(1);
    expect(screen.getByTestId('safety-complete')).toBeInTheDocument();

    // Base data and CIN saved without changes: nothing is sent.
    fireEvent.click(stepButton('base-data'));
    fireEvent.click(screen.getByRole('button', { name: 'save-base-data' }));
    await waitFor(() => expect(panel('cin')).toBeVisible());
    expect(screen.getByTestId('activation-cin-input')).toHaveValue('IT082053C2ABCDEFGH');
    fireEvent.click(screen.getByRole('button', { name: /Salva e continua/ }));
    await waitFor(() => expect(panel('documents')).toBeVisible());

    fireEvent.click(stepButton('review'));
    fireEvent.click(tosCheckbox()!);
    fireEvent.click(screen.getByTestId('activation-complete-button'));

    await waitFor(() => expect(completeActivation).toHaveBeenCalledTimes(1));
    // Only the terms: the checklist is never sent (and overwritten with false) when completing.
    expect(completeActivation.mock.calls[0][0]).toEqual({ tosAccepted: true });
    expect(updateProperty).not.toHaveBeenCalled();
    expect(updateCin).not.toHaveBeenCalled();
    expect(saveChecklist).not.toHaveBeenCalled();
    expect(await screen.findByText('property-detail')).toBeInTheDocument();
  });

  it('complete_Conflict409WithThreeBlockers_ListsTranslatedBlockersWithLinksToTheirSteps', async () => {
    completeActivation.mockRejectedValue(
      httpError(409, {
        status: 409,
        code: 'property_activation_blocked',
        detail: "L'immobile non può ancora essere attivato: completa i punti obbligatori elencati.",
        complianceStatus: 'Pending',
        incompleteBlockers: ['cin', 'documents', 'safety'],
        blockers: [
          { step: 'cin', code: 'activation_cin_invalid', message: 'server text 1' },
          { step: 'documents', code: 'activation_documents_missing', message: 'server text 2' },
          { step: 'safety', code: 'safety_gas_detector_missing', message: 'server text 3' },
        ],
      }),
    );
    renderWizard('?step=review');

    fireEvent.click(tosCheckbox()!);
    fireEvent.click(screen.getByTestId('activation-complete-button'));

    const blocked = await screen.findByTestId('activation-blocked');
    expect(blocked).toHaveTextContent("L'immobile non può ancora essere attivato");
    const items = within(blocked).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Il codice CIN non è nel formato ufficiale');
    expect(items[1]).toHaveTextContent("Carica i documenti richiesti per l'attivazione.");
    expect(items[2]).toHaveTextContent('Rilevatore di gas combustibili: obbligatorio');
    expect(blocked).not.toHaveTextContent('server text');

    const links = within(blocked).getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveTextContent('Vai a «Codice CIN»');
    expect(links[0].getAttribute('href')).toMatch(/\/activation\?step=cin$/);
    expect(links[1].getAttribute('href')).toMatch(/\?step=documents$/);
    expect(links[2].getAttribute('href')).toMatch(/\?step=safety$/);
    expect(refetchActivation).toHaveBeenCalled();

    fireEvent.click(links[0]);
    await waitFor(() => expect(panel('cin')).toBeVisible());
    expect(stepButton('cin')).toHaveAttribute('aria-current', 'step');
  });

  it('navigation_StepsAndBackNext_KeepUnsavedInputShowCompletionAndDisableCompleteWithKnownBlockers', async () => {
    mockActivation(
      activation('Pending', {
        cin: {
          status: 'pending',
          blockers: [{ step: 'cin', code: 'activation_cin_missing', message: 'server text' }],
        },
      }),
    );
    vi.mocked(properties.useProperty).mockReturnValue({
      data: { ...property, cinCode: null },
      isLoading: false,
      isError: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as Hook<typeof properties.useProperty>);
    renderWizard();

    // Opens on the first blocking step still open; every step shows whether it is complete.
    expect(stepButton('cin')).toHaveAttribute('aria-current', 'step');
    expect(stepButton('base-data')).toHaveAttribute('data-status', 'complete');
    expect(stepButton('cin')).toHaveAttribute('data-status', 'pending');
    expect(stepButton('cin')).toHaveTextContent('da completare');
    expect(stepButton('ical')).toHaveAttribute('data-status', 'warning');
    expect(screen.getByTestId('activation-wizard-progress-text')).toHaveTextContent(
      '3 di 4 passaggi obbligatori completati',
    );
    expect(screen.getByTestId('activation-step-blockers-cin')).toHaveTextContent("Inserisci il codice CIN dell'immobile.");

    fireEvent.change(screen.getByTestId('activation-cin-input'), { target: { value: 'it-058091-c27g5ffzdz' } });
    fireEvent.click(screen.getByTestId('activation-back'));
    expect(panel('base-data')).toBeVisible();
    fireEvent.change(screen.getByLabelText('base-name'), { target: { value: 'Casa al mare' } });
    fireEvent.click(stepButton('ical'));
    expect(panel('ical')).toBeVisible();
    fireEvent.click(screen.getByTestId('activation-next'));

    // Summary: known blockers with their link, "Completa" disabled, unsaved input flagged.
    const known = screen.getByTestId('activation-known-blockers');
    expect(within(known).getByRole('link', { name: 'Vai a «Codice CIN»' })).toBeInTheDocument();
    expect(screen.getByTestId('activation-unsaved-base-data')).toBeInTheDocument();
    expect(screen.getByTestId('activation-unsaved-cin')).toBeInTheDocument();
    fireEvent.click(tosCheckbox()!);
    expect(screen.getByTestId('activation-complete-button')).toBeDisabled();

    // Back and forth: what was typed is still there, and saving sends only the changes.
    fireEvent.click(stepButton('base-data'));
    expect(screen.getByLabelText('base-name')).toHaveValue('Casa al mare');
    fireEvent.click(screen.getByRole('button', { name: 'save-base-data' }));
    await waitFor(() => expect(updateProperty).toHaveBeenCalledTimes(1));
    expect(updateProperty).toHaveBeenCalledWith({ id: 'prop-1', data: { name: 'Casa al mare' } });

    await waitFor(() => expect(panel('cin')).toBeVisible());
    expect(screen.getByTestId('activation-cin-input')).toHaveValue('it-058091-c27g5ffzdz');
    fireEvent.click(screen.getByRole('button', { name: /Salva e continua/ }));
    await waitFor(() => expect(updateCin).toHaveBeenCalledWith({ propertyId: 'prop-1', cinCode: 'IT058091C27G5FFZDZ' }));
    await waitFor(() => expect(panel('documents')).toBeVisible());
    expect(completeActivation).not.toHaveBeenCalled();
  });

  it('terms_OnlyInSummaryStep_CompleteEnabledOnlyAfterAcceptance', async () => {
    renderWizard('?step=ical');

    expect(panel('ical')).toBeVisible();
    expect(screen.getByTestId('ical-settings')).toBeInTheDocument();
    expect(tosCheckbox()).not.toBeInTheDocument();
    expect(screen.queryByTestId('activation-complete-button')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('activation-next'));
    expect(screen.getByTestId('activation-review')).toBeInTheDocument();
    expect(screen.getByTestId('activation-complete-button')).toBeDisabled();
    expect(screen.queryByTestId('activation-next')).not.toBeInTheDocument();

    fireEvent.click(tosCheckbox()!);
    expect(screen.getByTestId('activation-complete-button')).toBeEnabled();
  });

  it('touristTaxStep_ComuneWithoutRate_ShowsWarningAndPublicPageAndDoesNotBlockCompletion', () => {
    renderWizard('?step=tourist-tax');

    const warning = screen.getByTestId('activation-tourist-tax-missing');
    expect(warning).toHaveTextContent('Il comune di Palermo non ha ancora una tariffa in CasaZen.');
    expect(screen.getByRole('link', { name: /Guida all'imposta di soggiorno a Palermo/ })).toHaveAttribute(
      'href',
      '/p/tassa-soggiorno/palermo',
    );
    expect(document.querySelector('a[href*="/admin/"]')).toBeNull();
    expect(screen.queryByText('Server message not shown twice')).not.toBeInTheDocument();
    expect(stepButton('tourist-tax')).toHaveAttribute('data-status', 'warning');

    fireEvent.click(stepButton('review'));
    expect(screen.getByTestId('activation-no-blockers')).toBeInTheDocument();
  });

  it('cinStep_GuidanceFromApi_LinksTheConfiguredBdsrPage', () => {
    renderWizard('?step=cin');

    const guidance = screen.getByRole('link', { name: /Come ottenere il codice CIN/ });
    expect(guidance).toHaveAttribute('href', CIN_GUIDANCE_URL);
    expect(guidance).toHaveAttribute('target', '_blank');
  });

  it('cinStep_NoGuidanceUrl_RendersNoHardcodedLink', () => {
    mockActivation(activation('Pending', { cin: { linkUrl: null } }));
    renderWizard('?step=cin');

    expect(screen.getByTestId('activation-cin-input')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Come ottenere il codice CIN/ })).not.toBeInTheDocument();
    expect(document.querySelector('a[href*="casazen.app"]')).toBeNull();
  });

  it('cinStep_InvalidFormat_ShowsLocalizedErrorAndSendsNothing', () => {
    renderWizard('?step=cin');

    fireEvent.change(screen.getByTestId('activation-cin-input'), { target: { value: 'IT-12345-0123456789' } });
    fireEvent.click(screen.getByRole('button', { name: /Salva e continua/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('property.validation.cin.format'));
    expect(updateCin).not.toHaveBeenCalled();
    expect(panel('cin')).toBeVisible();
  });

  it('suspendedProperty_FromApi_ShowsSuspendedStatusAndNotice', () => {
    mockActivation(activation('Suspended', { cin: { status: 'pending', blockers: [{ step: 'cin', code: 'activation_cin_missing', message: '' }] } }));
    renderWizard('?step=review');

    expect(screen.getByTestId('compliance-status-badge')).toHaveTextContent('Sospeso');
    expect(screen.getByTestId('activation-review-suspended')).toHaveTextContent("L'immobile è sospeso");
    expect(screen.getByTestId('activation-complete-button')).toBeDisabled();
  });

  it('load_ActivationRequestFails_ShowsErrorWithRetryNotAnEmptyWizard', () => {
    mockActivation(undefined, { isError: true, error: httpError(500, {}) });
    renderWizard();

    expect(screen.getByTestId('activation-load-error')).toHaveTextContent(
      'Impossibile caricare il wizard di attivazione.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(refetchActivation).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('property-activation-wizard')).not.toBeInTheDocument();
  });

  it('refresh_FailsAfterTheWizardStarted_KeepsTheStepsAndWhatWasTyped', () => {
    renderWizard('?step=cin');
    fireEvent.change(screen.getByTestId('activation-cin-input'), { target: { value: 'IT058091C27G5FFZDZ' } });

    mockActivation(activation('Pending'), { isError: true, error: httpError(503, {}) });
    fireEvent.click(stepButton('documents'));

    expect(screen.getByTestId('activation-refresh-error')).toHaveTextContent('Impossibile aggiornare lo stato dei passaggi');
    fireEvent.click(stepButton('cin'));
    expect(screen.getByTestId('activation-cin-input')).toHaveValue('IT058091C27G5FFZDZ');
    expect(screen.queryByTestId('activation-load-error')).not.toBeInTheDocument();
  });

  it('load_CachedStepsNotRefetchedYet_WaitsForTheServer', () => {
    mockActivation(activation('Active'), { isFetchedAfterMount: false, isFetching: true });
    renderWizard();

    expect(screen.getByText('Caricamento wizard attivazione...')).toBeInTheDocument();
    expect(screen.queryByTestId('property-activation-wizard')).not.toBeInTheDocument();
  });
});
