import { describe, expect, it } from 'vitest';
import { parseTenantMaintenance } from '../parse-tenant-area';

describe('parseTenantMaintenance', () => {
  it('drops supplier commercial fields and supplier messages', () => {
    const request = parseTenantMaintenance({
      id: 'req-1',
      category: 'plumbing',
      urgency: 'Emergency',
      description: 'Perde acqua',
      submittedAt: '2026-11-01T09:00:00Z',
      status: 'Richiesto',
      supplierName: 'Idraulica Rossi',
      priceCents: 18000,
      paymentMode: 'Online',
      messages: [
        { id: 'm1', from: 'Manager', body: 'Ho ricevuto la richiesta.', at: '2026-11-01T10:00:00Z' },
        { id: 'm2', from: 'Supplier', body: 'Preventivo 180 euro.', at: '2026-11-01T11:00:00Z' },
      ],
    });

    expect(request.status).toBe('Sent');
    expect(request.updates.map((update) => update.text)).toEqual(['Ho ricevuto la richiesta.']);
    expect(JSON.stringify(request)).not.toContain('Rossi');
    expect(JSON.stringify(request)).not.toContain('180');
  });
});
