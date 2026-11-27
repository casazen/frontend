import { describe, expect, it } from 'vitest';
import { tenantMaintenanceStatus } from '../maintenance-status';

describe('tenantMaintenanceStatus', () => {
  it('keeps a tenant status and hides a supplier commercial state', () => {
    expect(tenantMaintenanceStatus('NeedsInfo')).toBe('NeedsInfo');
    expect(tenantMaintenanceStatus('Pagato')).toBe('Closed');
    expect(tenantMaintenanceStatus('Rifiutato')).toBe('Rejected');
    expect(tenantMaintenanceStatus('quote-sent')).toBe('Sent');
  });
});
