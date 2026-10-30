import { z } from 'zod';
import { resolveSiteStyle, type SiteStyleId } from '@/lib/supplier-site/style-config';
import { starterContentFor } from '@/lib/supplier-site/starter-content';
import type { SupplierService } from '@/types/supplier-services';
import type { ShowcaseDocument } from '@/types/supplier-showcase';
import { SHOWCASE_LIMITS } from '../showcase-limits';
import { planServices, serviceOrderOf } from '../showcase-services';
import type { DraftPatch } from '../use-showcase-draft';

/** The shortest sentence that reads as a presentation: the same number the advised check of the server uses. */
const MIN_TAGLINE = 12;

/**
 * What the wizard "Crea la tua vetrina" asks (SP-13e): the style, the sentence and the introduction, and the services to show (their
 * slugs). The draft is the **server's** (the same as the editor): the values start from it and each step saves its own part.
 */
export type WizardValues = {
  style: SiteStyleId;
  tagline: string;
  intro: string;
  services: string[];
};

/** The second step: a sentence of at least 12 characters (the server advises it) and an introduction within its limit. Messages are keys. */
export const presentationStepSchema = z.object({
  tagline: z
    .string()
    .trim()
    .min(MIN_TAGLINE, 'supplier.showcase.wizard.errors.tagline')
    .max(SHOWCASE_LIMITS.tagline, 'supplier.showcase.wizard.errors.tooLong'),
  intro: z.string().max(SHOWCASE_LIMITS.intro, 'supplier.showcase.wizard.errors.tooLong'),
});

/** The third step: at least one service, the page cannot show none. */
export const servicesStepSchema = z.object({
  services: z.array(z.string()).min(1, 'supplier.showcase.wizard.errors.services'),
});

export interface WizardStart {
  values: WizardValues;
  /** The sentence or the introduction come from the starting text of the trade, not from the supplier: the step says so. */
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

/** What the first step saves: the style, only when it differs from the one the page already shows (the recommended one is not frozen). */
export function stylePatch(values: WizardValues, draft: ShowcaseDocument, categories: readonly string[]): DraftPatch | null {
  return values.style === resolveSiteStyle(draft.style, categories) ? null : { style: values.style };
}

/** What the second step saves: the sentence and the introduction, only the members that changed. */
export function presentationPatch(values: WizardValues, draft: ShowcaseDocument): DraftPatch | null {
  const patch: DraftPatch = {};
  const tagline = values.tagline.trim();
  const intro = values.intro.trim();
  if (tagline !== (draft.tagline ?? '').trim()) patch.tagline = tagline;
  if (intro !== (draft.intro ?? '').trim()) patch.intro = intro === '' ? null : intro;
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * What the third step saves: the order of the services to show. The ones already shown keep their order, the newly chosen ones come
 * after them; with every active service chosen in the order of the catalog nothing is sent (the page follows the catalog).
 */
export function servicesPatch(values: WizardValues, draft: ShowcaseDocument, services: readonly SupplierService[]): DraftPatch | null {
  const plan = planServices(services, draft.serviceOrder);
  const chosen = new Set(values.services);
  const ordered = [...plan.shown, ...plan.hidden].filter((service) => chosen.has(service.slug));
  const next = serviceOrderOf(services, ordered);
  const current = (draft.serviceOrder ?? []).length > 0 ? (draft.serviceOrder ?? []) : null;
  return JSON.stringify(next) === JSON.stringify(current) ? null : { serviceOrder: next };
}
