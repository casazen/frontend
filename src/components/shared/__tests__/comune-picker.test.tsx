import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { Comune } from '@/types/comune.types';
import { ComunePicker } from '../comune-picker';

const api = vi.hoisted(() => ({ getStatus: vi.fn(), search: vi.fn(), getByIstatCode: vi.fn() }));

vi.mock('@/api/comuni.api', () => ({ COMUNE_SEARCH_MIN_LENGTH: 2, ComuniApi: api }));

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
const MILAZZO: Comune = {
  istatCode: '083049',
  cadastralCode: 'F206',
  name: 'Milazzo',
  displayName: 'Milazzo',
  provinceCode: 'ME',
  regionCode: 'SIC',
  regionIstatCode: '19',
  regionName: 'Sicilia',
  isActive: true,
};
const BOLZANO: Comune = {
  istatCode: '021008',
  cadastralCode: 'A952',
  name: 'Bolzano',
  displayName: 'Bolzano/Bozen',
  provinceCode: 'BZ',
  regionCode: 'TAA',
  regionIstatCode: '04',
  regionName: 'Trentino-Alto Adige/Südtirol',
  isActive: true,
};

function renderPicker(props: Partial<React.ComponentProps<typeof ComunePicker>> = {}) {
  const onChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <label htmlFor="comune">Comune</label>
        <ComunePicker id="comune" istatCode={null} onChange={onChange} {...props} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return { ...utils, onChange };
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  api.getStatus.mockResolvedValue({ datasetAvailable: true, referenceDate: '2026-02-21', sourceVersion: 'ISTAT' });
  api.search.mockResolvedValue({ datasetAvailable: true, items: [] });
});

describe('ComunePicker', () => {
  it('says that the list is loading, and not "not available", while it checks', () => {
    api.getStatus.mockReturnValue(new Promise(() => {}));
    renderPicker();

    expect(screen.getByTestId('comune-picker-loading-list')).toBeInTheDocument();
    expect(screen.queryByTestId('comune-picker-unavailable')).not.toBeInTheDocument();
  });

  it('says the list is not available when it is not imported, and offers the fallback of the form', async () => {
    api.getStatus.mockResolvedValue({ datasetAvailable: false });
    renderPicker({ unavailableFallback: <input data-testid="free-text" /> });

    expect(await screen.findByTestId('comune-picker-unavailable')).toHaveTextContent('Elenco dei comuni non disponibile');
    expect(screen.getByTestId('free-text')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(api.search).not.toHaveBeenCalled();
  });

  it('shows an error with a retry when the list cannot be checked, never "not available"', async () => {
    api.getStatus.mockRejectedValueOnce(new Error('network'));
    renderPicker({ unavailableFallback: <input data-testid="free-text" /> });

    expect(await screen.findByTestId('comune-picker-status-error')).toBeInTheDocument();
    expect(screen.queryByTestId('comune-picker-unavailable')).not.toBeInTheDocument();
    expect(screen.getByTestId('free-text')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
    expect(api.getStatus).toHaveBeenCalledTimes(2);
  });

  it('searches after a pause in typing and lists the comuni with province and region', async () => {
    api.search.mockResolvedValue({ datasetAvailable: true, items: [MILANO, MILAZZO] });
    renderPicker();
    const input = await screen.findByRole('combobox');

    fireEvent.change(input, { target: { value: 'mil' } });

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(api.search).toHaveBeenCalledTimes(1);
    expect(api.search).toHaveBeenCalledWith('mil');
    expect(screen.getByTestId('comune-option-015146')).toHaveTextContent('Milano (MI)');
    expect(screen.getByTestId('comune-option-015146')).toHaveTextContent('Lombardia');
    expect(screen.getByTestId('comune-option-083049')).toHaveTextContent('Milazzo (ME)');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('does not search below two letters and says how many are needed', async () => {
    renderPicker();
    const input = await screen.findByRole('combobox');

    fireEvent.change(input, { target: { value: 'm' } });

    expect(await screen.findByText('Scrivi almeno 2 lettere.')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(api.search).not.toHaveBeenCalled();
  });

  it('chooses with the arrow keys and Enter, and hands over the whole comune', async () => {
    api.search.mockResolvedValue({ datasetAvailable: true, items: [MILANO, MILAZZO] });
    const { onChange } = renderPicker();
    const input = await screen.findByRole('combobox');
    fireEvent.change(input, { target: { value: 'mil' } });
    await screen.findByRole('listbox');

    expect(input).toHaveAttribute('aria-activedescendant', expect.stringMatching(/-0$/));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(MILANO);
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('chooses with the mouse without losing the list before the choice', async () => {
    api.search.mockResolvedValue({ datasetAvailable: true, items: [MILANO, MILAZZO] });
    const { onChange } = renderPicker();
    const input = await screen.findByRole('combobox');
    fireEvent.change(input, { target: { value: 'mil' } });
    await screen.findByRole('listbox');

    fireEvent.mouseDown(screen.getByTestId('comune-option-083049'));

    expect(onChange).toHaveBeenCalledWith(MILAZZO);
  });

  it('closes the list with Escape and drops what was typed', async () => {
    api.search.mockResolvedValue({ datasetAvailable: true, items: [MILANO] });
    const { onChange } = renderPicker();
    const input = await screen.findByRole('combobox');
    fireEvent.change(input, { target: { value: 'mil' } });
    await screen.findByRole('listbox');

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('says that nothing matches, only when the search answered', async () => {
    api.search.mockResolvedValue({ datasetAvailable: true, items: [] });
    renderPicker();
    const input = await screen.findByRole('combobox');

    fireEvent.change(input, { target: { value: 'zzzz' } });

    expect(await screen.findByText(/Nessun comune trovato per «zzzz»/)).toBeInTheDocument();
  });

  it('shows a search error with a retry and never as "no result"', async () => {
    api.search.mockRejectedValueOnce(new Error('boom'));
    renderPicker();
    const input = await screen.findByRole('combobox');

    fireEvent.change(input, { target: { value: 'mil' } });

    expect(await screen.findByTestId('comune-picker-search-error')).toBeInTheDocument();
    expect(screen.queryByText(/Nessun comune trovato/)).not.toBeInTheDocument();

    api.search.mockResolvedValue({ datasetAvailable: true, items: [MILANO] });
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByTestId('comune-option-015146')).toBeInTheDocument();
  });

  it('shows the chosen comune with the region that follows it, read from the API for a stored code', async () => {
    api.getByIstatCode.mockResolvedValue(MILANO);
    renderPicker({ istatCode: '015146', fallbackName: 'Milano' });

    expect(await screen.findByDisplayValue('Milano (MI)')).toBeInTheDocument();
    expect(screen.getByTestId('comune-picker-region')).toHaveTextContent('Regione: Lombardia');
    expect(api.getByIstatCode).toHaveBeenCalledWith('015146');
  });

  it('shows the name the form already knows while the details load', async () => {
    api.getByIstatCode.mockReturnValue(new Promise(() => {}));
    renderPicker({ istatCode: '015146', fallbackName: 'Milano' });

    expect(await screen.findByDisplayValue('Milano')).toBeInTheDocument();
  });

  it('warns about a comune that is no longer in the list and about a code the list does not know', async () => {
    api.getByIstatCode.mockResolvedValueOnce({ ...MILANO, isActive: false });
    const { unmount } = renderPicker({ istatCode: '015146' });
    expect(await screen.findByTestId('comune-picker-inactive')).toHaveTextContent('non è più nell\'elenco ufficiale');
    unmount();

    api.getByIstatCode.mockRejectedValueOnce(new Error('404'));
    renderPicker({ istatCode: '999999', fallbackName: 'Altrove' });
    expect(await screen.findByTestId('comune-picker-unknown-code')).toHaveTextContent('999999');
  });

  it('clears the choice', async () => {
    api.getByIstatCode.mockResolvedValue(MILANO);
    const { onChange } = renderPicker({ istatCode: '015146' });
    await screen.findByDisplayValue('Milano (MI)');

    fireEvent.click(screen.getByRole('button', { name: 'Cancella il comune scelto' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('finds the comune by its name in the other language as it is listed', async () => {
    api.search.mockResolvedValue({ datasetAvailable: true, items: [BOLZANO] });
    renderPicker();
    const input = await screen.findByRole('combobox');

    fireEvent.change(input, { target: { value: 'bozen' } });

    expect(await screen.findByTestId('comune-option-021008')).toHaveTextContent('Bolzano/Bozen');
  });

  it('is translated in English', async () => {
    await i18n.changeLanguage('en');
    api.getStatus.mockResolvedValue({ datasetAvailable: false });
    renderPicker();

    expect(await screen.findByTestId('comune-picker-unavailable')).toHaveTextContent('List of comuni not available');
    await i18n.changeLanguage('it');
  });

  it('is disabled with the form', async () => {
    renderPicker({ disabled: true });

    expect(await screen.findByRole('combobox')).toBeDisabled();
  });
});
