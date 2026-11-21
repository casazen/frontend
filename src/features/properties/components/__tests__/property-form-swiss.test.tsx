import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import i18n from '@/i18n/config';
import type { Property } from '@/types';
import type { SwissLocality } from '@/types/swiss-places.types';
import { PropertyForm } from '../property-form';

// The whole form is rendered and the search waits a quarter of a second after the last key: the awaits get more room on a loaded machine.
configure({ asyncUtilTimeout: 5_000 });

// The Swiss place picker reads the official directory (E29/F01/US02/T01): its answers are set per test.
const api = vi.hoisted(() => ({ searchLocalities: vi.fn(), getMunicipality: vi.fn() }));

vi.mock('@/api/swiss-places.api', () => ({ SWISS_SEARCH_MIN_LENGTH: 2, SwissPlacesApi: api }));
vi.mock('@/queries/use-properties', () => ({
  useCancellationPolicies: () => ({ data: [], isLoading: false, isError: false, error: null }),
}));
vi.mock('@/queries/use-amenity-catalog', () => ({
  useAmenityCatalog: () => ({ data: { groups: [], amenities: [] }, isLoading: false, isError: false }),
  useAmenityLabels: () => (name: string) => name,
}));
// The comune picker of an Italian house reads the ISTAT list: not under test here.
vi.mock('@/queries/use-comuni', () => ({
  useComuneDatasetStatus: () => ({ data: { datasetAvailable: false }, isPending: false, isError: false, refetch: vi.fn() }),
  useComuneSearch: () => ({ data: undefined, isFetching: false, isError: false, isSuccess: false, refetch: vi.fn() }),
  useComune: () => ({ data: undefined, isError: false }),
}));

// Rows as the directory gives them (the official BFS number of Lugano is 5192; the other numbers are invented).
const locality = (postalCode: string, name: string, municipalityCode: string, municipalityName: string): SwissLocality => ({
  postalCode,
  name,
  municipalityCode,
  municipalityName,
  cantonCode: 'TI',
});
const LUGANO = locality('6900', 'Lugano', '5192', 'Lugano');
const MASSAGNO = locality('6900', 'Massagno', '5189', 'Massagno');
const PARADISO = locality('6900', 'Paradiso', '5195', 'Paradiso');
const VIGANELLO = locality('6962', 'Viganello', '5192', 'Lugano');
const DIRECTORY = [LUGANO, MASSAGNO, PARADISO, VIGANELLO];

/** A small directory with the search of the API: a postal code by its first digits, a name by what it contains. */
function searchDirectory(query: string): SwissLocality[] {
  const text = query.trim().toLowerCase();
  if (/^\d+$/.test(text)) return DIRECTORY.filter((item) => item.postalCode.startsWith(text));
  return DIRECTORY.filter((item) => item.name.toLowerCase().includes(text));
}

const ITALIAN_PROPERTY: Property = {
  id: 'prop-it',
  name: 'Monolocale sul porto',
  description: 'Monolocale luminoso con vista sul porto',
  address: 'Via del Porto 3',
  city: 'Genova',
  postalCode: '16128',
  country: 'IT',
  currency: 'EUR',
  bedrooms: 0,
  bathrooms: 2,
  maxGuests: 3,
  nightlyRate: 95,
  cleaningFee: 60,
  damageDeposit: 300,
  amenities: [],
  photoUrls: [],
  houseRules: '',
  cinCode: null,
  timezone: 'Europe/Rome',
  cancellationPolicyId: null,
  isActive: false,
  isPaused: false,
  pausedAt: null,
  ownerId: 'auth0|owner',
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
};

/** A house in Switzerland whose place the host has not confirmed (an old record: the postal code and the city only). */
const SWISS_PROPERTY: Property = {
  ...ITALIAN_PROPERTY,
  id: 'prop-ch',
  name: 'Casa sul lago',
  description: 'Casa luminosa con vista sul lago',
  address: 'Via Nassa 5',
  city: 'Lugano',
  postalCode: '6900',
  country: 'CH',
  currency: 'CHF',
  timezone: 'Europe/Zurich',
};

/** The same house once the host confirmed Lugano (TI): the record carries the municipality, its name and its canton. */
const CONFIRMED_PROPERTY: Property = {
  ...SWISS_PROPERTY,
  swissMunicipalityCode: '5192',
  swissMunicipalityName: 'Lugano',
  swissCantonCode: 'TI',
};

function problem(status: number, code: string) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { status, title: 'Problem', code },
  } as AxiosResponse);
}

function renderForm(props: Partial<Parameters<typeof PropertyForm>[0]> = {}) {
  const onSubmit = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <PropertyForm property={SWISS_PROPERTY} onSubmit={onSubmit} {...props} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return onSubmit;
}

const label = (key: string) => screen.getByLabelText(i18n.t(key));
const city = () => label('property.form.city');
const postalCode = () => label('property.form.postalCode');
const country = () => label('property.country');
// The native selects of the form are comboboxes too: the picker is found by its own test id.
const placeInput = () => screen.getByTestId('swiss-picker-input');

function submit() {
  fireEvent.click(screen.getByRole('button', { name: i18n.t('property.form.update') }));
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  api.searchLocalities.mockImplementation(async (query: string) => searchDirectory(query));
  api.getMunicipality.mockResolvedValue({ municipalityCode: '5192', name: 'Lugano', cantonCode: 'TI' });
});

// Whole-form interactions: generous timeout for loaded CI machines, as the other form suites.
describe('PropertyForm Swiss place (E29/F01/US02/T01, NF-124)', { timeout: 20_000 }, () => {
  it('typing 6900 in a Swiss property proposes Lugano (TI) and the confirmed place is saved on the property', async () => {
    const onSubmit = renderForm({ property: { ...SWISS_PROPERTY, postalCode: '' } });

    fireEvent.change(postalCode(), { target: { value: '6900' } });
    const proposal = await screen.findByTestId('swiss-picker-proposal');
    expect(proposal).toHaveTextContent('Conferma il comune: 6900 Lugano · TI');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('swissPlace.picker.confirm') }));

    // The place fills the postal code, the city and the municipality; the canton is a quiet label, and the text is the place's.
    await waitFor(() => expect(placeInput()).toHaveValue('6900 Lugano · TI'));
    expect(screen.getByTestId('swiss-picker-municipality')).toHaveTextContent('Comune: Lugano · Cantone: TI');
    expect(postalCode()).toHaveValue('6900');
    expect(postalCode()).toHaveAttribute('readonly');
    expect(city()).toHaveValue('Lugano');
    expect(city()).toHaveAttribute('readonly');
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      country: 'CH',
      currency: 'CHF',
      city: 'Lugano',
      postalCode: '6900',
      swissMunicipalityCode: '5192',
    });
  });

  it('an ambiguous postal code shows the candidates and selects nothing by itself', async () => {
    const onSubmit = renderForm({ property: { ...SWISS_PROPERTY, city: 'Sorengo', postalCode: '' } });

    fireEvent.change(postalCode(), { target: { value: '6900' } });
    await screen.findByTestId('swiss-picker-candidates');
    expect(screen.getAllByTestId(/^swiss-candidate-/)).toHaveLength(3);
    expect(screen.queryByTestId('swiss-picker-proposal')).not.toBeInTheDocument();
    expect(placeInput()).toHaveValue('');
    expect(city()).toHaveValue('Sorengo');
    expect(city()).not.toHaveAttribute('readonly');

    // Saving is never blocked by a place that is not confirmed: nothing is chosen for the host.
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ city: 'Sorengo', postalCode: '6900', swissMunicipalityCode: null });
  });

  it('a candidate the host chooses gives the place', async () => {
    const onSubmit = renderForm({ property: { ...SWISS_PROPERTY, city: 'Sorengo', postalCode: '6900' } });

    fireEvent.click(await screen.findByTestId('swiss-candidate-6900-5189'));
    await waitFor(() => expect(city()).toHaveValue('Massagno'));
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ city: 'Massagno', postalCode: '6900', swissMunicipalityCode: '5189' });
  });

  it('a place picked from the search fills the postal code, the city and the municipality', async () => {
    const onSubmit = renderForm({ property: { ...SWISS_PROPERTY, city: 'Altrove', postalCode: '1234' } });

    fireEvent.change(placeInput(), { target: { value: 'vigan' } });
    fireEvent.mouseDown(await screen.findByTestId('swiss-locality-option-6962-5192'));
    await waitFor(() => expect(city()).toHaveValue('Viganello'));
    expect(postalCode()).toHaveValue('6962');
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ city: 'Viganello', postalCode: '6962', swissMunicipalityCode: '5192' });
  });

  it('shows the stored place and sends it back as it was', async () => {
    const onSubmit = renderForm({ property: CONFIRMED_PROPERTY });

    expect(placeInput()).toHaveValue('6900 Lugano · TI');
    expect(screen.getByTestId('swiss-picker-municipality')).toHaveTextContent('Comune: Lugano · Cantone: TI');
    expect(screen.queryByTestId('swiss-picker-proposal')).not.toBeInTheDocument();
    expect(api.searchLocalities).not.toHaveBeenCalled();
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ city: 'Lugano', postalCode: '6900', swissMunicipalityCode: '5192' });
  });

  it('a property that only has a postal code is asked to confirm the municipality, and saving is never blocked', async () => {
    const onSubmit = renderForm({ property: SWISS_PROPERTY });

    expect(await screen.findByTestId('swiss-picker-proposal')).toHaveTextContent('Conferma il comune');
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ city: 'Lugano', postalCode: '6900', swissMunicipalityCode: null });
  });

  it('clearing the stored place lets the host write another city, and sends null', async () => {
    const onSubmit = renderForm({ property: CONFIRMED_PROPERTY });
    expect(city()).toHaveAttribute('readonly');

    fireEvent.click(screen.getByRole('button', { name: i18n.t('swissPlace.picker.clear') }));
    await waitFor(() => expect(city()).not.toHaveAttribute('readonly'));
    fireEvent.change(city(), { target: { value: 'Ascona' } });
    fireEvent.change(postalCode(), { target: { value: '6612' } });
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ city: 'Ascona', postalCode: '6612', swissMunicipalityCode: null });
  });

  it('switching the country to Italy clears the Swiss place', async () => {
    const onSubmit = renderForm({ property: CONFIRMED_PROPERTY });
    expect(placeInput()).toHaveValue('6900 Lugano · TI');

    fireEvent.change(country(), { target: { value: 'IT' } });

    await waitFor(() => expect(screen.queryByTestId('property-swiss-place-field')).not.toBeInTheDocument());
    expect(screen.getByTestId('property-comune-field')).toBeInTheDocument();
    expect(city()).not.toHaveAttribute('readonly');
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ country: 'IT', currency: 'EUR' });
    // A house of Italy never sends a Swiss municipality.
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('swissMunicipalityCode');

    // Back to Switzerland: the place that was cleared is not there any more, the host confirms it again.
    fireEvent.change(country(), { target: { value: 'CH' } });
    expect(await screen.findByTestId('property-swiss-place-field')).toBeInTheDocument();
    expect(placeInput()).toHaveValue('');
    expect(screen.queryByTestId('swiss-picker-municipality')).not.toBeInTheDocument();
  });

  it('no Italian-only field appears for a Swiss property, and no Swiss one for an Italian property', async () => {
    renderForm({ property: SWISS_PROPERTY });

    expect(screen.getByTestId('property-swiss-place-field')).toBeInTheDocument();
    expect(screen.queryByTestId('property-comune-field')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comune-picker-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-cin-input')).not.toBeInTheDocument();
  });

  it('a house in Italy has no Swiss place field, and sends no Swiss municipality', async () => {
    const onSubmit = renderForm({ property: ITALIAN_PROPERTY });

    expect(screen.queryByTestId('property-swiss-place-field')).not.toBeInTheDocument();
    expect(screen.getByTestId('property-comune-field')).toBeInTheDocument();
    expect(screen.getByTestId('property-cin-input')).toBeInTheDocument();
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('swissMunicipalityCode');
    expect(api.searchLocalities).not.toHaveBeenCalled();
  });

  it('the long-term form of a Swiss house has the place field too, and sends the municipality', async () => {
    const onSubmit = renderForm({ variant: 'long-rent', property: { ...CONFIRMED_PROPERTY, maxGuests: 0, nightlyRate: 0 } });

    expect(screen.getByTestId('property-swiss-place-field')).toBeInTheDocument();
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ country: 'CH', swissMunicipalityCode: '5192' });
  });

  it('a directory that is not loaded is said calmly and never blocks the save', async () => {
    api.searchLocalities.mockRejectedValue(problem(422, 'swiss_places_unavailable'));
    const onSubmit = renderForm({ property: SWISS_PROPERTY });

    expect(await screen.findByTestId('swiss-picker-unavailable')).toHaveTextContent(i18n.t('swissPlace.picker.unavailable'));
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ city: 'Lugano', postalCode: '6900', swissMunicipalityCode: null });
  });

  it('while the form saves the picker cannot be used', async () => {
    renderForm({ property: SWISS_PROPERTY, isLoading: true });

    await screen.findByTestId('swiss-picker-proposal');
    expect(placeInput()).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('swissPlace.picker.confirm') })).toBeDisabled();
  });

  it('a new property has no Swiss picker: the API makes it Italian and refuses a municipality, so the place is confirmed when it is edited', async () => {
    const onSubmit = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <I18nextProvider i18n={i18n}>
          <PropertyForm onSubmit={onSubmit} />
        </I18nextProvider>
      </QueryClientProvider>,
    );

    fireEvent.change(country(), { target: { value: 'CH' } });
    fireEvent.change(label('property.form.name'), { target: { value: 'Casa sul lago' } });
    fireEvent.change(label('property.form.description'), { target: { value: 'Casa luminosa con vista sul lago' } });
    fireEvent.change(label('property.form.address'), { target: { value: 'Via Nassa 5' } });
    fireEvent.change(city(), { target: { value: 'Lugano' } });
    fireEvent.change(postalCode(), { target: { value: '6900' } });
    fireEvent.change(label('property.form.bedrooms'), { target: { value: 2 } });
    fireEvent.change(label('property.form.bathrooms'), { target: { value: 1 } });
    fireEvent.change(label('property.form.maxGuests'), { target: { value: 4 } });
    fireEvent.change(label('property.form.nightlyRate'), { target: { value: 150 } });

    expect(screen.queryByTestId('property-swiss-place-field')).not.toBeInTheDocument();
    expect(screen.queryByTestId('swiss-picker-proposal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('property.form.create') }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ country: 'CH', city: 'Lugano', postalCode: '6900', swissMunicipalityCode: null });
    expect(api.searchLocalities).not.toHaveBeenCalled();
  });
});
