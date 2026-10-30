import type { ShowcaseDocument } from '@/types/supplier-showcase';
import type { DraftPatch, InvalidDraft } from '../use-showcase-draft';

/** What every panel of the editor gets: the draft as it is, the way to change it, and what the server refused. */
export interface PanelProps {
  doc: ShowcaseDocument;
  change: (patch: DraftPatch) => void;
  invalid: InvalidDraft;
}

/** True when the server refused this path, or something inside it (`faq` covers `faq[2].a`). */
export function isRefused(invalid: InvalidDraft, path: string): boolean {
  return invalid.fields.some((field) => field === path || field.startsWith(`${path}.`) || field.startsWith(`${path}[`));
}
