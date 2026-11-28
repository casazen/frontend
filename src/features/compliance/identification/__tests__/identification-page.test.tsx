import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { accessCodeApi } from '@/api/access-code.api';
import type { AccessCodeStatusItem, AccessCodeStatusPage } from '@/types';
import { IdentificationPage } from '../identification-page';

vi.mock('@/api/access-code.api', () => ({ accessCodeApi: { getStatus: vi.fn(), setCode: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      <p data-testid="page-description">{description}</p>
    </div>
  ),
}));

const PAGE_PATH = '/app/short-rent/compliance/identification';
const SECRET = '4821#';

const withCode: AccessCodeStatusItem = {
  propertyId: 'p-1',
  name: 'Casa Verdi',
  city: 'Roma',
  accessCodeSet: true,
  updatedAt: '2026-11-03T12:00:00Z',
};
const withoutCode: AccessCodeStatusItem = {
  propertyId: 'p-2',
  name: 'Casa Rossi',
  city: 'Milano',
  accessCodeSet: false,
  updatedAt: null,
};

function answer(items: AccessCodeStatusItem[], totalCount = items.length): AccessCodeStatusPage {
  return { items, totalCount, page: 1, pageSize: 100 };
}

function Where() {
  const location = useLocation();
  return <div data-testid="where">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(entry = PAGE_PATH) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={PAGE_PATH} element={<IdentificationPage />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

describe('IdentificationPage (E03/F01/US03)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    vi.mocked(accessCodeApi.getStatus).mockResolvedValue(answer([withCode, withoutCode]));
    vi.mocked(accessCodeApi.setCode).mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('narrows the visible properties by city and missing access code, and resets the queue', async () => {
    renderPage();
    const search = await screen.findByRole('searchbox', { name: 'Cerca' });
    fireEvent.change(search, { target: { value: 'milano' } });
    expect(screen.getByTestId('identification-row-p-2')).toBeVisible();
    expect(screen.queryByTestId('identification-row-p-1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1 da gestire' }));
    fireEvent.change(search, { target: { value: 'roma' } });
    expect(screen.getByRole('status')).toHaveTextContent('0 risultati');
    fireEvent.click(screen.getByRole('button', { name: 'Azzera i filtri' }));
    expect(screen.getByTestId('identification-row-p-1')).toBeVisible();
    expect(screen.getByTestId('identification-row-p-2')).toBeVisible();
  });

  it('render_Properties_ListsEachWithItsCodeStateTheButtonsAndTheQrLink', async () => {
    renderPage();

    const verdi = await screen.findByTestId('identification-row-p-1');
    const rossi = screen.getByTestId('identification-row-p-2');
    expect(within(verdi).getByText('Casa Verdi')).toBeInTheDocument();
    expect(within(verdi).getByText('Roma')).toBeInTheDocument();
    expect(within(verdi).getByTestId('identification-state')).toHaveTextContent('Codice impostato');
    expect(within(verdi).getByText(/3 novembre 2026/)).toBeInTheDocument();
    expect(within(verdi).getByRole('button', { name: 'Cambia codice: Casa Verdi' })).toBeInTheDocument();
    expect(within(verdi).getByRole('link', { name: 'QR di ingresso: Casa Verdi' })).toHaveAttribute(
      'href',
      '/app/short-rent/properties/p-1/qr',
    );

    expect(within(rossi).getByTestId('identification-state')).toHaveTextContent('Codice mancante');
    expect(within(rossi).getByRole('button', { name: 'Imposta codice: Casa Rossi' })).toBeInTheDocument();
    expect(within(rossi).getByRole('link', { name: 'QR di ingresso: Casa Rossi' })).toHaveAttribute(
      'href',
      '/app/short-rent/properties/p-2/qr',
    );

    expect(screen.getByTestId('page-description')).toHaveTextContent(
      "Il codice viene inviato all'ospite solo dopo che la verifica dell'identità è andata a buon fine.",
    );
    expect(accessCodeApi.getStatus).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
  });

  it('render_MoreThanOnePage_ReadsEveryPageOfProperties', async () => {
    vi.mocked(accessCodeApi.getStatus)
      .mockResolvedValueOnce(answer([withCode], 2))
      .mockResolvedValueOnce({ ...answer([withoutCode], 2), page: 2 });

    renderPage();

    expect(await screen.findByTestId('identification-row-p-2')).toBeInTheDocument();
    expect(screen.getByTestId('identification-row-p-1')).toBeInTheDocument();
    expect(accessCodeApi.getStatus).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 100 });
    expect(accessCodeApi.getStatus).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 100 });
    expect(accessCodeApi.getStatus).toHaveBeenCalledTimes(2);
  });

  it('render_LoadError_ShowsTheErrorWithRetryNotAnEmptyList', async () => {
    vi.mocked(accessCodeApi.getStatus).mockRejectedValue(new Error('500'));

    renderPage();

    expect(await screen.findByText(i18n.t('compliance.identification.loadError'))).toBeInTheDocument();
    expect(screen.queryByTestId('identification-list')).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('compliance.identification.empty.title'))).not.toBeInTheDocument();
  });

  it('render_NoProperties_OffersToAddTheFirstOne', async () => {
    vi.mocked(accessCodeApi.getStatus).mockResolvedValue(answer([]));

    renderPage();

    expect(await screen.findByText(i18n.t('compliance.identification.empty.title'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('compliance.identification.empty.action') })).toHaveAttribute(
      'href',
      '/app/short-rent/properties/create',
    );
  });

  it('changeCode_ExistingCode_FieldStartsEmptySendsTheCodeInTheBodyAndShowsItNoMore', async () => {
    const client = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Cambia codice: Casa Verdi' }));

    const dialog = await screen.findByRole('dialog');
    const field = within(dialog).getByTestId('lock-code-input');
    expect(field).toHaveValue('');
    expect(within(dialog).getByRole('heading', { name: 'Cambia il codice' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Salva codice' })).toBeDisabled();

    fireEvent.change(field, { target: { value: `  ${SECRET} ` } });
    vi.mocked(accessCodeApi.getStatus).mockResolvedValue(answer([{ ...withCode, updatedAt: '2026-11-05T12:00:00Z' }, withoutCode]));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salva codice' }));

    await waitFor(() => expect(accessCodeApi.setCode).toHaveBeenCalledWith('p-1', { code: SECRET }));
    expect(accessCodeApi.setCode).toHaveBeenCalledTimes(1);

    const saved = await within(dialog).findByTestId('lock-code-saved');
    expect(saved).toHaveTextContent('Codice salvato');
    expect(within(dialog).queryByTestId('lock-code-input')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(SECRET)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(SECRET);

    await waitFor(() => expect(accessCodeApi.getStatus).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/5 novembre 2026/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(SECRET);

    fireEvent.click(within(dialog).getByTestId('lock-code-done'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));

    fireEvent.click(screen.getByRole('button', { name: 'Cambia codice: Casa Verdi' }));
    expect(within(await screen.findByRole('dialog')).getByTestId('lock-code-input')).toHaveValue('');
  });

  it('setCode_PropertyWithoutCode_SaysSetInsteadOfChange', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Imposta codice: Casa Rossi' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Imposta il codice' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Casa Rossi');
  });

  it('saveFails_SaysSoInPlainWordsKeepsTheTextAndSendsNothingElse', async () => {
    vi.mocked(accessCodeApi.setCode).mockRejectedValue(new Error('boom'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Imposta codice: Casa Rossi' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByTestId('lock-code-input'), { target: { value: SECRET } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salva codice' }));

    const error = await within(dialog).findByTestId('lock-code-error');
    expect(error).toHaveTextContent(i18n.t('compliance.identification.dialog.error'));
    expect(error).not.toHaveTextContent(SECRET);
    expect(within(dialog).queryByTestId('lock-code-saved')).not.toBeInTheDocument();
    expect(within(dialog).getByTestId('lock-code-input')).toHaveValue(SECRET);
    fireEvent.change(within(dialog).getByTestId('lock-code-input'), { target: { value: `${SECRET}1` } });
    expect(within(dialog).queryByTestId('lock-code-error')).not.toBeInTheDocument();
    expect(accessCodeApi.getStatus).toHaveBeenCalledTimes(1);
  });

  it('link_PropertyParameter_OpensTheWindowOfThatPropertyAndLeavesTheAddressClean', async () => {
    renderPage(`${PAGE_PATH}?property=p-2`);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Imposta il codice' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Casa Rossi');
    expect(within(dialog).getByTestId('lock-code-input')).toHaveValue('');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('where')).toHaveTextContent(PAGE_PATH);
    expect(screen.getByTestId('where')).not.toHaveTextContent('property=');
    expect(accessCodeApi.setCode).not.toHaveBeenCalled();
  });

  it('link_PropertyThatIsNotInTheList_OpensNothing', async () => {
    renderPage(`${PAGE_PATH}?property=someone-elses`);

    expect(await screen.findByTestId('identification-row-p-1')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
