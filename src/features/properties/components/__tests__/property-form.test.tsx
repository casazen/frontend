import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import i18n from '@/i18n/config';
import * as propertyQueries from '@/queries/use-properties';
import type { CancellationPolicyOption, Property } from '@/types';
import { PropertyForm } from '../property-form';

vi.mock('@/queries/use-properties', () => ({ useCancellationPolicies: vi.fn() }));

// The comune picker reads the official ISTAT list: here it is not imported, the form keeps its free-text city (SU-04).
vi.mock('@/queries/use-comuni', () => ({
  useComuneDatasetStatus: () => ({ data: { datasetAvailable: false }, isPending: false, isError: false, refetch: vi.fn() }),
  useComuneSearch: () => ({ data: undefined, isFetching: false, isError: false, isSuccess: false, refetch: vi.fn() }),
  useComune: () => ({ data: undefined, isError: false }),
}));

const POLICIES: CancellationPolicyOption[] = [
  {
    id: 'policy-flex',
    name: 'Flessibile',
    description: 'Rimborso totale fino a 24 ore prima',
    fullRefundHours: 24,
    partialRefundPercent: 50,
    partialRefundHours: 12,
  },
  {
    id: 'policy-strict',
    name: 'Rigida',
    description: 'Nessun rimborso',
    fullRefundHours: 0,
    partialRefundPercent: 0,
    partialRefundHours: 0,
  },
];

const PROPERTY: Property = {
  id: 'prop-1',
  name: 'Monolocale sul porto',
  description: 'Monolocale luminoso con vista sul porto',
  address: 'Via del Porto 3',
  city: 'Genova',
  postalCode: '16128',
  latitude: 44.41,
  longitude: 8.93,
  bedrooms: 0,
  bathrooms: 2,
  maxGuests: 3,
  nightlyRate: 95,
  cleaningFee: 60,
  damageDeposit: 300,
  amenities: ['WiFi', 'Kitchen'],
  photoUrls: ['https://cdn.example/1.jpg'],
  houseRules: 'Niente feste dopo le 23',
  cinCode: 'IT010025C2ABCDEFGH',
  timezone: 'Europe/Vienna',
  cancellationPolicyId: 'policy-flex',
  isActive: false,
  isPaused: false,
  pausedAt: null,
  complianceStatus: 'Pending',
  slug: 'monolocale-porto',
  ownerId: 'auth0|owner',
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-01T10:00:00Z',
};

/** Every field the short-stay form shows, as sent to the API: photos are not a form field (A2-04). */
const ROUND_TRIP = {
  name: 'Monolocale sul porto',
  description: 'Monolocale luminoso con vista sul porto',
  address: 'Via del Porto 3',
  unit: null,
  city: 'Genova',
  // No comune chosen from the official list yet (SU-04): sent as null, which keeps it empty.
  comuneIstatCode: null,
  postalCode: '16128',
  latitude: 44.41,
  longitude: 8.93,
  bedrooms: 0,
  bathrooms: 2,
  maxGuests: 3,
  nightlyRate: 95,
  amenities: ['WiFi', 'Kitchen'],
  cleaningFee: 60,
  damageDeposit: 300,
  houseRules: 'Niente feste dopo le 23',
  timezone: 'Europe/Vienna',
  cancellationPolicyId: 'policy-flex',
  cinCode: 'IT010025C2ABCDEFGH',
  slug: 'monolocale-porto',
};

function mockPolicies(result: Partial<{ data: CancellationPolicyOption[]; isLoading: boolean; isError: boolean; error: unknown }>) {
  vi.mocked(propertyQueries.useCancellationPolicies).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    ...result,
  } as unknown as ReturnType<typeof propertyQueries.useCancellationPolicies>);
}

function renderForm(props: Partial<Parameters<typeof PropertyForm>[0]> = {}) {
  const onSubmit = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <PropertyForm property={PROPERTY} onSubmit={onSubmit} {...props} />
    </I18nextProvider>,
  );
  return onSubmit;
}

function field(key: string): HTMLElement {
  return screen.getByLabelText(i18n.t(key));
}

function change(key: string, value: string | number) {
  fireEvent.change(field(key), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: i18n.t('property.form.update') }));
}

// Whole-form interactions: generous timeout for loaded CI machines, as the other form suites.
describe('PropertyForm (A2-04, A2-27)', { timeout: 20_000 }, () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    mockPolicies({ data: POLICIES });
  });

  it('PropertyForm_EditWithoutChanges_SendsBackEveryFieldAsItWas', async () => {
    const onSubmit = renderForm();

    expect(field('property.form.cleaningFee')).toHaveValue(60);
    expect(field('property.form.damageDeposit')).toHaveValue(300);
    expect(field('property.form.houseRules')).toHaveValue('Niente feste dopo le 23');
    expect(field('property.form.timezone')).toHaveValue('Europe/Vienna');
    expect(field('property.form.cancellationPolicy.label')).toHaveValue('policy-flex');
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual(ROUND_TRIP);
  });

  it('PropertyForm_EditFeesRulesTimezoneAndPolicy_SendsTheNewValues', async () => {
    const onSubmit = renderForm();

    change('property.form.cleaningFee', 45.5);
    change('property.form.damageDeposit', 0);
    change('property.form.houseRules', 'Check-in dalle 15');
    change('property.form.timezone', 'Europe/Rome');
    change('property.form.cancellationPolicy.label', 'policy-strict');
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      ...ROUND_TRIP,
      cleaningFee: 45.5,
      damageDeposit: 0,
      houseRules: 'Check-in dalle 15',
      timezone: 'Europe/Rome',
      cancellationPolicyId: 'policy-strict',
    });
  });

  it('PropertyForm_NoPolicySelected_SendsNullToClearIt', async () => {
    const onSubmit = renderForm();

    change('property.form.cancellationPolicy.label', '');
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].cancellationPolicyId).toBeNull();
  });

  it('PropertyForm_HalfBathroom_IsRejectedBecauseTheApiStoresWholeBathrooms', async () => {
    const onSubmit = renderForm();

    change('property.form.bathrooms', 1.5);
    submit();

    expect(await screen.findByText(i18n.t('property.validation.bathrooms.integer'))).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field('property.form.bathrooms')).toHaveAttribute('step', '1');
  });

  it('PropertyForm_NegativeFee_IsRejectedWithTranslatedMessage', async () => {
    const onSubmit = renderForm();

    change('property.form.cleaningFee', -1);
    submit();

    expect(await screen.findByText(i18n.t('property.validation.cleaningFee.range'))).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // A2-05: "active/paused" is not a field of the generic edit form any more — it's the dedicated pause/activate
  // action (own endpoint), which never overwrites Name/Address/City and never sends its state through here.
  it('PropertyForm_HasNoStandaloneActiveCheckbox', () => {
    renderForm();

    expect(screen.queryByRole('checkbox', { name: /attivo/i })).not.toBeInTheDocument();
  });

  it('PropertyForm_HasNoCountryNorCurrencyField', () => {
    renderForm();

    expect(screen.queryByLabelText(/Paese/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Valuta/)).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('property.form.amountsInEuro'))).toBeInTheDocument();
  });

  it('PropertyForm_PoliciesFailToLoad_ShowsTheErrorAndKeepsTheCurrentPolicy', async () => {
    mockPolicies({ isError: true, error: new Error('boom') });
    const onSubmit = renderForm();

    expect(screen.getByTestId('cancellation-policies-error')).toHaveTextContent(
      i18n.t('property.form.cancellationPolicy.loadError'),
    );
    expect(field('property.form.cancellationPolicy.label')).toBeDisabled();
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].cancellationPolicyId).toBe('policy-flex');
  });

  it('PropertyForm_PoliciesLoaded_KeepsTheSelectionWhenTheOptionsArrive', async () => {
    mockPolicies({ isLoading: true });
    const onSubmit = vi.fn();
    const { rerender } = render(
      <I18nextProvider i18n={i18n}>
        <PropertyForm property={PROPERTY} onSubmit={onSubmit} />
      </I18nextProvider>,
    );
    expect(field('property.form.cancellationPolicy.label')).toHaveValue('policy-flex');

    mockPolicies({ data: POLICIES });
    rerender(
      <I18nextProvider i18n={i18n}>
        <PropertyForm property={PROPERTY} onSubmit={onSubmit} />
      </I18nextProvider>,
    );

    expect(field('property.form.cancellationPolicy.label')).toHaveValue('policy-flex');
    expect(screen.getByText('Rimborso totale fino a 24 ore prima')).toBeInTheDocument();
  });

  it('PropertyForm_NewStudio_SendsZeroBedroomsAndDefaultTimezone', async () => {
    mockPolicies({ data: [] });
    const onSubmit = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <PropertyForm onSubmit={onSubmit} />
      </I18nextProvider>,
    );

    change('property.form.name', 'Monolocale Brera');
    change('property.form.description', 'Monolocale ristrutturato in centro');
    change('property.form.address', 'Via Brera 10');
    change('property.form.city', 'Milano');
    change('property.form.postalCode', '20121');
    change('property.form.bedrooms', 0);
    change('property.form.bathrooms', 1);
    change('property.form.maxGuests', 2);
    change('property.form.nightlyRate', 110);
    change('property.form.cleaningFee', 30);
    change('property.form.damageDeposit', 100);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('property.form.create') }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      bedrooms: 0,
      bathrooms: 1,
      cleaningFee: 30,
      damageDeposit: 100,
      houseRules: '',
      timezone: 'Europe/Rome',
      cancellationPolicyId: null,
    });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('photoUrls');
    expect(screen.getByText(i18n.t('property.form.cancellationPolicy.empty'))).toBeInTheDocument();
  });
});

describe('PropertyForm unit and coordinates (PC-06, A2-19, A2-33)', { timeout: 20_000 }, () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    mockPolicies({ data: POLICIES });
  });

  it('unitField_IsShownWithItsHintAndStartsFromTheStoredUnit', () => {
    renderForm({ property: { ...PROPERTY, unit: 'Scala B int. 5' } });

    expect(field('property.form.unit')).toHaveValue('Scala B int. 5');
    expect(screen.getByText(/Indicalo se nello stesso edificio hai più appartamenti/)).toBeInTheDocument();
  });

  it('unitTyped_IsSentTrimmed', async () => {
    const onSubmit = renderForm();

    change('property.form.unit', '  int. 5  ');
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ unit: 'int. 5' });
  });

  it('unitLeftBlank_IsSentAsNullSoTheApiClearsIt', async () => {
    const onSubmit = renderForm({ property: { ...PROPERTY, unit: 'int. 2' } });

    change('property.form.unit', '   ');
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ unit: null });
  });

  it('unitLongerThanTheLimit_IsRefusedWithItsOwnMessage', async () => {
    const onSubmit = renderForm();

    change('property.form.unit', 'x'.repeat(31));
    submit();

    expect(await screen.findByText("L'interno o la scala può avere al massimo 30 caratteri")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('duplicateAddressConflict_IsShownUnderTheUnitFieldAndTheFormStaysFilled', async () => {
    const conflict = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 409,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { status: 409, title: 'Conflict', code: 'duplicate_property_address' },
    } as AxiosResponse);
    const onSubmit = vi.fn().mockRejectedValue(conflict);
    render(
      <I18nextProvider i18n={i18n}>
        <PropertyForm property={PROPERTY} onSubmit={onSubmit} />
      </I18nextProvider>,
    );

    submit();

    expect(
      await screen.findByText(
        "Hai già un immobile con questo indirizzo: se è un altro appartamento dello stesso edificio, indica l'interno o la scala.",
      ),
    ).toBeInTheDocument();
    expect(field('property.form.address')).toHaveValue('Via del Porto 3');
  });

  it.each([
    ['property.form.latitude', 91, 'La latitudine deve essere un numero tra -90 e 90'],
    ['property.form.latitude', -90.5, 'La latitudine deve essere un numero tra -90 e 90'],
    ['property.form.longitude', 181, 'La longitudine deve essere un numero tra -180 e 180'],
    ['property.form.longitude', -400, 'La longitudine deve essere un numero tra -180 e 180'],
  ])('coordinateOutOfRange_%s_%s_ShowsTheMessageAndSendsNothing', async (key, value, message) => {
    const onSubmit = renderForm();

    change(key, value);
    submit();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('coordinatesWithSixDecimals_AreSentAsTyped', async () => {
    const onSubmit = renderForm();

    change('property.form.latitude', 45.464211);
    change('property.form.longitude', 9.189982);
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ latitude: 45.464211, longitude: 9.189982 });
  });
});
