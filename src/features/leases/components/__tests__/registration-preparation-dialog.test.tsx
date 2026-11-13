import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import { registrationPreparationApi, type RegistrationPreparation } from '@/api/registration-preparation.api';
import { leaseDocumentsApi } from '@/api/lease-documents.api';
import { RegistrationPreparationDialog } from '../registration-preparation-dialog';

vi.mock('@/api/registration-preparation.api', () => ({ registrationPreparationApi: { get: vi.fn(), save: vi.fn(), upload: vi.fn() } }));
vi.mock('@/api/lease-documents.api', () => ({ leaseDocumentsApi: { list: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const fixture = (overrides: Partial<RegistrationPreparation> = {}): RegistrationPreparation => ({
  schema: { documentId: 'registration-service', verifiedOn: '2026-11-13', fields: [
    { key: 'field0', name: 'territorialOffice', label: 'ufficio territoriale', type: 'territorialOffice', required: true, help: 'Codice ufficio', options: [], group: 'contract' },
    { key: 'field17', name: 'taxRegime', label: 'regime fiscale', type: 'optionCode', required: true, help: '', options: [{ code: 'CEDOLARE', description: 'Cedolare secca' }], group: 'taxes' },
    { key: 'field27', name: 'landlordDocument', label: 'documento locatore', type: 'file', required: true, help: 'Documento identità', options: [], group: 'landlords' },
  ] },
  data: { version: 0, values: { territorialOffice: 'T9A', taxRegime: 'CEDOLARE' }, documents: {} },
  issues: [], ready: true, paid: false, ...overrides,
});

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  vi.mocked(registrationPreparationApi.get).mockResolvedValue(fixture());
  vi.mocked(registrationPreparationApi.save).mockResolvedValue(fixture());
  vi.mocked(leaseDocumentsApi.list).mockResolvedValue([]);
});
afterEach(cleanup);

function show(onPrepared = vi.fn().mockResolvedValue(undefined)) {
  render(<RegistrationPreparationDialog leaseId="lease-1" open onOpenChange={vi.fn()} onPrepared={onPrepared} isStartingCheckout={false} />);
  return onPrepared;
}

describe('registration preparation', () => {
  it('shows prefilled values and sends the complete versioned supplement before requesting payment', async () => {
    const onPrepared = show();
    expect(await screen.findByLabelText('ufficio territoriale *')).toHaveValue('T9A');
    fireEvent.change(screen.getByLabelText('ufficio territoriale *'), { target: { value: 'T9B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva e passa al pagamento Stripe' }));
    await waitFor(() => expect(onPrepared).toHaveBeenCalledWith(false));
    expect(registrationPreparationApi.save).toHaveBeenCalledWith('lease-1', expect.objectContaining({ version: 0, values: { territorialOffice: 'T9B', taxRegime: 'CEDOLARE' } }));
  });

  it('shows server field errors and prevents payment for an incomplete filing', async () => {
    vi.mocked(registrationPreparationApi.save).mockResolvedValue(fixture({ ready: false, issues: [{ field: 'landlordDocument', message: 'Campo obbligatorio.' }] }));
    const onPrepared = show();
    fireEvent.click(await screen.findByRole('button', { name: 'Salva e passa al pagamento Stripe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('documento locatore: Campo obbligatorio.');
    expect(onPrepared).not.toHaveBeenCalled();
  });

  it('saves an incomplete draft without opening payment', async () => {
    vi.mocked(registrationPreparationApi.save).mockResolvedValue(fixture({ ready: false }));
    const onPrepared = show();
    fireEvent.click(await screen.findByRole('button', { name: 'Salva e continua dopo' }));
    await waitFor(() => expect(registrationPreparationApi.save).toHaveBeenCalledTimes(1));
    expect(onPrepared).not.toHaveBeenCalled();
  });

  it('resumes a paid filing using the authoritative server result', async () => {
    vi.mocked(registrationPreparationApi.get).mockResolvedValue(fixture({ paid: true }));
    vi.mocked(registrationPreparationApi.save).mockResolvedValue(fixture({ paid: true }));
    const onPrepared = show();
    fireEvent.click(await screen.findByRole('button', { name: 'Pagamento già ricevuto: continua con la delega' }));
    await waitFor(() => expect(onPrepared).toHaveBeenCalledWith(true));
  });

  it('uploads the identity attachment and saves its lease-owned ID instead of file contents', async () => {
    vi.mocked(registrationPreparationApi.upload).mockResolvedValue({ id: 'document-1', leaseId: 'lease-1', kind: 'RegistrationIdentity', fileName: 'documento.pdf', sizeBytes: 20, uploadedAt: '2026-11-13' });
    show();
    const input = await screen.findByLabelText(/Oppure carica il documento/);
    const file = new File(['%PDF-identity'], 'documento.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByLabelText('documento locatore *')).toHaveValue('document-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Salva e continua dopo' }));
    await waitFor(() => expect(registrationPreparationApi.save).toHaveBeenCalledWith('lease-1', expect.objectContaining({ documents: { landlordDocument: 'document-1' } })));
  });
});
