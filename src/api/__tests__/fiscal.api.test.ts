import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fiscalApi } from '../fiscal.api';
import { ApiClient } from '../client';

vi.mock('../client');

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
});
