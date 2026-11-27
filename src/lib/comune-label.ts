import type { Comune } from '@/types/comune.types';

export function comuneLabel(comune: Pick<Comune, 'name' | 'provinceCode'>): string {
  return `${comune.name} (${comune.provinceCode})`;
}
