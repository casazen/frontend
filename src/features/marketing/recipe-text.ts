import type { TFunction } from 'i18next';
import type { SegmentRecipe } from './segment-recipes';

export function recipeText(t: TFunction, recipe: SegmentRecipe): { title: string; description: string } {
  if (recipe.propertyName) {
    return {
      title: t('marketingHub.recipes.property.title', { name: recipe.propertyName }),
      description: t('marketingHub.recipes.property.description', { name: recipe.propertyName }),
    };
  }
  return {
    title: t(`marketingHub.recipes.${recipe.id}.title`),
    description: t(`marketingHub.recipes.${recipe.id}.description`),
  };
}
