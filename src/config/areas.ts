import type { AppContextKey } from './route-manifest';

/**
 * The areas of the app as the user sees them (UI-04a): name, what they are for, icon and accent. They replace the
 * `displayName` the backend sends for each context ("Affitti lungo termine"), which the area selector no longer shows.
 *
 * Names and descriptions come from the demo (`redesign/assets/shell.js`). The `admin` area is the staff console of the
 * platform (`/app/admin`), not the customer's "Amministrazione" of the demo: it keeps the name it has today and gets a
 * description of what it really does, until the customer's account area exists (decision D1, context `account`).
 */
export interface AreaDefinition {
  key: AppContextKey;
  /** i18n key of the name (`areas.<area>.name`). */
  nameKey: string;
  /** i18n key of what the area is for (`areas.<area>.description`). */
  descriptionKey: string;
  /** Name of the icon in `NAV_ICONS`. */
  icon: string;
  /**
   * Accent of the area: the `data-area` of `<html>` while the user is in it (UI-01), which sets `--color-primary` to the
   * accent when the redesign is on. Same value as the area key; `account` will share the one of `admin`.
   */
  accent: AppContextKey;
  /** i18n key of the line at the bottom of the sidebar, when the area has its own (default: the version). */
  footerKey?: string;
}

export const AREAS: Record<AppContextKey, AreaDefinition> = {
  'short-rent': {
    key: 'short-rent',
    nameKey: 'areas.shortRent.name',
    descriptionKey: 'areas.shortRent.description',
    icon: 'Sun',
    accent: 'short-rent',
  },
  'long-rent': {
    key: 'long-rent',
    nameKey: 'areas.longRent.name',
    descriptionKey: 'areas.longRent.description',
    icon: 'Home',
    accent: 'long-rent',
  },
  supplier: {
    key: 'supplier',
    nameKey: 'areas.supplier.name',
    descriptionKey: 'areas.supplier.description',
    icon: 'Wrench',
    accent: 'supplier',
  },
  admin: {
    key: 'admin',
    nameKey: 'areas.admin.name',
    descriptionKey: 'areas.admin.description',
    icon: 'Shield',
    accent: 'admin',
    footerKey: 'shell.adminFooter',
  },
};

/** Order of the areas in the selector. */
export const AREA_ORDER: readonly AppContextKey[] = ['short-rent', 'long-rent', 'supplier', 'admin'];

export function getArea(key: AppContextKey): AreaDefinition {
  return AREAS[key];
}

/** The areas of `contexts` (the ones the user can open), in {@link AREA_ORDER}; unknown keys are left out. */
export function getAccessibleAreas(contexts: readonly { contextKey: string }[]): AreaDefinition[] {
  return AREA_ORDER.filter((key) => contexts.some((context) => context.contextKey === key)).map((key) => AREAS[key]);
}
