import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { touristTaxSummaryApi, touristTaxSummaryCsvFileName } from '../tourist-tax-summary.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const PERIOD = { from: '2026-07-01', to: '2026-09-30' };

const REMITTANCE = {
  id: 'r-1',
  comune: 'Milano',
  periodFrom: '2026-07-01',
  periodTo: '2026-09-30',
  amount: 1250,
  amountCents: 125000,
  paidOn: '2026-10-05',
  reference: null,
  notes: null,
  hasReceipt: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// NF-100 / money: the API reads `paidAmount` of a form with the culture of the request, where the Italian dot is a thousands separator,
// so it asks for the amount as text with a dot and takes nothing else. What the host left empty is not sent.
describe('touristTaxSummaryApi.recordRemittance (NF-100)', () => {
  it('RecordRemittance_Payment_GoesAsMultipartWithTheAmountAsTextWithADot', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: REMITTANCE });

    const saved = await touristTaxSummaryApi.recordRemittance({
      comune: 'Milano',
      periodFrom: '2026-07-01',
      periodTo: '2026-09-30',
      paidAmount: '1250.00',
      paidOn: '2026-10-05',
    });

    expect(saved).toBe(REMITTANCE);
    const [url, body, config] = vi.mocked(axios.post).mock.calls[0]!;
    expect(url).toBe('/tourist-tax/remittances');
    // The default content type of the client is JSON, which would serialize the form as JSON.
    expect(config).toMatchObject({ headers: { 'Content-Type': 'multipart/form-data' } });
    const form = body as FormData;
    expect(form.get('paidAmount')).toBe('1250.00');
    expect(Object.fromEntries(form.entries())).toEqual({
      comune: 'Milano',
      periodFrom: '2026-07-01',
      periodTo: '2026-09-30',
      paidAmount: '1250.00',
      paidOn: '2026-10-05',
    });
  });

  it('RecordRemittance_ReferenceNoteAndReceipt_GoAsTheFieldsTheApiReads', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { ...REMITTANCE, hasReceipt: true } });
    const receipt = new File(['%PDF-1.4'], 'rav.pdf', { type: 'application/pdf' });

    await touristTaxSummaryApi.recordRemittance({
      comune: 'Milano',
      periodFrom: '2026-07-01',
      periodTo: '2026-09-30',
      paidAmount: '12.50',
      paidOn: '2026-10-05',
      reference: 'RAV 0042',
      notes: 'Primo trimestre',
      receipt,
    });

    const form = vi.mocked(axios.post).mock.calls[0]![1] as FormData;
    expect(form.get('reference')).toBe('RAV 0042');
    expect(form.get('notes')).toBe('Primo trimestre');
    expect((form.get('receipt') as File).name).toBe('rav.pdf');
  });
});

describe('touristTaxSummaryApi.getSummary (NF-100)', () => {
  it('GetSummary_Days_AreAskedAsFromAndTo', async () => {
    const summary = { title: 'Tassa di soggiorno per comune', paymentsHidden: false, comuni: [], total: { stays: 0 } };
    vi.mocked(axios.get).mockResolvedValueOnce({ data: summary });

    await expect(touristTaxSummaryApi.getSummary(PERIOD)).resolves.toBe(summary);

    expect(axios.get).toHaveBeenCalledWith('/tourist-tax/summary', { params: PERIOD });
  });

  it('GetSummary_AnswerThatIsNotTheSummary_IsAnErrorToShowNotDataToDraw', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: '<!doctype html><html></html>' });

    await expect(touristTaxSummaryApi.getSummary(PERIOD)).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });
});

describe('touristTaxSummaryApi downloads and deletes (NF-100)', () => {
  it('DownloadCsv_Days_AskForTheCsvFormatAsABlob', async () => {
    const csv = new Blob(['Comune;Soggiorni'], { type: 'text/csv' });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: csv });

    await expect(touristTaxSummaryApi.downloadCsv(PERIOD)).resolves.toBe(csv);

    expect(axios.get).toHaveBeenCalledWith('/tourist-tax/summary', { params: { ...PERIOD, format: 'csv' }, responseType: 'blob' });
  });

  it('DownloadReceipt_Id_IsEncodedInTheAddressAndAskedAsABlob', async () => {
    const receipt = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: receipt });

    await expect(touristTaxSummaryApi.downloadReceipt('r 1')).resolves.toBe(receipt);

    expect(axios.get).toHaveBeenCalledWith('/tourist-tax/remittances/r%201/receipt', { responseType: 'blob' });
  });

  it('DeleteRemittance_Id_IsEncodedInTheAddress', async () => {
    vi.mocked(axios.delete).mockResolvedValueOnce({ data: undefined });

    await touristTaxSummaryApi.deleteRemittance('r 1');

    expect(axios.delete).toHaveBeenCalledWith('/tourist-tax/remittances/r%201', undefined);
  });

  it('CsvFileName_Days_AreWrittenAsTheServerNamesTheFile', () => {
    expect(touristTaxSummaryCsvFileName({ from: '2026-01-01', to: '2026-12-31' })).toBe(
      'casazen-tassa-soggiorno-riepilogo-20260101-20261231.csv',
    );
  });
});
