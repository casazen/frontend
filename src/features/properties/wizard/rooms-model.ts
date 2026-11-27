import { BED_TYPES } from '@/types';
import type { BedType, PropertyRoom, PropertyRoomInput, PropertyRoomType, RoomBed } from '@/types';

export const MAX_ROOMS = 20;
export const MAX_BEDS_OF_A_KIND = 10;
export const MIN_TOTAL_BEDS = 1;
export const MAX_TOTAL_BEDS = 100;

export interface RoomDraft {
  key: string;
  type: PropertyRoomType;
  beds: RoomBed[];
}

export function roomDraftsFromServer(rooms: readonly PropertyRoom[]): RoomDraft[] {
  return rooms.map((room) => ({ key: room.id, type: room.type, beds: room.beds.map((bed) => ({ ...bed })) }));
}

let created = 0;

export function newRoomDraft(type: PropertyRoomType = 'Bedroom'): RoomDraft {
  created += 1;
  return { key: `new-room-${created}-${Date.now().toString(36)}`, type, beds: [{ type: 'Double', count: 1 }] };
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function roomOptionLabel(t: Translate, room: Pick<PropertyRoom, 'type'>, index: number): string {
  return t('propertyWizard.rooms.optionLabel', { number: index + 1, type: t(`propertyWizard.rooms.types.${room.type}`) });
}

export function totalBeds(rooms: readonly RoomDraft[]): number {
  return rooms.reduce((sum, room) => sum + room.beds.reduce((roomSum, bed) => roomSum + bed.count, 0), 0);
}

export function bedroomCount(rooms: readonly RoomDraft[]): number {
  return rooms.filter((room) => room.type === 'Bedroom').length;
}

export function roomsSignature(rooms: readonly RoomDraft[]): string {
  return JSON.stringify(rooms.map((room) => [room.key, room.type, room.beds.map((bed) => [bed.type, bed.count])]));
}

export function nextFreeBedType(beds: readonly RoomBed[]): BedType | null {
  return BED_TYPES.find((type) => !beds.some((bed) => bed.type === type)) ?? null;
}

export function roomInputs(rooms: readonly RoomDraft[], idOf: (key: string) => string | undefined): PropertyRoomInput[] {
  return rooms.map((room) => ({ id: idOf(room.key) ?? null, type: room.type, beds: room.beds.map((bed) => ({ type: bed.type, count: bed.count })) }));
}
