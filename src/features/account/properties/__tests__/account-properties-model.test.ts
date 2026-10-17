import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { propertyDeleteBlock } from '@/lib/property-delete-block';
import type { LeaseSummary, Property } from '@/types';
import type { OrgMember } from '@/types/org-team.types';
import { accountPropertyRows, candidatesFor, reachesProperty } from '../account-properties-model';

// Only the rules that decide who is offered for a property and why a deletion is refused: a wrong answer offers a person the
// backend will turn down (422), or leaves a person at a dead end in front of the 409.

const property = (over: Partial<Property> = {}): Property =>
  ({ id: 'p1', name: 'Casa', city: 'Roma', cinCode: null, photoUrls: [], nightlyRate: 0, isPaused: false, complianceStatus: 'Pending', rentalMode: 'Short', ...over }) as Property;

const member = (over: Partial<OrgMember> = {}): OrgMember =>
  ({ id: 'm1', userId: 'u1', email: 'a@b.it', firstName: 'Ada', lastName: 'Rossi', role: 'Admin', status: 'Active', propertyScope: 'All', areas: ['short-rent', 'long-rent'], ...over }) as OrgMember;

const conflict = (code: string) =>
  new AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, { status: 409, data: { code } } as AxiosResponse);

describe('accountPropertyRows', () => {
  it('says what a short-term property that cannot work yet lacks, and who is in charge of it', () => {
    const [row] = accountPropertyRows({
      properties: [property({ responsibleUserId: 'u1' })],
      leases: undefined,
      members: [member()],
      peopleByProperty: new Map([['p1', 3]]),
      today: '2026-10-17',
    });

    expect(row.needsCompleting).toBe(true);
    expect(row.missing).toEqual(['cin', 'photos', 'price']);
    expect(row.responsible).toEqual({ userId: 'u1', name: 'Ada Rossi' });
    expect(row.people).toBe(3);
  });

  it('shows a long-term property as let from its lease, never to complete, and names nobody for a member who is gone', () => {
    const lease = { id: 'l1', propertyId: 'p2', status: 'Registered', startDate: '2026-01-01', endDate: '2027-01-01', updatedAt: '2026-01-01T00:00:00Z' } as LeaseSummary;
    const [row] = accountPropertyRows({
      properties: [property({ id: 'p2', rentalMode: 'Long', complianceStatus: 'Pending', responsibleUserId: 'gone' })],
      leases: [lease],
      members: [member()],
      peopleByProperty: undefined,
      today: '2026-10-17',
    });

    expect(row.state).toEqual({ kind: 'longRentProperty', status: 'Rented' });
    expect(row.needsCompleting).toBe(false);
    expect(row.lease?.id).toBe('l1');
    expect(row.responsible).toBeNull();
    expect(row.people).toBeNull();
  });
});

describe('who can be put in charge', () => {
  const row = { property: property(), mode: 'Short' as const };
  const limited = member({ id: 'm2', userId: 'u2', role: 'Collaborator', propertyScope: 'Selected', areas: ['short-rent'] });

  it('offers every active member, but a collaborator «Solo alcuni» only for the properties it was given', () => {
    expect(reachesProperty(member(), row, undefined)).toBe(true);
    expect(reachesProperty(limited, row, undefined)).toBe(false);
    expect(reachesProperty(limited, row, new Set(['p1']))).toBe(true);
    expect(reachesProperty(member({ status: 'Deactivated' }), row, undefined)).toBe(false);
  });

  it('does not offer a collaborator who works only in the other area, even for a property it was given', () => {
    expect(reachesProperty(limited, { property: property(), mode: 'Long' }, new Set(['p1']))).toBe(false);
  });

  it('offers for several properties only who reaches all of them', () => {
    const rows = [row, { property: property({ id: 'p2' }), mode: 'Short' as const }];
    const granted = new Map([['m2', new Set(['p1'])]]);

    expect(candidatesFor([member(), limited], rows, granted).map((candidate) => candidate.id)).toEqual(['m1']);
    expect(candidatesFor([member(), limited], [row], granted).map((candidate) => candidate.id)).toEqual(['m1', 'm2']);
  });
});

describe('propertyDeleteBlock', () => {
  it('tells the two refusals of the backend apart, and nothing else', () => {
    expect(propertyDeleteBlock(conflict('property_has_upcoming_bookings'))).toBe('bookings');
    expect(propertyDeleteBlock(conflict('property_has_active_leases'))).toBe('leases');
    expect(propertyDeleteBlock(conflict('duplicate_property_address'))).toBeNull();
    expect(propertyDeleteBlock(new Error('boom'))).toBeNull();
  });
});
