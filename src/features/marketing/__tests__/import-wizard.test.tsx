import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AxiosError } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import i18n from '@/i18n/config';
import { ImportWizard } from '../import-wizard';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const guestFile = {
  headers: ['Nome', 'Email', 'Ultimo soggiorno', 'Note'],
  sample: [
    ['Maria Bianchi', 'maria@esempio.it', '12/08/2025', 'vip'],
    ['Hans Weber', 'hans@esempio.de', '03/02/2026', ''],
  ],
  totalRows: 128,
};

const outcome = {
  imported: 120,
  skipped: 5,
  errors: [
    { row: 4, reason: 'invalid_contact' },
    { row: 9, reason: 'invalid_stay_dates' },
  ],
};

let preview: typeof guestFile;

function view(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.resetAllMocks();
  preview = guestFile;
  await i18n.changeLanguage('it');
  vi.mocked(ApiClient.get).mockImplementation(async (path: string) => {
    if (path === '/properties') return [{ id: 'house', name: 'Villa Sofia', photoUrls: [] }];
    throw new Error(path);
  });
  vi.mocked(ApiClient.post).mockImplementation(async (path: string) => {
    if (path === '/marketing/import/preview') return preview;
    if (path === '/marketing/import') return outcome;
    throw new Error(path);
  });
});

async function chooseFile(name = 'ospiti.csv') {
  const input = await screen.findByTestId('import-dropzone-input');
  fireEvent.change(input, { target: { files: [new File(['contenuto'], name, { type: 'text/csv' })] } });
}

async function goOn() {
  const button = screen.getByTestId('import-wizard-next');
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

function importCall() {
  const call = vi.mocked(ApiClient.post).mock.calls.find(([path]) => path === '/marketing/import');
  return call?.[1] as FormData;
}

describe('import wizard', () => {
  it('takes a file to the import in four steps, reading the columns for the host', async () => {
    const onCreateGroup = vi.fn();
    view(<ImportWizard open onOpenChange={() => undefined} onCreateGroup={onCreateGroup} />);

    await chooseFile();
    expect(await screen.findByText('Ho letto 128 righe di ospiti')).toBeVisible();
    await goOn();

    expect(await screen.findByText('Così leggeremo i primi ospiti')).toBeVisible();
    expect(within(screen.getByTestId('import-sample')).getByText('Maria Bianchi')).toBeVisible();
    expect(screen.getByTestId('import-column-name')).toHaveValue('0');
    expect(screen.getByTestId('import-column-email')).toHaveValue('1');
    expect(screen.getByTestId('import-column-lastStay')).toHaveValue('2');
    expect(screen.getByTestId('import-column-phone')).toHaveValue('');
    await goOn();

    fireEvent.click(await screen.findByTestId('import-basis-consent'));
    await goOn();

    expect(await screen.findByTestId('import-single-property')).toHaveTextContent('Villa Sofia');
    expect(screen.getByText('ospiti.csv · 128 righe')).toBeVisible();
    expect(screen.getByTestId('import-wizard-next')).toBeDisabled();
    fireEvent.change(screen.getByTestId('import-source'), { target: { value: 'Modulo sito 2025' } });
    await goOn();

    expect(await screen.findByTestId('import-done')).toBeVisible();
    const form = importCall();
    expect(JSON.parse(String(form.get('mapping')))).toEqual({ email: 1, name: 0, lastStay: 2 });
    expect(form.get('basis')).toBe('consent');
    expect(form.get('source')).toBe('Modulo sito 2025');
    expect(form.get('propertyId')).toBe('house');
    expect((form.get('file') as File).name).toBe('ospiti.csv');

    expect(screen.getByTestId('import-result-imported')).toHaveTextContent('120');
    expect(screen.getByTestId('import-result-skipped')).toHaveTextContent('5');
    expect(screen.getByTestId('import-result-errors')).toHaveTextContent('2');
    expect(screen.getByText('Riga 4: e-mail o telefono mancante o non valido')).toBeVisible();
    expect(screen.getByText('Riga 9: date del soggiorno non valide')).toBeVisible();

    fireEvent.click(screen.getByTestId('import-wizard-group'));
    expect(onCreateGroup).toHaveBeenCalledOnce();
  }, 20_000);

  it('refuses a file that is not CSV or Excel without sending it', async () => {
    view(<ImportWizard open onOpenChange={() => undefined} />);
    await chooseFile('ospiti.pdf');
    expect(await screen.findByText('Questo file non va bene: serve un CSV o un Excel (.xlsx).')).toBeVisible();
    expect(ApiClient.post).not.toHaveBeenCalled();
    expect(screen.getByTestId('import-wizard-next')).toBeDisabled();
  });

  it('says in plain words when the server does not accept the file', async () => {
    vi.mocked(ApiClient.post).mockRejectedValue(Object.assign(new AxiosError('Unsupported'), { response: { status: 415, data: undefined } }));
    view(<ImportWizard open onOpenChange={() => undefined} />);
    await chooseFile();
    expect(await screen.findByText('Questo tipo di file non va bene: serve un CSV o un Excel (.xlsx).')).toBeVisible();
    expect(screen.getByTestId('import-wizard-next')).toBeDisabled();
  });

  it('does not let the host go on without an e-mail or a phone column, and blocks a column already taken', async () => {
    preview = { headers: ['Nome', 'Contatto'], sample: [['Maria', 'maria@esempio.it']], totalRows: 1 };
    view(<ImportWizard open onOpenChange={() => undefined} />);
    await chooseFile();
    await goOn();

    expect(await screen.findByTestId('import-need-contact')).toBeVisible();
    expect(screen.getByTestId('import-wizard-next')).toBeDisabled();

    fireEvent.change(screen.getByTestId('import-column-email'), { target: { value: '1' } });
    expect(screen.queryByTestId('import-need-contact')).toBeNull();
    expect(screen.getByTestId('import-wizard-next')).toBeEnabled();
    expect(within(screen.getByTestId('import-column-phone')).getByRole('option', { name: 'Contatto (già usata)' })).toBeDisabled();
  });

  it('asks for the column of the last stay when the host says the guests already stayed', async () => {
    preview = { headers: ['Nome', 'Email', 'Data'], sample: [['Maria', 'maria@esempio.it', '12/08/2025']], totalRows: 1 };
    view(<ImportWizard open onOpenChange={() => undefined} />);
    await chooseFile();
    await goOn();
    await goOn();

    fireEvent.click(await screen.findByTestId('import-basis-softOptIn'));
    expect(await screen.findByTestId('import-need-date')).toBeVisible();
    expect(screen.getByTestId('import-wizard-next')).toBeDisabled();

    fireEvent.change(screen.getByTestId('import-last-stay-column'), { target: { value: '2' } });
    expect(screen.queryByTestId('import-need-date')).toBeNull();
    await goOn();

    fireEvent.click(await screen.findByRole('button', { name: 'Prenotazioni dirette' }));
    expect(screen.getByTestId('import-source')).toHaveValue('Prenotazioni dirette');
    await goOn();

    expect(await screen.findByTestId('import-done')).toBeVisible();
    const form = importCall();
    expect(JSON.parse(String(form.get('mapping')))).toEqual({ email: 1, name: 0, lastStay: 2 });
    expect(form.get('basis')).toBe('softOptIn');
  }, 20_000);

  it('keeps what the host chose when going back a step', async () => {
    view(<ImportWizard open onOpenChange={() => undefined} />);
    await chooseFile();
    await goOn();
    await goOn();
    fireEvent.click(await screen.findByTestId('import-basis-serviceOnly'));
    fireEvent.click(screen.getByRole('button', { name: 'Indietro' }));

    expect(await screen.findByTestId('import-column-email')).toHaveValue('1');
    await goOn();
    expect(await screen.findByTestId('import-basis-serviceOnly')).toBeChecked();
  });
});
