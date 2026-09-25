import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import axios from '@/lib/axios';
import { fiscalApi } from '../fiscal.api';
import { ApiClient } from '../client';

vi.mock('../client');
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fiscalApi contract (#3)', () => {
  it('getRegime calls GET /fiscal/regime with taxYear', async () => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce({
      taxYear: 2026,
      strPropertyCount: 1,
      requiresPartitaIva: false,
      hasPartitaIva: false,
      disclaimer: 'informativa',
      properties: [],
    });

    await fiscalApi.getRegime(2026);

    expect(ApiClient.get).toHaveBeenCalledWith('/fiscal/regime', { taxYear: 2026 });
  });

  it('assignRegime calls PUT /fiscal/properties/:id/regime', async () => {
    vi.mocked(ApiClient.put).mockResolvedValueOnce({
      propertyId: 'p1',
      name: 'Casa',
      recommendedRegime: 'CedolareSecca21',
      assignedRegime: 'CedolareSecca21',
      isPrimaryForCedolare: true,
    });

    await fiscalApi.assignRegime('p1', { taxYear: 2026, regime: 'CedolareSecca21', isPrimaryForCedolare: true });

    expect(ApiClient.put).toHaveBeenCalledWith('/fiscal/properties/p1/regime', {
      taxYear: 2026,
      regime: 'CedolareSecca21',
      isPrimaryForCedolare: true,
    });
  });

  it('assignRegime sends the IRPEF ordinaria regime (CO-18)', async () => {
    vi.mocked(ApiClient.put).mockResolvedValueOnce({
      propertyId: 'p1',
      name: 'Casa',
      recommendedRegime: 'CedolareSecca21',
      assignedRegime: 'IrpefOrdinaria',
      isPrimaryForCedolare: false,
      shortStayInTaxYear: true,
      taxpayerIndex: 0,
      cedolareRate: null,
      taxNote: 'irpef_ordinaria_not_computed',
    });

    await fiscalApi.assignRegime('p1', { taxYear: 2026, regime: 'IrpefOrdinaria' });

    expect(ApiClient.put).toHaveBeenCalledWith('/fiscal/properties/p1/regime', {
      taxYear: 2026,
      regime: 'IrpefOrdinaria',
    });
  });

  it('putTaxProfile sends only the fields given (CO-19)', async () => {
    vi.mocked(ApiClient.put).mockResolvedValueOnce({});

    await fiscalApi.putTaxProfile({ fiscalCode: 'RSSMRA80A01H501U' });

    expect(ApiClient.put).toHaveBeenCalledWith('/fiscal/tax-profile', { fiscalCode: 'RSSMRA80A01H501U' });
  });

  it('report getters send the period (CO-19)', async () => {
    vi.mocked(ApiClient.get).mockResolvedValue({});
    const period = { from: '2026-04-01', to: '2026-06-30' };

    await fiscalApi.getAnnual(2026, period);
    await fiscalApi.getWithholding(2026, period);
    await fiscalApi.getTouristTax(period);

    expect(ApiClient.get).toHaveBeenCalledWith('/fiscal/reports/annual/2026', period);
    expect(ApiClient.get).toHaveBeenCalledWith('/fiscal/reports/withholding/2026', period);
    expect(ApiClient.get).toHaveBeenCalledWith('/fiscal/reports/tourist-tax', period);
  });

  it('downloadReport asks the authenticated endpoint for a blob with period and format (CO-19)', async () => {
    const blob = new Blob(['%PDF']);
    vi.mocked(axios.get).mockResolvedValueOnce({ data: blob });

    const result = await fiscalApi.downloadReport('touristTax', 2026, { from: '2026-01-01', to: '2026-03-31' }, 'pdf');

    expect(axios.get).toHaveBeenCalledWith('/fiscal/reports/tourist-tax', {
      params: { from: '2026-01-01', to: '2026-03-31', format: 'pdf' },
      responseType: 'blob',
    });
    expect(vi.mocked(axios.get).mock.calls[0][1]).not.toHaveProperty('public');
    expect(result).toBe(blob);
  });

  it('downloadReport parses a JSON problem body before rethrowing (CO-19)', async () => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    const body = new Blob([JSON.stringify({ code: 'fiscal_report_period_invalid', detail: 'Periodo non valido.' })], {
      type: 'application/json',
    });
    vi.mocked(axios.get).mockRejectedValueOnce(
      new AxiosError('Bad Request', AxiosError.ERR_BAD_REQUEST, config, {}, {
        status: 400,
        data: body,
        statusText: '',
        headers: {},
        config,
      }),
    );

    const error = await fiscalApi
      .downloadReport('annual', 2026, { from: '2026-01-01', to: '2026-12-31' }, 'csv')
      .catch((e: unknown) => e);

    expect((error as AxiosError).response?.data).toEqual({ code: 'fiscal_report_period_invalid', detail: 'Periodo non valido.' });
  });
});
