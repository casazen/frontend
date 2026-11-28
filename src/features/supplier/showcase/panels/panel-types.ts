import type { ShowcaseDocument } from '@/types/supplier-showcase';
import type { DraftPatch, InvalidDraft } from '../use-showcase-draft';

export interface PanelProps {
  doc: ShowcaseDocument;
  change: (patch: DraftPatch) => void;
  invalid: InvalidDraft;
}

export function isRefused(invalid: InvalidDraft, path: string): boolean {
  return invalid.fields.some((field) => field === path || field.startsWith(`${path}.`) || field.startsWith(`${path}[`));
}
