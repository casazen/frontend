import { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { isFeatureEnabled } from '@/config/feature-flags';
import { getManifestEntry, hasEntryPermission, isEntryFeatureEnabled } from '@/config/route-manifest';
import { defaultPeriod, periodParam, shiftPeriod } from '@/features/owner-accounting/owner-accounting-model';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import { useCreateSelfBillingDrafts, useSelfBilling, useSelfBillingBusy } from '@/queries/use-self-billing';
import type { SelfBillingGeneration, SelfBillingListItem } from '@/types';
import { SELF_BILLING_PATH, isClosedNotDue } from './self-billing-model';

const MONTHS_OFFERED = 24;

/**
 * The state of the page «Autofatture (TD17)», moved out of it as it was (same hooks, same order): the month on view, what is open (the drawer and the two confirmations), the report of the last run, the list, the
 * writes of the page and who may use its actions. The translation function is the one of the page, so that no hook is added.
 */
export function useSelfBillingState(t: TFunction) {
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const [today] = useState(() => todayInRome());
  const thisMonth = useMemo(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }), [today]);
  const [period, setPeriod] = useState(() => periodParam(defaultPeriod(today)));
  const [openId, setOpenId] = useState<string | null>(null);
  // The rejected TD17 whose «Correggi e rimanda» is being confirmed: kept whole (not looked up in the list), so that a refusal told in the dialog stays there while the list is read again behind it.
  const [correcting, setCorrecting] = useState<SelfBillingListItem | null>(null);
  const [closing, setClosing] = useState<SelfBillingListItem | null>(null);
  const [generation, setGeneration] = useState<SelfBillingGeneration | null>(null);
  const list = useSelfBilling(period === '' ? undefined : period);
  const closedIds = useMemo(() => new Set((list.data ?? []).filter(isClosedNotDue).map((item) => item.id)), [list.data]);
  const drafts = useCreateSelfBillingDrafts();
  const busy = useSelfBillingBusy();
  const months = useMemo(() => Array.from({ length: MONTHS_OFFERED }, (_, index) => periodParam(shiftPeriod(thisMonth, -index))), [thisMonth]);
  const monthOptions = period !== '' && !months.includes(period) ? [period, ...months] : months;
  // Who may use the actions of the page is who its entry in the menu lets in (the role of the organization's administrators, with the flag of the issuance), as the backend asks `agency.invoice.manage` for the whole
  // organization. «Correggi e rimanda» asks the flag of the sending to the SDI too, as the endpoint does: with it off, or without the role, the action is not drawn and nothing is asked.
  const entry = getManifestEntry(SELF_BILLING_PATH);
  const mayManage = entry !== undefined && isEntryFeatureEnabled(entry, flags) && hasEntryPermission(entry, hasPermission);
  const mayCorrect = mayManage && isFeatureEnabled(flags, 'sdiSubmission');
  const mayClose = mayCorrect;

  const prepare = (target: string) => {
    if (target === '') return;
    setGeneration(null);
    drafts.mutate(
      { period: target },
      {
        onSuccess: (result) => setGeneration(result),
        onError: (error) => toast.error(getProblemMessage(error, t) ?? t('selfBilling.drafts.failed')),
      },
    );
  };

  const redoDrafts = (year: number, monthOfDraft: number) => {
    const target = periodParam({ year, month: monthOfDraft });
    setPeriod(target);
    setOpenId(null);
    prepare(target);
  };

  return {
    thisMonth,
    period,
    setPeriod,
    openId,
    setOpenId,
    correcting,
    setCorrecting,
    closing,
    setClosing,
    generation,
    list,
    closedIds,
    drafts,
    busy,
    monthOptions,
    mayCorrect,
    mayClose,
    prepare,
    redoDrafts,
  };
}
