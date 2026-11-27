import { z } from 'zod';
import { resolveSiteStyle, type SiteStyleId } from '@/lib/supplier-site/style-config';
import { starterContentFor } from '@/lib/supplier-site/starter-content';
import type { SupplierService } from '@/types/supplier-services';
import type { ShowcaseDocument } from '@/types/supplier-showcase';
import { SHOWCASE_LIMITS } from '../showcase-limits';
import { planServices, serviceOrderOf } from '../showcase-services';
import type { DraftPatch } from '../use-showcase-draft';

const MIN_TAGLINE = 12;

export type WizardValues = {
  style: SiteStyleId;
  tagline: string;
  intro: string;
  services: string[];
};

export const presentationStepSchema = z.object({
  tagline: z
    .string()
    .trim()
    .min(MIN_TAGLINE, 'supplier.showcase.wizard.errors.tagline')
    .max(SHOWCASE_LIMITS.tagline, 'supplier.showcase.wizard.errors.tooLong'),
  intro: z.string().max(SHOWCASE_LIMITS.intro, 'supplier.showcase.wizard.errors.tooLong'),
});

export const servicesStepSchema = z.object({
  services: z.array(z.string()).min(1, 'supplier.showcase.wizard.errors.services'),
});

export interface WizardStart {
  values: WizardValues;
  prefilled: boolean;
}

/**
 * Where the wizard starts: what the draft has, and for the sentence and the introduction that are still empty the starting text of the
 * trade (the supplier reads it, changes it and saves it with "Continua"). Every active service is chosen unless the draft names some.
 */
export function wizardStart(draft: ShowcaseDocument, categories: readonly string[], services: readonly SupplierService[]): WizardStart {
  const starter = starterContentFor(categories);
  const tagline = (draft.tagline ?? '').trim() === '' ? (starter?.tagline ?? '') : (draft.tagline ?? '');
  const intro = (draft.intro ?? '').trim() === '' ? (starter?.intro ?? '') : (draft.intro ?? '');
  const prefilled = starter !== null && (tagline !== (draft.tagline ?? '') || intro !== (draft.intro ?? ''));
  return {
    values: {
      style: resolveSiteStyle(draft.style, categories),
      tagline,
      intro,
      services: planServices(services, draft.serviceOrder).shown.map((service) => service.slug),
    },
    prefilled,
  };
}

export function stylePatch(values: WizardValues, draft: ShowcaseDocument, categories: readonly string[]): DraftPatch | null {
  return values.style === resolveSiteStyle(draft.style, categories) ? null : { style: values.style };
}

export function presentationPatch(values: WizardValues, draft: ShowcaseDocument): DraftPatch | null {
  const patch: DraftPatch = {};
  const tagline = values.tagline.trim();
  const intro = values.intro.trim();
  if (tagline !== (draft.tagline ?? '').trim()) patch.tagline = tagline;
  if (intro !== (draft.intro ?? '').trim()) patch.intro = intro === '' ? null : intro;
  return Object.keys(patch).length > 0 ? patch : null;
}

export function servicesPatch(values: WizardValues, draft: ShowcaseDocument, services: readonly SupplierService[]): DraftPatch | null {
  const plan = planServices(services, draft.serviceOrder);
  const chosen = new Set(values.services);
  const ordered = [...plan.shown, ...plan.hidden].filter((service) => chosen.has(service.slug));
  const next = serviceOrderOf(services, ordered);
  const current = (draft.serviceOrder ?? []).length > 0 ? (draft.serviceOrder ?? []) : null;
  return JSON.stringify(next) === JSON.stringify(current) ? null : { serviceOrder: next };
}
