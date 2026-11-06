import { BED_TYPES } from '@/types';
import type { BedType, PropertyRoom, PropertyRoomInput, PropertyRoomType, RoomBed } from '@/types';

/** The limits of the backend (`PropertyRoom`, `PropertyHouseRules`): at most 20 rooms, 1 to 10 beds of a kind, 1 to 100 beds in all. */
export const MAX_ROOMS = 20;
export const MAX_BEDS_OF_A_KIND = 10;
export const MIN_TOTAL_BEDS = 1;
export const MAX_TOTAL_BEDS = 100;

/**
 * A room as the wizard edits it. `key` tells the rooms apart on screen and, for a room that is stored, is its id: the save sends that
 * id so the room is updated and its photos keep their room, while a room with a key of its own is new.
 */
export interface RoomDraft {
  key: string;
  type: PropertyRoomType;
  beds: RoomBed[];
}

/** The rooms the server has, as the fields of the wizard. */
export function roomDraftsFromServer(rooms: readonly PropertyRoom[]): RoomDraft[] {
  return rooms.map((room) => ({ key: room.id, type: room.type, beds: room.beds.map((bed) => ({ ...bed })) }));
}

let created = 0;

/** A new room, with one double bed: the commonest answer, which the host changes. */
export function newRoomDraft(type: PropertyRoomType = 'Bedroom'): RoomDraft {
  created += 1;
  return { key: `new-room-${created}-${Date.now().toString(36)}`, type, beds: [{ type: 'Double', count: 1 }] };
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The name of a room in a list: its place in the order the host gave and what it is («2. Camera da letto»). */
export function roomOptionLabel(t: Translate, room: Pick<PropertyRoom, 'type'>, index: number): string {
  return t('propertyWizard.rooms.optionLabel', { number: index + 1, type: t(`propertyWizard.rooms.types.${room.type}`) });
}

/** How many beds there are in all. */
export function totalBeds(rooms: readonly RoomDraft[]): number {
  return rooms.reduce((sum, room) => sum + room.beds.reduce((roomSum, bed) => roomSum + bed.count, 0), 0);
}

/** How many rooms are bedrooms: what the counter `bedrooms` of the property becomes once the rooms are saved. */
export function bedroomCount(rooms: readonly RoomDraft[]): number {
  return rooms.filter((room) => room.type === 'Bedroom').length;
}

/** A comparable form of the rooms: two lists that say the same thing have the same signature, so a step that changed nothing sends nothing. */
export function roomsSignature(rooms: readonly RoomDraft[]): string {
  return JSON.stringify(rooms.map((room) => [room.key, room.type, room.beds.map((bed) => [bed.type, bed.count])]));
}

/** The first kind of bed the room does not have yet, or `null` when it has them all. */
export function nextFreeBedType(beds: readonly RoomBed[]): BedType | null {
  return BED_TYPES.find((type) => !beds.some((bed) => bed.type === type)) ?? null;
}

/**
 * The body that saves the rooms. `idOf` gives the id of a room that is stored (by its key): a room with an id is updated, the others are
 * new. The server replaces the whole list, so a room that is not here is removed together with the room of its photos.
 */
export function roomInputs(rooms: readonly RoomDraft[], idOf: (key: string) => string | undefined): PropertyRoomInput[] {
  return rooms.map((room) => ({ id: idOf(room.key) ?? null, type: room.type, beds: room.beds.map((bed) => ({ type: bed.type, count: bed.count })) }));
}
