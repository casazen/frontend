import { CalendarCheck, Heart, History, Plane, RotateCcw, UserPlus, Users, type LucideIcon } from 'lucide-react';
import type { CalmTone } from '@/components/shared/calm/calm-tone';
import type { ConditionDefinition } from '@/types/campaign.types';
import { conditionOf, emptyCondition, lastStayRule, listRule } from './segment-rules';

export interface SegmentRecipe {
  id: string;
  icon: LucideIcon;
  tone: CalmTone;
  condition: ConditionDefinition;
  propertyName?: string;
}

export const SEGMENT_RECIPES: readonly SegmentRecipe[] = [
  { id: 'recent', icon: CalendarCheck, tone: 'success', condition: conditionOf([lastStayRule('inLast', 60)]) },
  { id: 'first', icon: UserPlus, tone: 'info', condition: conditionOf([listRule('stage', true, ['first'])]) },
  { id: 'returning', icon: RotateCcw, tone: 'neutral', condition: conditionOf([listRule('stage', true, ['returning'])]) },
  { id: 'loyal', icon: Heart, tone: 'warning', condition: conditionOf([listRule('stage', true, ['loyal'])]) },
  { id: 'lost', icon: History, tone: 'info', condition: conditionOf([listRule('stage', true, ['lost'])]) },
  { id: 'upcoming', icon: Plane, tone: 'success', condition: conditionOf([listRule('stage', true, ['upcoming'])]) },
  { id: 'all', icon: Users, tone: 'neutral', condition: emptyCondition() },
];

export function propertyRecipes(properties: ReadonlyArray<{ id: string; name: string }>): SegmentRecipe[] {
  if (properties.length < 2) return [];
  return properties.slice(0, 3).map((property) => ({
    id: `property:${property.id}`,
    icon: Users,
    tone: 'neutral' as const,
    propertyName: property.name,
    condition: conditionOf([listRule('propertyHistory', true, [property.id])]),
  }));
}

export const recipeById = (id: string, properties: ReadonlyArray<{ id: string; name: string }> = []): SegmentRecipe | undefined =>
  [...SEGMENT_RECIPES, ...propertyRecipes(properties)].find((recipe) => recipe.id === id);
