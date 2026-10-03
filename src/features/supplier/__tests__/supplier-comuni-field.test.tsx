import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { Comune } from '@/types/comune.types';
import { SupplierComuniField, type SupplierComuniValue } from '../components/supplier-comuni-field';

const api = vi.hoisted(() => ({ getStatus: vi.fn(), search: vi.fn(), getByIstatCode: vi.fn() }));

vi.mock('@/api/comuni.api', () => ({ COMUNE_SEARCH_MIN_LENGTH: 2, ComuniApi: api }));

// Rows of the official ISTAT list (ISTAT, 21/02/2026).
const COMO: Comune = {
  istatCode: '013075',
  cadastralCode: 'C933',
  name: 'Como',
  displayName: 'Como',
  provinceCode: 'CO',
  regionCode: 'LOM',
  regionIstatCode: '03',
  regionName: 'Lombardia',
  isActive: true,
};
const TORINO: Comune = {
  istatCode: '001272',
  cadastralCode: 'L219',
  name: 'Torino',
  displayName: 'Torino',
  provinceCode: 'TO',
  regionCode: 'PIE',
  regionIstatCode: '01',
  regionName: 'Piemonte',
  isActive: true,
};

/** The field as a form holds it: the parent keeps the value. */
function Harness({ initial, known, onValue }: { initial: SupplierComuniValue; known?: Comune[]; onValue: (v: SupplierComuniValue) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <SupplierComuniField
      id="comuni"
      value={value}
      known={known}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

function renderField(initial: SupplierComuniValue, known?: Comune[]) {
  const onValue = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <Harness initial={initial} known={known} onValue={onValue} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return onValue;
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  api.getStatus.mockResolvedValue({ datasetAvailable: true });
  api.search.mockResolvedValue({ datasetAvailable: true, items: [] });
});

describe('SupplierComuniField', () => {
  it('shows the chosen comuni as chips with their province and region', async () => {
    renderField({ istatCodes: ['013075'], legacy: [] }, [COMO]);

    const chip = await screen.findByTestId('supplier-comune-chip-013075');
    expect(chip).toHaveTextContent('Como (CO)');
    expect(chip).toHaveTextContent('Lombardia');
  });

  it('adds a comune picked from the list, by its ISTAT code, and removes it again', async () => {
    api.search.mockResolvedValue({ datasetAvailable: true, items: [TORINO] });
    const onValue = renderField({ istatCodes: [], legacy: [] });
    expect(await screen.findByText("Nessun comune scelto dall'elenco.")).toBeInTheDocument();

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'tori' } });
    fireEvent.mouseDown(await screen.findByTestId('comune-option-001272'));

    expect(onValue).toHaveBeenLastCalledWith({ istatCodes: ['001272'], legacy: [] });
    expect(await screen.findByTestId('supplier-comune-chip-001272')).toHaveTextContent('Torino (TO)');

    fireEvent.click(screen.getByRole('button', { name: 'Rimuovi Torino (TO)' }));
    expect(onValue).toHaveBeenLastCalledWith({ istatCodes: [], legacy: [] });
    await waitFor(() => expect(screen.queryByTestId('supplier-comune-chip-001272')).not.toBeInTheDocument());
  });

  it('does not add the same comune twice', async () => {
    api.search.mockResolvedValue({ datasetAvailable: true, items: [COMO] });
    const onValue = renderField({ istatCodes: ['013075'], legacy: [] }, [COMO]);

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'como' } });
    fireEvent.mouseDown(await screen.findByTestId('comune-option-013075'));

    expect(onValue).not.toHaveBeenCalled();
  });

  it('keeps what was written as text visible and removable, flagged as not linked to the list', async () => {
    const onValue = renderField({ istatCodes: [], legacy: ['Cesano Maderno', 'Roma'] });

    expect(await screen.findByTestId('supplier-comuni-legacy')).toHaveTextContent('Indicati come testo');
    fireEvent.click(screen.getByRole('button', { name: 'Rimuovi Roma' }));

    expect(onValue).toHaveBeenLastCalledWith({ istatCodes: [], legacy: ['Cesano Maderno'] });
  });

  it('shows a stored code the API did not describe as its code', async () => {
    renderField({ istatCodes: ['999999'], legacy: [] });

    expect(await screen.findByTestId('supplier-comune-chip-999999')).toHaveTextContent('Comune 999999');
  });

  it('while the list is not imported offers the text field of old, with what was written, and no way to remove a chosen code', async () => {
    api.getStatus.mockResolvedValue({ datasetAvailable: false });
    const onValue = renderField({ istatCodes: ['013075'], legacy: ['Roma'] }, [COMO]);

    const text = await screen.findByTestId('supplier-comuni-text');
    expect(text).toHaveValue('Roma');
    expect(screen.getByTestId('comune-picker-unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rimuovi/ })).not.toBeInTheDocument();

    fireEvent.change(text, { target: { value: 'Roma, Milano,' } });
    expect(onValue).toHaveBeenLastCalledWith({ istatCodes: ['013075'], legacy: ['Roma', 'Milano'] });
    expect(text).toHaveValue('Roma, Milano,');
  });
});
