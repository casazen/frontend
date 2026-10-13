import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { Comune } from '@/types/comune.types';
import type { Property } from '@/types';
import { PropertyForm } from '../property-form';

// The comune picker reads the official ISTAT list: its answers are set per test.
const comuni = vi.hoisted(() => ({
  status: { data: { datasetAvailable: true }, isPending: false, isError: false, refetch: () => undefined } as Record<string, unknown>,
  search: { data: undefined, isFetching: false, isError: false, isSuccess: false, refetch: () => undefined } as Record<string, unknown>,
  stored: { data: undefined, isError: false } as Record<string, unknown>,
}));

vi.mock('@/queries/use-comuni', () => ({
  useComuneDatasetStatus: () => comuni.status,
  useComuneSearch: () => comuni.search,
  useComune: () => comuni.stored,
}));
vi.mock('@/queries/use-properties', () => ({
  useCancellationPolicies: () => ({ data: [], isLoading: false, isError: false, error: null }),
}));

// Rows of the official ISTAT list (ISTAT, 21/02/2026).
const MILANO: Comune = {
  istatCode: '015146',
  cadastralCode: 'F205',
  name: 'Milano',
  displayName: 'Milano',
  provinceCode: 'MI',
  regionCode: 'LOM',
  regionIstatCode: '03',
  regionName: 'Lombardia',
  isActive: true,
};

const PROPERTY: Property = {
  id: 'prop-1',
  name: 'Monolocale sul porto',
  description: 'Monolocale luminoso con vista sul porto',
  address: 'Via del Porto 3',
  city: 'Genova',
  postalCode: '16128',
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
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-01T10:00:00Z',
};

function renderForm(property: Property = PROPERTY) {
  const onSubmit = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <PropertyForm property={property} onSubmit={onSubmit} />
    </I18nextProvider>,
  );
  return onSubmit;
}

const city = () => screen.getByLabelText(i18n.t('property.form.city'));

beforeEach(async () => {
  await i18n.changeLanguage('it');
  comuni.status = { data: { datasetAvailable: true }, isPending: false, isError: false, refetch: () => undefined };
  comuni.search = { data: undefined, isFetching: false, isError: false, isSuccess: false, refetch: () => undefined };
  comuni.stored = { data: undefined, isError: false };
});

describe('PropertyForm comune (SU-04)', { timeout: 20_000 }, () => {
  it('picks the comune from the official list: the city follows it and the code is sent', async () => {
    comuni.search = { data: { datasetAvailable: true, items: [MILANO] }, isFetching: false, isError: false, isSuccess: true, refetch: () => undefined };
    const onSubmit = renderForm();
    expect(screen.getByTestId('property-comune-legacy')).toHaveTextContent('Genova');

    fireEvent.change(screen.getByTestId('comune-picker-input'), { target: { value: 'mil' } });
    fireEvent.mouseDown(await screen.findByTestId('comune-option-015146'));

    await waitFor(() => expect(city()).toHaveValue('Milano'));
    expect(city()).toHaveAttribute('readonly');
    expect(screen.queryByTestId('property-comune-legacy')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('property.form.update') }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ city: 'Milano', comuneIstatCode: '015146' });
  });

  it('shows the stored comune with its region and sends its code unchanged', async () => {
    comuni.stored = { data: MILANO, isError: false };
    const onSubmit = renderForm({ ...PROPERTY, city: 'Milano', comuneIstatCode: '015146', regionCode: 'LOM' });

    expect(await screen.findByDisplayValue('Milano (MI)')).toBeInTheDocument();
    expect(screen.getByTestId('comune-picker-region')).toHaveTextContent('Lombardia');
    expect(screen.queryByTestId('property-comune-legacy')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('property.form.update') }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ city: 'Milano', comuneIstatCode: '015146' });
  });

  it('clearing the choice lets the host write another city and sends null', async () => {
    comuni.stored = { data: MILANO, isError: false };
    const onSubmit = renderForm({ ...PROPERTY, city: 'Milano', comuneIstatCode: '015146', regionCode: 'LOM' });
    await screen.findByDisplayValue('Milano (MI)');

    fireEvent.click(screen.getByRole('button', { name: i18n.t('comune.picker.clear') }));

    await waitFor(() => expect(city()).not.toHaveAttribute('readonly'));
    fireEvent.change(city(), { target: { value: 'Lecco' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('property.form.update') }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ city: 'Lecco', comuneIstatCode: null });
  });

  it('while the list is not imported the city stays free text and nothing is sent as a code', async () => {
    comuni.status = { data: { datasetAvailable: false }, isPending: false, isError: false, refetch: () => undefined };
    const onSubmit = renderForm();

    expect(screen.getByTestId('comune-picker-unavailable')).toBeInTheDocument();
    expect(city()).not.toHaveAttribute('readonly');
    fireEvent.change(city(), { target: { value: 'Savona' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('property.form.update') }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ city: 'Savona', comuneIstatCode: null });
  });
});
