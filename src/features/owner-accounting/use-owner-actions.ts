import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useGenerateVersion } from '@/queries/use-owner-accounting';
import type { OwnerStatementVersion } from '@/types';
import { messageOf, type ActionContext, type ActionKey } from './owner-accounting-model';

/**
 * What the person is doing with an owner's month: which dialog is open, and the one action that needs none (making a statement is a draft, nothing
 * is published or paid by it). Every action is the person's own click: nothing here runs when the page opens, and a new version is never made in
 * the background (E06/F05/US02/T04: no silent recalculation).
 */
export function useOwnerActions(ctx: ActionContext) {
  const { t } = useTranslation();
  const generateVersion = useGenerateVersion();
  const [asked, setAsked] = useState<ActionKey | null>(null);

  /** A new version from the ledger now; it throws when the server refuses, so a dialog can stay open and say why. */
  const generate = async (): Promise<OwnerStatementVersion> => {
    const version = await generateVersion.mutateAsync({ year: ctx.period.year, month: ctx.period.month, ownerId: ctx.ownerId });
    const text = version.status === 'Flagged' ? 'ownerAccounting.actions.generate.flagged' : 'ownerAccounting.actions.generate.success';
    (version.status === 'Flagged' ? toast.warning : toast.success)(t(text, { owner: ctx.ownerName, version: version.version }));
    return version;
  };

  /** The version in force is approved or published: a new one supersedes it, which is said and confirmed first. */
  const replacing = ctx.version?.status === 'Approved' || ctx.version?.status === 'Published';

  const ask = (action: ActionKey) => {
    if (action === 'prepare' || (action === 'regenerate' && !replacing)) {
      void generate().catch((error: unknown) => toast.error(messageOf(error, t)));
      return;
    }
    setAsked(action);
  };

  return { asked, ask, dismiss: () => setAsked(null), generate, generating: generateVersion.isPending };
}
