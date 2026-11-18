export type HomeSectionId = 'case' | 'perche' | 'zone' | 'domande';

/** In the order they are on the page. */
const HOME_SECTION_IDS: readonly HomeSectionId[] = ['case', 'perche', 'zone', 'domande'];

export function isHomeSectionId(value: string | null | undefined): value is HomeSectionId {
  return (HOME_SECTION_IDS as readonly string[]).includes(value ?? '');
}

export function homeSectionIds(homeCount: number, zoneCount: number): readonly HomeSectionId[] {
  if (homeCount < 2) return [];
  return zoneCount >= 2 ? HOME_SECTION_IDS : HOME_SECTION_IDS.filter((id) => id !== 'zone');
}
