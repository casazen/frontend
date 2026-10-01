import type { Comune } from '@/types/comune.types';

/** "Name (MI)": the comune as one line. */
export function comuneLabel(comune: Pick<Comune, 'name' | 'provinceCode'>): string {
  return `${comune.name} (${comune.provinceCode})`;
}
