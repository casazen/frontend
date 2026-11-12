import { describe, expect, it } from 'vitest';
import type { PropertyRoom } from '@/types';
import { NEW_PROPERTY_DEFAULTS, baseStepSchema, wizardDefaults } from '../property-wizard-model';
import {
  bedroomCount,
  newRoomDraft,
  nextFreeBedType,
  roomDraftsFromServer,
  roomInputs,
  roomOptionLabel,
  roomsSignature,
  totalBeds,
  type RoomDraft,
} from '../rooms-model';

const SERVER: PropertyRoom[] = [
  { id: 'r1', position: 0, type: 'Bedroom', beds: [{ type: 'Double', count: 1 }] },
  { id: 'r2', position: 1, type: 'Bedroom', beds: [{ type: 'Single', count: 2 }, { type: 'Crib', count: 1 }] },
  { id: 'r3', position: 2, type: 'LivingRoom', beds: [{ type: 'SofaBed', count: 1 }] },
];

const base = { ...NEW_PROPERTY_DEFAULTS, name: 'Casa Lago', address: 'Via Roma 1', comuneIstatCode: '013075', city: 'Como' };

describe('the rooms of the first step (NF-34)', () => {
  it('roomDraftsFromServer_KeepsTheIdAsTheKey_SoTheSaveUpdatesTheRoomAndItsPhotosKeepIt', () => {
    const rooms = roomDraftsFromServer(SERVER);

    expect(rooms.map((room) => room.key)).toEqual(['r1', 'r2', 'r3']);
    expect(roomInputs(rooms, (key) => key)).toEqual([
      { id: 'r1', type: 'Bedroom', beds: [{ type: 'Double', count: 1 }] },
      { id: 'r2', type: 'Bedroom', beds: [{ type: 'Single', count: 2 }, { type: 'Crib', count: 1 }] },
      { id: 'r3', type: 'LivingRoom', beds: [{ type: 'SofaBed', count: 1 }] },
    ]);
  });

  it('roomInputs_ARoomThatIsNotStoredYet_GoesWithoutAnId', () => {
    const added = [...roomDraftsFromServer(SERVER.slice(0, 1)), newRoomDraft('Studio')];
    const stored = new Map([['r1', 'r1']]);

    const inputs = roomInputs(added, (key) => stored.get(key));

    expect(inputs.map((room) => room.id)).toEqual(['r1', null]);
    expect(inputs[1]).toMatchObject({ type: 'Studio', beds: [{ type: 'Double', count: 1 }] });
  });

  it('counters_AreWorkedOutFromTheRooms', () => {
    const rooms = roomDraftsFromServer(SERVER);

    expect(bedroomCount(rooms)).toBe(2);
    expect(totalBeds(rooms)).toBe(5);
    expect(nextFreeBedType([{ type: 'Single', count: 1 }, { type: 'Double', count: 1 }])).toBe('Queen');
    expect(nextFreeBedType(['Single', 'Double', 'Queen', 'King', 'SofaBed', 'Bunk', 'Crib'].map((type) => ({ type, count: 1 }) as RoomDraft['beds'][number]))).toBeNull();
  });

  it('wizardDefaults_APropertyWithRooms_TakesTheCountersFromThem', () => {
    const property = { ...base, id: 'p1', bedrooms: 9, beds: 9, maxGuests: 6, bathrooms: 2, amenities: [], photoUrls: [], houseRules: '' };
    const defaults = wizardDefaults(property as never, { rooms: SERVER, stayDiscounts: [], siteProfile: null, photoMeta: [] });

    expect(defaults.rooms).toHaveLength(3);
    expect(defaults.bedrooms).toBe(2);
    expect(defaults.beds).toBe(5);
    // Max guests, bathrooms and the area are not derived from the rooms (AC-NF34-2).
    expect(defaults.maxGuests).toBe(6);
    expect(defaults.bathrooms).toBe(2);
  });

  it('roomsSignature_TheSameRooms_TheSameSignature', () => {
    expect(roomsSignature(roomDraftsFromServer(SERVER))).toBe(roomsSignature(roomDraftsFromServer(SERVER)));
    const changed = roomDraftsFromServer(SERVER);
    changed[0]!.beds[0]!.count = 2;
    expect(roomsSignature(changed)).not.toBe(roomsSignature(roomDraftsFromServer(SERVER)));
  });

  it('roomOptionLabel_NamesTheRoomWithItsPlace', () => {
    const t = (key: string, options?: Record<string, unknown>) => `${key}|${JSON.stringify(options)}`;

    expect(roomOptionLabel(t, { type: 'Bedroom' }, 1)).toContain('"number":2');
  });
});

describe('baseStepSchema and the rooms', () => {
  it('rooms_NoneAtAll_IsFine_TheHostGaveTheCountersOnly', () => {
    expect(baseStepSchema.safeParse({ ...base, rooms: [] }).success).toBe(true);
  });

  it('rooms_WithABed_IsFine_WithoutAnyBedItIsRefusedOnTheRooms', () => {
    const withBed = roomDraftsFromServer(SERVER);
    const bedless: RoomDraft[] = [{ key: 'k1', type: 'Bedroom', beds: [] }];

    expect(baseStepSchema.safeParse({ ...base, rooms: withBed }).success).toBe(true);
    const refused = baseStepSchema.safeParse({ ...base, rooms: bedless });
    expect(refused.success).toBe(false);
    expect(refused.error?.issues[0]).toMatchObject({ path: ['rooms'], message: 'propertyWizard.validation.rooms.noBed' });
  });

  it('rooms_MoreThanTwentyOrMoreThanAHundredBeds_AreRefused', () => {
    const room = (index: number): RoomDraft => ({ key: `k${index}`, type: 'Other', beds: [{ type: 'Single', count: 1 }] });
    expect(baseStepSchema.safeParse({ ...base, rooms: Array.from({ length: 21 }, (_, index) => room(index)) }).success).toBe(false);
    expect(baseStepSchema.safeParse({ ...base, rooms: Array.from({ length: 20 }, (_, index) => room(index)) }).success).toBe(true);

    const crowded: RoomDraft[] = Array.from({ length: 11 }, (_, index) => ({
      key: `c${index}`,
      type: 'Other',
      beds: [{ type: 'Single', count: 10 }],
    }));
    expect(baseStepSchema.safeParse({ ...base, rooms: crowded }).error?.issues[0]?.message).toBe('propertyWizard.validation.rooms.tooManyBeds');
  });
});
