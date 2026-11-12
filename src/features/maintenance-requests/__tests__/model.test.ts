import { describe, expect, it } from 'vitest';
import {
  canDecideMaintenance,
  canPayMaintenance,
  maintenanceUrgencyWire,
  parseMaintenanceRequest,
  parseMaintenanceRequestList,
} from '../model';

describe('maintenance request model', () => {
  it('reads a request from the lease endpoint, including a wrapped list', () => {
    const parsed = parseMaintenanceRequestList({
      items: [
        {
          id: 'mr-1',
          leaseId: 'lease-1',
          what: 'Rubinetto del bagno',
          urgency: 'urgente',
          note: 'Gocciola',
          photoName: 'foto.jpg',
          status: 'pending',
          reason: null,
          createdAt: '2026-11-08T10:00:00Z',
        },
      ],
    });
    expect(parsed).toEqual([
      {
        id: 'mr-1',
        leaseId: 'lease-1',
        what: 'Rubinetto del bagno',
        urgency: 'urgente',
        note: 'Gocciola',
        photoName: 'foto.jpg',
        status: 'pending',
        reason: null,
        createdAt: '2026-11-08T10:00:00Z',
      },
    ]);
  });

  it('maps approved, rejected and paid answers onto the statuses the screens use', () => {
    expect(parseMaintenanceRequest({ id: 'a', status: 'Approved', urgency: 'low' })?.status).toBe('approved');
    expect(parseMaintenanceRequest({ id: 'b', status: 'rifiutata', rejectionReason: 'Non compete' })?.reason).toBe('Non compete');
    expect(parseMaintenanceRequest({ id: 'c', status: 'paid' })?.status).toBe('paid');
    expect(parseMaintenanceRequest({ status: 'pending' })).toBeNull();
  });

  it('sends the C# enum names and reads them back onto the Italian choices', () => {
    expect(maintenanceUrgencyWire('bassa')).toBe('Normal');
    expect(maintenanceUrgencyWire('normale')).toBe('High');
    expect(maintenanceUrgencyWire('urgente')).toBe('Emergency');
    expect(parseMaintenanceRequest({ id: 'n', urgency: 'Normal' })?.urgency).toBe('bassa');
    expect(parseMaintenanceRequest({ id: 'h', urgency: 'High' })?.urgency).toBe('normale');
    expect(parseMaintenanceRequest({ id: 'e', urgency: 'Emergency' })?.urgency).toBe('urgente');
  });

  it('lets only the landlord pay, and only after approval', () => {
    expect(canPayMaintenance('tenant', 'approved')).toBe(false);
    expect(canPayMaintenance('tenant', 'pending')).toBe(false);
    expect(canPayMaintenance('landlord', 'pending')).toBe(false);
    expect(canPayMaintenance('landlord', 'rejected')).toBe(false);
    expect(canPayMaintenance('landlord', 'approved')).toBe(true);
    expect(canDecideMaintenance('tenant', 'pending')).toBe(false);
    expect(canDecideMaintenance('landlord', 'pending')).toBe(true);
    expect(canDecideMaintenance('landlord', 'approved')).toBe(false);
  });
});
