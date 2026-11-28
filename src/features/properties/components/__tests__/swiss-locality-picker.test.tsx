import { useState, type ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import i18n from '@/i18n/config';
import type { SwissLocality } from '@/types/swiss-places.types';
import { expectNoAxeViolations } from '@/test/axe';
import { SwissLocalityPicker } from '../swiss-locality-picker';

configure({ asyncUtilTimeout: 5_000 });

const api = vi.hoisted(() => ({ searchLocalities: vi.fn(), getMunicipality: vi.fn() }));

vi.mock('@/api/swiss-places.api', () => ({ SWISS_SEARCH_MIN_LENGTH: 2, SwissPlacesApi: api }));

const locality = (postalCode: string, name: string, municipalityCode: string, municipalityName: string, cantonCode = 'TI'): SwissLocality => ({
  postalCode,
  name,
  municipalityCode,
  municipalityName,
  cantonCode,
});
const LUGANO = locality('6900', 'Lugano', '5192', 'Lugano');
const MASSAGNO = locality('6900', 'Massagno', '5189', 'Massagno');
const PARADISO = locality('6900', 'Paradiso', '5195', 'Paradiso');
const VIGANELLO = locality('6962', 'Viganello', '5192', 'Lugano');
const DIRECTORY = [LUGANO, MASSAGNO, PARADISO, VIGANELLO];

function searchDirectory(query: string): SwissLocality[] {
  const text = query.trim().toLowerCase();
  if (/^\d+$/.test(text)) return DIRECTORY.filter((item) => item.postalCode.startsWith(text));
  return DIRECTORY.filter((item) => item.name.toLowerCase().includes(text));
}

function problem(status: number, code: string) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { status, title: 'Problem', code },
  } as AxiosResponse);
}

type PickerProps = Partial<ComponentProps<typeof SwissLocalityPicker>>;

function Harness({ onPick, ...props }: PickerProps & { onPick: (place: SwissLocality | null) => void }) {
  const [municipalityCode, setMunicipalityCode] = useState(props.municipalityCode ?? null);
  const [postalCode, setPostalCode] = useState(props.postalCode ?? '');
  const [city, setCity] = useState(props.city ?? '');
  return (
    <>
      <label htmlFor="swiss-place">Località</label>
      <SwissLocalityPicker
        id="swiss-place"
        {...props}
        municipalityCode={municipalityCode}
        postalCode={postalCode}
        city={city}
        onChange={(place) => {
          onPick(place);
          setMunicipalityCode(place?.municipalityCode ?? null);
          if (place) {
            setCity(place.name);
            setPostalCode(place.postalCode);
          }
        }}
      />
    </>
  );
}

function renderPicker(props: PickerProps = {}) {
  const onPick = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <Harness onPick={onPick} {...props} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return { ...utils, onPick, client };
}

const input = () => screen.getByRole('combobox');

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  api.searchLocalities.mockImplementation(async (query: string) => searchDirectory(query));
  api.getMunicipality.mockResolvedValue({ municipalityCode: '5192', name: 'Lugano', cantonCode: 'TI' });
});

describe('SwissLocalityPicker search', { timeout: 20_000 }, () => {
  it('searches after a pause in typing and lists the places as «6900 Lugano · TI»', async () => {
    renderPicker();

    fireEvent.change(input(), { target: { value: 'lug' } });

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(api.searchLocalities).toHaveBeenCalledTimes(1);
    expect(api.searchLocalities).toHaveBeenCalledWith('lug');
    expect(screen.getByTestId('swiss-locality-option-6900-5192')).toHaveTextContent('6900 Lugano · TI');
    expect(input()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('names the municipality under a locality that lies in another one', async () => {
    renderPicker();

    fireEvent.change(input(), { target: { value: 'vigan' } });

    expect(await screen.findByTestId('swiss-locality-option-6962-5192')).toHaveTextContent('6962 Viganello · TI');
    expect(screen.getByTestId('swiss-locality-option-6962-5192')).toHaveTextContent('Comune di Lugano');
  });

  it('searches a postal code by its digits', async () => {
    renderPicker();

    fireEvent.change(input(), { target: { value: '6900' } });

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(api.searchLocalities).toHaveBeenCalledWith('6900');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('does not search below two characters and says how many are needed', async () => {
    renderPicker();

    fireEvent.change(input(), { target: { value: 'l' } });

    expect(await screen.findByText(i18n.t('swissPlace.picker.minChars', { min: 2 }))).toBeInTheDocument();
    expect(api.searchLocalities).not.toHaveBeenCalled();
  });

  it('says so when nothing matches, and as a result of the search, never as an error', async () => {
    renderPicker();

    fireEvent.change(input(), { target: { value: 'zzz' } });

    expect(await screen.findByText(i18n.t('swissPlace.picker.noResults', { query: 'zzz' }))).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('chooses with the arrow keys and Enter and hands over the whole place', async () => {
    const { onPick } = renderPicker();
    fireEvent.change(input(), { target: { value: '69' } });
    await screen.findByRole('listbox');

    expect(input()).toHaveAttribute('aria-activedescendant', expect.stringMatching(/-0$/));
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(MASSAGNO);
    expect(input()).toHaveValue('6900 Massagno · TI');
    expect(screen.getByTestId('swiss-picker-municipality')).toHaveTextContent('Comune: Massagno · Cantone: TI');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('chooses with the mouse without the input losing the list first', async () => {
    const { onPick } = renderPicker();
    fireEvent.change(input(), { target: { value: 'lug' } });

    fireEvent.mouseDown(await screen.findByTestId('swiss-locality-option-6900-5192'));

    expect(onPick).toHaveBeenCalledWith(LUGANO);
  });

  it('never submits the form with Enter while the list is open, and Escape closes it', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <I18nextProvider i18n={i18n}>
          <form onSubmit={onSubmit}>
            <Harness onPick={vi.fn()} />
          </form>
        </I18nextProvider>
      </QueryClientProvider>,
    );
    fireEvent.change(input(), { target: { value: 'zzz' } });
    await screen.findByText(i18n.t('swissPlace.picker.noResults', { query: 'zzz' }));
    fireEvent.change(input(), { target: { value: 'lug' } });
    await screen.findByRole('listbox');

    fireEvent.keyDown(input(), { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('SwissLocalityPicker proposal from the postal code of the form', { timeout: 20_000 }, () => {
  it('proposes the place of a postal code that leaves one municipality, and the host confirms it', async () => {
    const { onPick } = renderPicker({ postalCode: '6962' });

    const proposal = await screen.findByTestId('swiss-picker-proposal');
    expect(proposal).toHaveTextContent('Conferma il comune: 6962 Viganello · TI');
    expect(onPick).not.toHaveBeenCalled();
    expect(input()).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: i18n.t('swissPlace.picker.confirm') }));

    expect(onPick).toHaveBeenCalledWith(VIGANELLO);
    expect(screen.queryByTestId('swiss-picker-proposal')).not.toBeInTheDocument();
    expect(input()).toHaveValue('6962 Viganello · TI');
    expect(input()).toHaveFocus();
    expect(screen.getByTestId('swiss-picker-municipality')).toHaveTextContent('Comune: Lugano · Cantone: TI');
  });

  it('proposes Lugano (TI) for 6900 once the city is Lugano', async () => {
    const { onPick } = renderPicker({ postalCode: '6900', city: 'Lugano' });

    expect(await screen.findByTestId('swiss-picker-proposal')).toHaveTextContent('Conferma il comune: 6900 Lugano · TI');
    expect(screen.queryByTestId('swiss-picker-candidates')).not.toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('swissPlace.picker.confirm') }));

    expect(onPick).toHaveBeenCalledWith(LUGANO);
  });

  it('lists the candidates of an ambiguous postal code and selects nothing by itself', async () => {
    const { onPick } = renderPicker({ postalCode: '6900' });

    const candidates = await screen.findByTestId('swiss-picker-candidates');
    expect(candidates).toHaveTextContent(i18n.t('swissPlace.picker.ambiguous', { postalCode: '6900' }));
    expect(screen.getByTestId('swiss-candidate-6900-5192')).toHaveTextContent('6900 Lugano · TI');
    expect(screen.getByTestId('swiss-candidate-6900-5189')).toHaveTextContent('6900 Massagno · TI');
    expect(screen.getByTestId('swiss-candidate-6900-5195')).toHaveTextContent('6900 Paradiso · TI');
    expect(screen.queryByTestId('swiss-picker-proposal')).not.toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();
    expect(input()).toHaveValue('');
    expect(screen.queryByTestId('swiss-picker-municipality')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('swiss-candidate-6900-5189'));

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(MASSAGNO);
    expect(screen.queryByTestId('swiss-picker-candidates')).not.toBeInTheDocument();
  });

  it('proposes nothing and asks the directory nothing for a postal code that is not whole', async () => {
    renderPicker({ postalCode: '690' });
    await act(async () => {
      await Promise.resolve();
    });

    expect(api.searchLocalities).not.toHaveBeenCalled();
    expect(screen.queryByTestId('swiss-picker-proposal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('swiss-picker-candidates')).not.toBeInTheDocument();
  });

  it('says a whole postal code is not in the directory, without an error', async () => {
    renderPicker({ postalCode: '1234' });

    expect(await screen.findByText(i18n.t('swissPlace.picker.noPostalCode', { postalCode: '1234' }))).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the proposal off while the host searches by hand', async () => {
    renderPicker({ postalCode: '6962' });
    await screen.findByTestId('swiss-picker-proposal');

    fireEvent.change(input(), { target: { value: 'lug' } });

    expect(screen.queryByTestId('swiss-picker-proposal')).not.toBeInTheDocument();
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
  });

  it('proposes nothing once a place is confirmed', async () => {
    renderPicker({ postalCode: '6900', city: 'Lugano', municipalityCode: '5192', stored: { municipalityCode: '5192', municipalityName: 'Lugano', cantonCode: 'TI' } });
    await act(async () => {
      await Promise.resolve();
    });

    expect(api.searchLocalities).not.toHaveBeenCalled();
    expect(screen.queryByTestId('swiss-picker-proposal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('swiss-picker-candidates')).not.toBeInTheDocument();
  });
});

describe('SwissLocalityPicker stored place', { timeout: 20_000 }, () => {
  it('shows the place the record stores at once, with its canton as a quiet label, without asking the directory', async () => {
    renderPicker({
      postalCode: '6900',
      city: 'Lugano',
      municipalityCode: '5192',
      stored: { municipalityCode: '5192', municipalityName: 'Lugano', cantonCode: 'TI' },
    });

    expect(input()).toHaveValue('6900 Lugano · TI');
    expect(screen.getByTestId('swiss-picker-municipality')).toHaveTextContent('Comune: Lugano · Cantone: TI');
    expect(screen.getByTestId('swiss-picker-clear')).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    expect(api.getMunicipality).not.toHaveBeenCalled();
    expect(api.searchLocalities).not.toHaveBeenCalled();
  });

  it('reads the municipality from the directory when the record does not say its name', async () => {
    renderPicker({ postalCode: '6900', city: 'Lugano', municipalityCode: '5192' });

    expect(await screen.findByTestId('swiss-picker-municipality')).toHaveTextContent('Comune: Lugano · Cantone: TI');
    expect(api.getMunicipality).toHaveBeenCalledWith('5192');
    expect(input()).toHaveValue('6900 Lugano · TI');
  });

  it('says a municipality the directory does not have is not in the list, even with an older answer in the cache', async () => {
    const { client } = renderPicker({ postalCode: '6900', city: 'Lugano', municipalityCode: '5192' });
    expect(await screen.findByTestId('swiss-picker-municipality')).toBeInTheDocument();

    api.getMunicipality.mockRejectedValue(problem(404, 'swiss_municipality_unknown'));
    await act(async () => {
      await client.refetchQueries();
    });

    expect(await screen.findByTestId('swiss-picker-unknown')).toHaveTextContent(i18n.t('swissPlace.picker.codeUnknown', { code: '5192' }));
    expect(screen.queryByTestId('swiss-picker-municipality')).not.toBeInTheDocument();
    expect(screen.queryByTestId('swiss-picker-error')).not.toBeInTheDocument();
  });

  it('clearing the choice hands over null and makes the field free again', async () => {
    const { onPick } = renderPicker({
      postalCode: '1234',
      city: 'Altrove',
      municipalityCode: '5192',
      stored: { municipalityCode: '5192', municipalityName: 'Lugano', cantonCode: 'TI' },
    });

    fireEvent.click(screen.getByTestId('swiss-picker-clear'));

    expect(onPick).toHaveBeenCalledWith(null);
    expect(input()).toHaveValue('');
    expect(input()).toHaveFocus();
    expect(screen.queryByTestId('swiss-picker-municipality')).not.toBeInTheDocument();
    expect(screen.queryByTestId('swiss-picker-clear')).not.toBeInTheDocument();
  });

  it('while the form saves nothing can be pressed', async () => {
    renderPicker({ postalCode: '6962', disabled: true });

    await screen.findByTestId('swiss-picker-proposal');
    expect(input()).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('swissPlace.picker.confirm') })).toBeDisabled();
  });

  it('while the form saves the candidates cannot be pressed and the clear button is gone', async () => {
    renderPicker({ postalCode: '6900', disabled: true });

    await screen.findByTestId('swiss-picker-candidates');
    for (const button of screen.getAllByTestId(/^swiss-candidate-/)) expect(button).toBeDisabled();
  });
});

describe('SwissLocalityPicker directory that fails', { timeout: 20_000 }, () => {
  it('says calmly that the directory is not loaded, never as "no such place", and does not block anything', async () => {
    api.searchLocalities.mockRejectedValue(problem(422, 'swiss_places_unavailable'));
    renderPicker();

    fireEvent.change(input(), { target: { value: 'lug' } });

    const notice = await screen.findByTestId('swiss-picker-unavailable');
    expect(notice).toHaveTextContent(i18n.t('swissPlace.picker.unavailable'));
    expect(notice).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('swissPlace.picker.noResults', { query: 'lug' }))).not.toBeInTheDocument();
    expect(input()).toBeEnabled();
  });

  it('says it for the postal code of the form too', async () => {
    api.searchLocalities.mockRejectedValue(problem(422, 'swiss_places_unavailable'));
    renderPicker({ postalCode: '6900' });

    expect(await screen.findByTestId('swiss-picker-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('swiss-picker-candidates')).not.toBeInTheDocument();
  });

  it('shows an error with a retry when the search fails, never "no results"', async () => {
    api.searchLocalities.mockRejectedValueOnce(new Error('network'));
    renderPicker();

    fireEvent.change(input(), { target: { value: 'lug' } });

    const alert = await screen.findByTestId('swiss-picker-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent(i18n.t('swissPlace.picker.searchError'));
    expect(screen.queryByText(i18n.t('swissPlace.picker.noResults', { query: 'lug' }))).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('swissPlace.picker.retry') }));

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(api.searchLocalities).toHaveBeenCalledTimes(2);
  });

  it('does not show the list of an earlier answer after the search fails', async () => {
    const { client } = renderPicker();
    fireEvent.change(input(), { target: { value: 'lug' } });
    await screen.findByRole('listbox');

    api.searchLocalities.mockRejectedValue(new Error('network'));
    await act(async () => {
      await client.refetchQueries();
    });

    expect(await screen.findByTestId('swiss-picker-error')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows an error with a retry when the stored municipality cannot be read', async () => {
    api.getMunicipality.mockRejectedValueOnce(new Error('network'));
    renderPicker({ postalCode: '6900', city: 'Lugano', municipalityCode: '5192' });

    expect(await screen.findByTestId('swiss-picker-error')).toBeInTheDocument();
    expect(screen.queryByTestId('swiss-picker-unknown')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('swissPlace.picker.retry') }));

    expect(await screen.findByTestId('swiss-picker-municipality')).toHaveTextContent('Comune: Lugano · Cantone: TI');
  });
});

describe('SwissLocalityPicker accessibility', { timeout: 20_000 }, () => {
  it('has no accessibility violation with the list open', async () => {
    const { container } = renderPicker();
    fireEvent.change(input(), { target: { value: '69' } });
    await screen.findByRole('listbox');

    await expectNoAxeViolations(container);
  });

  it('has no accessibility violation with the candidates of an ambiguous postal code', async () => {
    const { container } = renderPicker({ postalCode: '6900' });
    await screen.findByTestId('swiss-picker-candidates');

    await expectNoAxeViolations(container);
  });

  it('has no accessibility violation with the proposal and with a place confirmed', async () => {
    const { container } = renderPicker({ postalCode: '6962' });
    await screen.findByTestId('swiss-picker-proposal');
    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('swissPlace.picker.confirm') }));
    await waitFor(() => expect(screen.getByTestId('swiss-picker-municipality')).toBeInTheDocument());
    await expectNoAxeViolations(container);
  });
});
