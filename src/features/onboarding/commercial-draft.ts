import { z } from 'zod';
import { clearWizardDraft, readWizardDraft, writeWizardDraft, type WizardDraftScope } from '@/lib/wizard-draft';
import type { CommercialSelection } from './commercial-model';

const DRAFT_ID = 'commercial-signup';
const selectionSchema = z.object({
  profile: z.enum(['agency', 'owner']),
  rentalArea: z.enum(['ShortTerm', 'LongTerm', 'Both']),
  planTier: z.enum(['Starter', 'Pro', 'Scale', 'Agency']),
  rooms: z.literal(1),
  agencyName: z.string().max(200).optional(),
  addons: z.array(z.string().max(100)).max(100),
}).refine(selection => (selection.profile === 'agency') === (selection.planTier === 'Agency'));

const draftSchema = z.object({
  step: z.enum(['profile', 'features', 'summary']),
  values: z.object({ selection: selectionSchema, roomEstimate: z.string().max(24) }),
});

export function readCommercialDraft(scope: WizardDraftScope) {
  const stored = readWizardDraft(DRAFT_ID, scope);
  if (!stored) return null;
  const parsed = draftSchema.safeParse(stored);
  if (parsed.success) return parsed.data;
  clearCommercialDraft(scope);
  return null;
}

export function saveCommercialDraft(scope: WizardDraftScope, step: 'profile' | 'features' | 'summary', selection: CommercialSelection, roomEstimate: string) {
  return writeWizardDraft(DRAFT_ID, scope, { step, values: { selection, roomEstimate } }) !== null;
}

export function clearCommercialDraft(scope: WizardDraftScope) {
  clearWizardDraft(DRAFT_ID, scope);
}
