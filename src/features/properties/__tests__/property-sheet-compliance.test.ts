import { describe, expect, it } from 'vitest';
import type { ComplianceLine } from '@/features/compliance/lib/compliance-lines';
import { complianceLineOf, mayGiveWayToCompliance, nextStepOf } from '../lib/property-sheet';

const line = (state: ComplianceLine['state'], action: ComplianceLine['action'] = 'ActivateOctorateSend'): ComplianceLine => ({
  id: `${action}-p1`,
  action,
  state,
  reason: null,
  period: null,
  dueAt: null,
  item: { id: 'p1', label: 'Casa Como', action, propertyId: 'p1', bookingId: null, light: state === 'green' ? 'Green' : state === 'yellow' ? 'Yellow' : 'Red' },
});

const active = { status: 'Active', cinStatus: 'Valid', photoCount: 3, canWrite: true } as const;

describe('property nextStepOf with the compliance lights (NF-52, AC-NF52-9)', () => {
  it('nextStepOf_NoLines_IsTheStepOfAlways', () => {
    // An older API, the traffic light off, lights not read: nothing changes, and nothing is told as in order by the lights.
    expect(nextStepOf(active)).toBe('allInOrder');
    expect(nextStepOf({ ...active, compliance: [] })).toBe('allInOrder');
    expect(nextStepOf({ ...active, photoCount: 0 })).toBe('addPhotos');
  });

  it('nextStepOf_RedItem_IsTheStepEvenBeforeTheMissingPhotos', () => {
    expect(nextStepOf({ ...active, compliance: [line('red')] })).toBe('compliance');
    expect(nextStepOf({ ...active, photoCount: 0, compliance: [line('red')] })).toBe('compliance');
  });

  it('nextStepOf_ItemInHand_GivesWayToThePhotosButTakesTheAllInOrder', () => {
    expect(nextStepOf({ ...active, photoCount: 0, compliance: [line('yellow')] })).toBe('addPhotos');
    expect(nextStepOf({ ...active, compliance: [line('yellow')] })).toBe('compliance');
  });

  it('nextStepOf_OnlyWhatIsInOrder_IsTheStepOfAlways', () => {
    expect(nextStepOf({ ...active, compliance: [line('green'), line('green', 'RenewPoliceCredentials')] })).toBe('allInOrder');
  });

  it.each([
    [{ status: 'Suspended' }, 'suspended'],
    [{ status: 'Pending' }, 'completeActivation'],
    [{ status: 'Paused' }, 'reactivate'],
    [{ cinStatus: 'Missing' }, 'cinMissing'],
    [{ cinStatus: 'Invalid' }, 'cinInvalid'],
  ] as const)('nextStepOf_%j_KeepsItsStepWhateverTheLightsSay', (facts, kind) => {
    // The activation, the pause and the CIN come first: a light never takes them.
    expect(nextStepOf({ ...active, ...facts, compliance: [line('red')] })).toBe(kind);
  });

  it('complianceLineOf_IsTheWorstOfTheOnesNotInOrder', () => {
    const red = line('red', 'UploadIstatProof');

    expect(complianceLineOf([red, line('yellow'), line('green')])).toBe(red);
    expect(complianceLineOf([line('green')])).toBeUndefined();
    expect(complianceLineOf(undefined)).toBeUndefined();
  });

  it('mayGiveWayToCompliance_OnlyTheStepsThatTheLightsCanTakeBack', () => {
    expect(mayGiveWayToCompliance('allInOrder')).toBe(true);
    expect(mayGiveWayToCompliance('addPhotos')).toBe(true);
    expect(mayGiveWayToCompliance('compliance')).toBe(false);
    expect(mayGiveWayToCompliance('cinMissing')).toBe(false);
  });
});
