import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { propertiesApi } from '@/api/properties.api';
import type { Property, PropertyDocumentDto } from '@/types';
import { LongRentPropertyWizard } from '../long-rent-property-wizard';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/properties.api', () => ({
  propertiesApi: { create: vi.fn(), updateCadastral: vi.fn(), uploadDocument: vi.fn(), getDocuments: vi.fn() },
}));
// The comune list and the pages of a document have their own tests: here a button stands for each, and it does what the person would.
vi.mock('@/components/shared/comune-picker', () => ({
  ComunePicker: ({ id, onChange }: { id: string; onChange: (comune: { istatCode: string; name: string }) => void }) => (
    <button type="button" id={id} data-testid="fake-comune" onClick={() => onChange({ istatCode: '015146', name: 'Milano' })}>
      comune
    </button>
  ),
}));
vi.mock('@/components/documents/document-pages', () => ({
  DocumentPages: ({ onChange }: { onChange: (value: unknown) => void }) => (
    <button
      type="button"
      data-testid="fake-pages"
      onClick={() => onChange({ pages: [{ id: 'p1', file: new File(['%PDF-1.4'], 'ape.pdf', { type: 'application/pdf' }), rotation: 0 }], confirmed: false })}
    >
      pagine
    </button>
  ),
}));

const WAIT = { timeout: 5000 };
const PROPERTY_ID = 'prop-1';
const PROPERTY = { id: PROPERTY_ID, name: 'Bilocale Monza', rentalMode: 'Long' } as unknown as Property;
const APE = {
  id: 'doc-1',
  fileName: 'ape.pdf',
  documentType: 'Ape',
  apeCode: '12345-678',
  apeEnergyClass: 'B',
  apeCheck: 'Verified',
  apeIdentificationSource: 'Document',
} as unknown as PropertyDocumentDto;

function problem(status: number, code: string): AxiosError {
  const error = new AxiosError(`Request failed with status code ${status}`);
  error.response = { status, data: { status, code }, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } };
  return error;
}

function renderWizard() {
  const onPlanLimit = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/app/long-rent/properties/new']}>
          <Routes>
            <Route path="/app/long-rent/properties/new" element={<LongRentPropertyWizard onPlanLimit={onPlanLimit} onExit={vi.fn()} />} />
            <Route path="/app/long-rent/properties" element={<div data-testid="list" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return { onPlanLimit };
}

const next = () => fireEvent.click(screen.getByTestId('long-rent-property-wizard-next'));
const finish = () => fireEvent.click(screen.getByTestId('long-rent-property-wizard-finish'));
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function onStep(step: string) {
  await waitFor(() => expect(screen.getByTestId('long-rent-property-wizard')).toHaveAttribute('data-step', step), WAIT);
}

/** Fills the four steps: the place, the cadastral data (all of them) and the APE; stops on the summary. */
async function fillEverything() {
  fireEvent.change(screen.getByTestId('long-rent-wizard-name'), { target: { value: 'Bilocale Monza' } });
  fireEvent.click(screen.getByTestId('fake-comune'));
  type(i18n.t('property.form.address'), 'Via Italia 1');
  type(i18n.t('property.form.postalCode'), '20900');
  next();
  await onStep('cadastral');
  type(i18n.t('longRentProperties.cadastral.sheet'), '12');
  type(i18n.t('longRentProperties.cadastral.parcel'), '345');
  type(i18n.t('longRentProperties.cadastral.category'), 'A/2');
  type(i18n.t('longRentProperties.cadastral.income'), '450,50');
  next();
  await onStep('ape');
  fireEvent.click(screen.getByTestId('fake-pages'));
  next();
  await onStep('review');
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
  vi.mocked(propertiesApi.create).mockResolvedValue(PROPERTY);
  vi.mocked(propertiesApi.updateCadastral).mockResolvedValue(undefined);
  vi.mocked(propertiesApi.uploadDocument).mockResolvedValue(APE);
  vi.mocked(propertiesApi.getDocuments).mockResolvedValue([APE]);
});

afterEach(() => cleanup());

describe('LongRentPropertyWizard: "Aggiungi immobile" (LR-07c)', { timeout: 30000 }, () => {
  it('LongRentPropertyWizard_AllFourSteps_CreatesTheLongTermPropertyThenSavesTheCadastralDataAndTheApe', async () => {
    renderWizard();
    await fillEverything();
    finish();

    await screen.findByTestId('long-rent-wizard-done', undefined, WAIT);
    // The section decides the mode: always `Long`, with only what the API cannot do without.
    expect(propertiesApi.create).toHaveBeenCalledTimes(1);
    expect(propertiesApi.create).toHaveBeenCalledWith({
      name: 'Bilocale Monza',
      address: 'Via Italia 1',
      unit: null,
      city: 'Milano',
      comuneIstatCode: '015146',
      postalCode: '20900',
      description: '',
      bedrooms: 1,
      bathrooms: 1,
      maxGuests: 0,
      nightlyRate: 0,
      rentalMode: 'Long',
    });
    expect(propertiesApi.updateCadastral).toHaveBeenCalledWith(PROPERTY_ID, { sheet: '12', parcel: '345', subaltern: null, category: 'A/2', income: 450.5 });
    expect(propertiesApi.uploadDocument).toHaveBeenCalledWith(PROPERTY_ID, expect.any(File), 'Ape');
    // Everything the contract needs is there: it is the way on, and nothing is left to do.
    expect(screen.getByTestId('wizard-done-primary')).toHaveAttribute('href', `/app/long-rent/leases/new?propertyId=${PROPERTY_ID}`);
    expect(screen.getByTestId('wizard-done-secondary')).toHaveAttribute('href', `/app/long-rent/properties/${PROPERTY_ID}`);
    expect(screen.queryByTestId('long-rent-wizard-todo')).not.toBeInTheDocument();
  });

  it('LongRentPropertyWizard_TheCadastralDataAndTheApeFailAfterTheCreation_TheLastScreenKeepsThePropertyAndSaysWhatIsLeft', async () => {
    vi.mocked(propertiesApi.updateCadastral).mockRejectedValue(problem(500, 'internal_error'));
    vi.mocked(propertiesApi.uploadDocument).mockRejectedValue(new Error('network'));
    renderWizard();
    await fillEverything();
    finish();

    await screen.findByTestId('long-rent-wizard-done', undefined, WAIT);
    // The property exists and was created once: what failed after it never asks to create it again.
    expect(propertiesApi.create).toHaveBeenCalledTimes(1);
    const todo = screen.getByTestId('long-rent-wizard-todo');
    expect(todo).toHaveTextContent(i18n.t('longRentProperties.wizard.done.todo.cadastralFailed'));
    expect(todo).toHaveTextContent(i18n.t('longRentProperties.wizard.done.todo.apeFailed'));
    // The contract cannot be made yet: the way on is the property, where the data are added.
    expect(screen.getByTestId('wizard-done-primary')).toHaveAttribute('href', `/app/long-rent/properties/${PROPERTY_ID}`);
  });

  it('LongRentPropertyWizard_ADuplicateAddress_SavesNothingElseAndSaysWhereToFixIt', async () => {
    vi.mocked(propertiesApi.create).mockRejectedValue(problem(409, 'duplicate_property_address'));
    renderWizard();
    await fillEverything();
    finish();

    const error = await screen.findByTestId('long-rent-property-wizard-finish-error', undefined, WAIT);
    expect(error).toHaveTextContent(i18n.t('longRentProperties.wizard.duplicate'));
    expect(screen.getByTestId('long-rent-property-wizard')).toHaveAttribute('data-step', 'review');
    expect(propertiesApi.updateCadastral).not.toHaveBeenCalled();
    expect(propertiesApi.uploadDocument).not.toHaveBeenCalled();
  });
});
