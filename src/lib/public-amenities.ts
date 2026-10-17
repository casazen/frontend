import {
  Accessibility,
  ArrowUpDown,
  Baby,
  Bath,
  BellRing,
  Bike,
  BriefcaseMedical,
  CalendarDays,
  Car,
  Cctv,
  ChefHat,
  Check,
  Cigarette,
  Coffee,
  CookingPot,
  DoorOpen,
  Dumbbell,
  FireExtinguisher,
  Flame,
  Footprints,
  KeyRound,
  Laptop,
  Lock,
  Luggage,
  Microwave,
  ParkingMeter,
  PawPrint,
  PlugZap,
  Refrigerator,
  Shirt,
  Snowflake,
  Sun,
  Thermometer,
  Trees,
  Tv,
  Umbrella,
  Utensils,
  UtensilsCrossed,
  Warehouse,
  WashingMachine,
  Waves,
  Wifi,
  Wind,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * The amenities of a property as the public site shows them. The backend sends the names of its `PropertyAmenity` enum
 * (`WiFi`, `AirConditioning`...), never a label: this catalog gives each one an icon, a group and a label key (guest wording,
 * Italian and English). A value that is not in the catalog is still shown, with a readable label made from its name.
 */
export type AmenityGroup =
  | 'kitchen'
  | 'climate'
  | 'connectivity'
  | 'laundry'
  | 'outdoor'
  | 'parking'
  | 'wellness'
  | 'family'
  | 'accessibility'
  | 'safety'
  | 'other';

interface AmenityMeta {
  icon: LucideIcon;
  group: AmenityGroup;
  labelKey: string;
}

/** The groups, in the order the full list shows them. */
export const AMENITY_GROUPS: ReadonlyArray<{ id: AmenityGroup; labelKey: string }> = [
  { id: 'kitchen', labelKey: 'publicProperty.amenityGroups.kitchen' },
  { id: 'climate', labelKey: 'publicProperty.amenityGroups.climate' },
  { id: 'connectivity', labelKey: 'publicProperty.amenityGroups.connectivity' },
  { id: 'laundry', labelKey: 'publicProperty.amenityGroups.laundry' },
  { id: 'outdoor', labelKey: 'publicProperty.amenityGroups.outdoor' },
  { id: 'parking', labelKey: 'publicProperty.amenityGroups.parking' },
  { id: 'wellness', labelKey: 'publicProperty.amenityGroups.wellness' },
  { id: 'family', labelKey: 'publicProperty.amenityGroups.family' },
  { id: 'accessibility', labelKey: 'publicProperty.amenityGroups.accessibility' },
  { id: 'safety', labelKey: 'publicProperty.amenityGroups.safety' },
  { id: 'other', labelKey: 'publicProperty.amenityGroups.other' },
];

const AMENITY_CATALOG: Record<string, AmenityMeta> = {
  WiFi: { icon: Wifi, group: 'connectivity', labelKey: 'publicProperty.amenities.WiFi' },
  TV: { icon: Tv, group: 'connectivity', labelKey: 'publicProperty.amenities.TV' },
  CableTV: { icon: Tv, group: 'connectivity', labelKey: 'publicProperty.amenities.CableTV' },
  Workspace: { icon: Laptop, group: 'connectivity', labelKey: 'publicProperty.amenities.Workspace' },
  AirConditioning: { icon: Snowflake, group: 'climate', labelKey: 'publicProperty.amenities.AirConditioning' },
  Heating: { icon: Thermometer, group: 'climate', labelKey: 'publicProperty.amenities.Heating' },
  Fireplace: { icon: Flame, group: 'climate', labelKey: 'publicProperty.amenities.Fireplace' },
  Kitchen: { icon: CookingPot, group: 'kitchen', labelKey: 'publicProperty.amenities.Kitchen' },
  Refrigerator: { icon: Refrigerator, group: 'kitchen', labelKey: 'publicProperty.amenities.Refrigerator' },
  Microwave: { icon: Microwave, group: 'kitchen', labelKey: 'publicProperty.amenities.Microwave' },
  Dishwasher: { icon: UtensilsCrossed, group: 'kitchen', labelKey: 'publicProperty.amenities.Dishwasher' },
  CoffeeMaker: { icon: Coffee, group: 'kitchen', labelKey: 'publicProperty.amenities.CoffeeMaker' },
  Stove: { icon: Flame, group: 'kitchen', labelKey: 'publicProperty.amenities.Stove' },
  Oven: { icon: ChefHat, group: 'kitchen', labelKey: 'publicProperty.amenities.Oven' },
  DiningTable: { icon: Utensils, group: 'kitchen', labelKey: 'publicProperty.amenities.DiningTable' },
  Washer: { icon: WashingMachine, group: 'laundry', labelKey: 'publicProperty.amenities.Washer' },
  Dryer: { icon: Wind, group: 'laundry', labelKey: 'publicProperty.amenities.Dryer' },
  IronAndBoard: { icon: Shirt, group: 'laundry', labelKey: 'publicProperty.amenities.IronAndBoard' },
  Pool: { icon: Waves, group: 'outdoor', labelKey: 'publicProperty.amenities.Pool' },
  HotTub: { icon: Bath, group: 'outdoor', labelKey: 'publicProperty.amenities.HotTub' },
  Garden: { icon: Trees, group: 'outdoor', labelKey: 'publicProperty.amenities.Garden' },
  Patio: { icon: Sun, group: 'outdoor', labelKey: 'publicProperty.amenities.Patio' },
  Balcony: { icon: Sun, group: 'outdoor', labelKey: 'publicProperty.amenities.Balcony' },
  BBQGrill: { icon: Flame, group: 'outdoor', labelKey: 'publicProperty.amenities.BBQGrill' },
  BeachAccess: { icon: Umbrella, group: 'outdoor', labelKey: 'publicProperty.amenities.BeachAccess' },
  Terrace: { icon: Sun, group: 'outdoor', labelKey: 'publicProperty.amenities.Terrace' },
  FreeParking: { icon: Car, group: 'parking', labelKey: 'publicProperty.amenities.FreeParking' },
  PaidParking: { icon: ParkingMeter, group: 'parking', labelKey: 'publicProperty.amenities.PaidParking' },
  Garage: { icon: Warehouse, group: 'parking', labelKey: 'publicProperty.amenities.Garage' },
  EVCharger: { icon: PlugZap, group: 'parking', labelKey: 'publicProperty.amenities.EVCharger' },
  BikeStorage: { icon: Bike, group: 'parking', labelKey: 'publicProperty.amenities.BikeStorage' },
  SmokeDetector: { icon: BellRing, group: 'safety', labelKey: 'publicProperty.amenities.SmokeDetector' },
  CarbonMonoxideDetector: { icon: BellRing, group: 'safety', labelKey: 'publicProperty.amenities.CarbonMonoxideDetector' },
  FireExtinguisher: { icon: FireExtinguisher, group: 'safety', labelKey: 'publicProperty.amenities.FireExtinguisher' },
  FirstAidKit: { icon: BriefcaseMedical, group: 'safety', labelKey: 'publicProperty.amenities.FirstAidKit' },
  SecurityCameras: { icon: Cctv, group: 'safety', labelKey: 'publicProperty.amenities.SecurityCameras' },
  Safe: { icon: Lock, group: 'safety', labelKey: 'publicProperty.amenities.Safe' },
  WheelchairAccessible: { icon: Accessibility, group: 'accessibility', labelKey: 'publicProperty.amenities.WheelchairAccessible' },
  Elevator: { icon: ArrowUpDown, group: 'accessibility', labelKey: 'publicProperty.amenities.Elevator' },
  StepFreeAccess: { icon: Footprints, group: 'accessibility', labelKey: 'publicProperty.amenities.StepFreeAccess' },
  PetFriendly: { icon: PawPrint, group: 'family', labelKey: 'publicProperty.amenities.PetFriendly' },
  SmokingAllowed: { icon: Cigarette, group: 'family', labelKey: 'publicProperty.amenities.SmokingAllowed' },
  Crib: { icon: Baby, group: 'family', labelKey: 'publicProperty.amenities.Crib' },
  HighChair: { icon: Baby, group: 'family', labelKey: 'publicProperty.amenities.HighChair' },
  Gym: { icon: Dumbbell, group: 'wellness', labelKey: 'publicProperty.amenities.Gym' },
  Sauna: { icon: Thermometer, group: 'wellness', labelKey: 'publicProperty.amenities.Sauna' },
  SelfCheckIn: { icon: KeyRound, group: 'other', labelKey: 'publicProperty.amenities.SelfCheckIn' },
  LongTermStaysAllowed: { icon: CalendarDays, group: 'other', labelKey: 'publicProperty.amenities.LongTermStaysAllowed' },
  LuggageDropOffAllowed: { icon: Luggage, group: 'other', labelKey: 'publicProperty.amenities.LuggageDropOffAllowed' },
  PrivateEntrance: { icon: DoorOpen, group: 'other', labelKey: 'publicProperty.amenities.PrivateEntrance' },
};

/** What guests look for first: these come before the rest when the list is short. The others follow in catalog order. */
const HIGHLIGHTS = [
  'WiFi',
  'AirConditioning',
  'Heating',
  'Kitchen',
  'Washer',
  'TV',
  'FreeParking',
  'Pool',
  'Terrace',
  'Balcony',
  'Garden',
  'BeachAccess',
  'Elevator',
  'PetFriendly',
  'SelfCheckIn',
  'Workspace',
];

const CATALOG_ORDER = Object.keys(AMENITY_CATALOG);

/** `WiFi`, `wifi` and `Wi-Fi` are the same amenity. */
const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const CATALOG_BY_NAME = new Map(CATALOG_ORDER.map((id) => [normalise(id), id]));

export interface DescribedAmenity {
  /** Stable key of the amenity (the catalog name, or the normalised value when it is not in the catalog). */
  id: string;
  /** Translation key of the label; null for a value the catalog does not know (use `fallbackLabel`). */
  labelKey: string | null;
  fallbackLabel: string;
  icon: LucideIcon;
  group: AmenityGroup;
}

/** `SomeNewAmenity` becomes "Some new amenity"; text that already has spaces is only given a capital letter. */
export function humanizeAmenity(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  if (/\s/.test(text)) return text.charAt(0).toUpperCase() + text.slice(1);
  const words = text
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/\s+/);
  return words
    .map((word, index) => (word.length > 1 && word === word.toUpperCase() ? word : index === 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase()))
    .join(' ');
}

export function describeAmenity(raw: string): DescribedAmenity | null {
  const text = raw.trim();
  if (!text) return null;
  const known = CATALOG_BY_NAME.get(normalise(text));
  if (known) {
    const meta = AMENITY_CATALOG[known];
    return { id: known, labelKey: meta.labelKey, fallbackLabel: humanizeAmenity(known), icon: meta.icon, group: meta.group };
  }
  return { id: normalise(text) || text, labelKey: null, fallbackLabel: humanizeAmenity(text), icon: Check, group: 'other' };
}

/**
 * The amenities of a property ready to show: no blanks, no repeats, the most wanted first, the values the catalog does not
 * know at the end in the order they came.
 */
export function listAmenities(raw: readonly string[]): DescribedAmenity[] {
  const seen = new Set<string>();
  const known: DescribedAmenity[] = [];
  const unknown: DescribedAmenity[] = [];
  for (const value of raw) {
    const amenity = describeAmenity(value);
    if (!amenity || seen.has(amenity.id)) continue;
    seen.add(amenity.id);
    (amenity.labelKey ? known : unknown).push(amenity);
  }
  const rank = (id: string) => {
    const highlight = HIGHLIGHTS.indexOf(id);
    return highlight >= 0 ? highlight : HIGHLIGHTS.length + CATALOG_ORDER.indexOf(id);
  };
  known.sort((a, b) => rank(a.id) - rank(b.id));
  return [...known, ...unknown];
}
