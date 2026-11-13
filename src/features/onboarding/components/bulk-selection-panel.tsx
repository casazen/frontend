import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, CheckCircle2, CircleDashed, CircleHelp, Equal, type LucideIcon } from 'lucide-react';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { getProblemMessage } from '@/lib/api-errors';
import { flowNameKey, flowStateKey } from '@/lib/onboarding-flows';
import { BULK_PAGE_SIZE, bulkReasonKey, buildSelection, EMPTY_FILTER, pageOf, type FilterDraft } from '@/lib/onboarding-bulk';
import type { StatusTone } from '@/lib/status-dictionary';
import { useBulkApply, useBulkPreview } from '@/queries/use-onboarding-bulk';
import {
  ONBOARDING_FLOW_KEYS,
  ONBOARDING_FLOW_STATES,
  type BulkApplyItem,
  type BulkApplyResult,
  type BulkChoice,
  type BulkPreview,
} from '@/types/onboarding.types';
import type { ComplianceSenderType } from '@/types/checkin-wizard.types';
import { ClientPager } from './client-pager';
import { StatePill } from './state-pill';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

const SENDERS: readonly ComplianceSenderType[] = ['ChannelManager', 'CasaZen', 'Manual'];

/** The two ways to say which properties: all of them (asked for by name), or a filter. */
const SCOPES = ['all', 'filter'] as const;

/** How each outcome of an apply looks: a tone, an icon and its words, so that it is never told by color alone (UX-09). */
const OUTCOME_VIEW: Record<string, { tone: StatusTone; Icon: LucideIcon; key: string }> = {
  applied: { tone: 'success', Icon: CheckCircle2, key: 'applied' },
  unchanged: { tone: 'neutral', Icon: Equal, key: 'unchanged' },
  refused: { tone: 'danger', Icon: Ban, key: 'refused' },
  wouldChange: { tone: 'info', Icon: CircleDashed, key: 'wouldChange' },
};
/** An outcome this version does not know is never read as done: it is shown as not understood. */
const UNKNOWN_OUTCOME = { tone: 'warning', Icon: CircleHelp, key: 'unknown' } as const;

/** The stage the check and the apply have reached for the selection and the choice on screen: a stage of other values is dropped, never reused. */
type Stage =
  | { signature: string; kind: 'checked'; result: BulkApplyResult }
  | { signature: string; kind: 'applied'; result: BulkApplyResult }
  | { signature: string; kind: 'uncertain' };

/** A count the server sent as a number; anything else is 0. */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** The properties of an apply or a check, one by one, a page at a time: the name, the outcome and, for a refusal, the reason in plain words. */
function ItemsTable({ items, testId }: { items: readonly BulkApplyItem[]; testId: string }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const shown = pageOf(items, page);

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <caption className="sr-only">{t('onboardingPlan.bulk.selection.itemsCaption')}</caption>
          <thead>
            <tr className="border-b text-foreground/70">
              <th scope="col" className="py-2 pr-3 font-medium">
                {t('onboardingPlan.bulk.selection.property')}
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                {t('onboardingPlan.bulk.selection.outcome')}
              </th>
              <th scope="col" className="py-2 pl-2 font-medium">
                {t('onboardingPlan.bulk.selection.reason')}
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.rows.map((item) => {
              const view = OUTCOME_VIEW[item.outcome] ?? UNKNOWN_OUTCOME;
              return (
                <tr key={item.propertyId} className="border-b align-top last:border-b-0" data-testid={`bulk-item-${item.propertyId}`} data-outcome={item.outcome}>
                  <td className="min-w-0 py-2 pr-3">
                    {item.name ? (
                      <>
                        <span className="break-words font-medium">{item.name}</span>
                        {item.city ? <span className="block break-words text-foreground/70">{item.city}</span> : null}
                      </>
                    ) : (
                      <span className="text-foreground/70">{t('onboardingPlan.bulk.selection.notFound')}</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <StatePill tone={view.tone} icon={view.Icon} label={t(`onboardingPlan.bulk.outcomes.${view.key}`)} />
                  </td>
                  <td className="min-w-0 break-words py-2 pl-2" data-testid={`bulk-item-${item.propertyId}-reason`}>
                    {item.outcome === 'refused' ? t(bulkReasonKey(item.reason)) : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ClientPager page={shown.page} pages={shown.pages} total={items.length} onPage={setPage} testId={`${testId}-pager`} />
    </div>
  );
}

/**
 * Applies one choice to many properties at once (E10/F03/US03/T02, NF-105, UX-05): who sends the Alloggiati communications, for all the properties or for a
 * selection. The rules of a page where one press touches hundreds of properties:
 *
 * - nothing is chosen at the start (no scope, no sender): an empty selection is never «all», and the actions stay off until the person has chosen a scope that
 *   can be sent (a filter needs at least one criterion) AND a sender;
 * - «Vedi la selezione» shows the total and a sample of 20; «Controlla l'effetto» is a check that writes nothing and says, property by property, who would change, who
 *   already has it and who is refused, with the reason in plain words;
 * - «Applica a N strutture» opens a confirmation that says exactly what will happen (which setting, to what, to how many and which properties) and is on only after
 *   a check of THIS selection and THIS choice: change either and the check is gone, and it is asked again;
 * - the result lists every property one by one (a page of 50 at a time) and is never told as a success when something was refused or nothing changed; a call that
 *   failed says that some properties may have changed and asks to check again, it never offers the same press twice;
 * - every button of the card is off while any request of the card is on its way, and the confirmed call is sent once (a second press does nothing).
 *
 * The server decides everything (the sender switch of each property, the reach of the caller): the page collects the choice and shows what would happen and
 * what happened.
 */
export function BulkSelectionPanel() {
  const { t } = useTranslation();
  const ids = useId();
  const preview = useBulkPreview();
  const apply = useBulkApply();
  const inFlight = useRef(false);
  const [scope, setScope] = useState<'all' | 'filter' | null>(null);
  const [draft, setDraft] = useState<FilterDraft>(EMPTY_FILTER);
  const [sender, setSender] = useState<ComplianceSenderType | null>(null);
  const [previewed, setPreviewed] = useState<{ signature: string; result: BulkPreview } | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [confirming, setConfirming] = useState(false);

  const { selection, problem } = buildSelection(scope, draft);
  const choice: BulkChoice | null = sender ? { complianceSender: sender } : null;
  const selectionSignature = selection ? JSON.stringify(selection) : null;
  const signature = selection && choice ? JSON.stringify({ selection, choice }) : null;

  // What was previewed, checked or applied counts only for the selection and the choice on screen now.
  const currentPreview = previewed && previewed.signature === selectionSignature ? previewed.result : null;
  const current = stage && stage.signature === signature ? stage : null;
  const check = current?.kind === 'checked' ? current.result : null;
  const toChange = check ? count(check.summary?.wouldChange) : 0;
  const checking = apply.isPending && !confirming;
  const applying = apply.isPending && confirming;
  const busy = preview.isPending || apply.isPending;
  const tooLarge = currentPreview?.exceedsLimit === true;

  function update(change: Partial<FilterDraft>) {
    setDraft((previous) => ({ ...previous, ...change }));
  }

  function seeSelection() {
    if (!selection || !selectionSignature) return;
    const asked = selectionSignature;
    preview.mutate(selection, { onSuccess: (result) => setPreviewed({ signature: asked, result }) });
  }

  function checkEffect() {
    if (!selection || !choice || !signature) return;
    const asked = signature;
    apply.mutate(
      { selection, choice, confirmed: false },
      { onSuccess: (result) => setStage({ signature: asked, kind: 'checked', result }), onError: () => setStage(null) },
    );
  }

  async function applyNow() {
    // The confirmed call is sent once: a second press while it is on its way (or before the page has drawn that it is) does nothing.
    if (inFlight.current || !selection || !choice || !signature || !check) return;
    inFlight.current = true;
    const asked = signature;
    try {
      const result = await apply.mutateAsync({ selection, choice, confirmed: true });
      // An answer that says nothing was written is not an apply: it is told as not done, never as a success.
      setStage(result.dryRun ? { signature: asked, kind: 'uncertain' } : { signature: asked, kind: 'applied', result });
    } catch {
      // The call failed: some properties may have changed before it did. The check is gone, and the person is told to check again.
      setStage({ signature: asked, kind: 'uncertain' });
    } finally {
      inFlight.current = false;
      setConfirming(false);
    }
  }

  const senderLabel = (value: ComplianceSenderType) => t(`onboardingPlan.bulk.selection.senders.${value}`);
  // The sender is the one the person chose (the same selection and choice as the answer: the stage is dropped otherwise), never a word the answer might carry.
  const senderName = sender ? senderLabel(sender) : '';
  const checkItems = check && Array.isArray(check.items) ? check.items : [];
  const changing = checkItems.filter((item) => item.outcome === 'wouldChange');
  const applied = current?.kind === 'applied' ? current.result : null;
  const appliedItems = applied && Array.isArray(applied.items) ? applied.items : [];
  const appliedCount = applied ? count(applied.summary?.applied) : 0;
  const refusedCount = applied ? count(applied.summary?.refused) : 0;
  const appliedAll = appliedCount > 0 && refusedCount === 0;

  return (
    <section aria-labelledby={`${ids}-title`} className="min-w-0 space-y-5 rounded-lg border bg-card p-4" data-testid="bulk-selection">
      <div className="space-y-1">
        <h2 id={`${ids}-title`} className="text-lg font-semibold">
          {t('onboardingPlan.bulk.selection.title')}
        </h2>
        <p className="text-sm text-foreground/70">{t('onboardingPlan.bulk.selection.description')}</p>
      </div>

      <fieldset className="min-w-0 space-y-1" disabled={busy} data-testid="bulk-scope">
        <legend className="text-sm font-semibold">{t('onboardingPlan.bulk.selection.scope')}</legend>
        {SCOPES.map((value) => (
          <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name={`${ids}-scope`} className="size-5 shrink-0" checked={scope === value} onChange={() => setScope(value)} data-testid={`bulk-scope-${value}`} />
            {t(`onboardingPlan.bulk.selection.scopes.${value}`)}
          </label>
        ))}
      </fieldset>

      {scope === 'filter' ? (
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2" data-testid="bulk-filter">
          <div className="min-w-0 space-y-1">
            <Label htmlFor={`${ids}-comuni`}>{t('onboardingPlan.bulk.selection.filter.comuni')}</Label>
            <Input
              id={`${ids}-comuni`}
              value={draft.comuni}
              disabled={busy}
              aria-invalid={problem === 'comuni' || undefined}
              aria-describedby={problem === 'comuni' ? `${ids}-comuni-error` : undefined}
              onChange={(event) => update({ comuni: event.target.value })}
              data-testid="bulk-filter-comuni"
            />
            {problem === 'comuni' ? (
              <p id={`${ids}-comuni-error`} role="alert" className="text-sm text-danger-foreground">
                {t('onboardingPlan.bulk.selection.filter.comuniError')}
              </p>
            ) : null}
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor={`${ids}-regions`}>{t('onboardingPlan.bulk.selection.filter.regions')}</Label>
            <Input
              id={`${ids}-regions`}
              value={draft.regions}
              disabled={busy}
              aria-invalid={problem === 'regions' || undefined}
              aria-describedby={problem === 'regions' ? `${ids}-regions-error` : undefined}
              onChange={(event) => update({ regions: event.target.value })}
              data-testid="bulk-filter-regions"
            />
            {problem === 'regions' ? (
              <p id={`${ids}-regions-error`} role="alert" className="text-sm text-danger-foreground">
                {t('onboardingPlan.bulk.selection.filter.regionsError')}
              </p>
            ) : null}
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor={`${ids}-channels`}>{t('onboardingPlan.bulk.selection.filter.channels')}</Label>
            <Input
              id={`${ids}-channels`}
              value={draft.channels}
              disabled={busy}
              aria-invalid={problem === 'channels' || undefined}
              aria-describedby={problem === 'channels' ? `${ids}-channels-error` : undefined}
              onChange={(event) => update({ channels: event.target.value })}
              data-testid="bulk-filter-channels"
            />
            {problem === 'channels' ? (
              <p id={`${ids}-channels-error`} role="alert" className="text-sm text-danger-foreground">
                {t('onboardingPlan.bulk.selection.filter.channelsError')}
              </p>
            ) : null}
          </div>
          <div className="min-w-0 space-y-1">
            <span className="text-sm font-medium">{t('onboardingPlan.bulk.selection.filter.flowState')}</span>
            <div className="flex flex-wrap gap-2">
              <Select
                aria-label={t('onboardingPlan.bulk.selection.filter.flow')}
                value={draft.flow}
                disabled={busy}
                wrapperClassName="w-auto min-w-40 flex-1"
                onChange={(event) => update({ flow: event.target.value as FilterDraft['flow'] })}
                data-testid="bulk-filter-flow"
              >
                <option value="">{t('onboardingPlan.bulk.selection.filter.noFlow')}</option>
                {ONBOARDING_FLOW_KEYS.map((flow) => (
                  <option key={flow} value={flow}>
                    {t(flowNameKey(flow))}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={t('onboardingPlan.bulk.selection.filter.state')}
                value={draft.flowState}
                disabled={busy}
                wrapperClassName="w-auto min-w-40 flex-1"
                onChange={(event) => update({ flowState: event.target.value as FilterDraft['flowState'] })}
                data-testid="bulk-filter-state"
              >
                <option value="">{t('onboardingPlan.bulk.selection.filter.noState')}</option>
                {ONBOARDING_FLOW_STATES.map((state) => (
                  <option key={state} value={state}>
                    {t(flowStateKey(state))}
                  </option>
                ))}
              </Select>
            </div>
            {problem === 'flowState' ? (
              <p role="alert" className="text-sm text-danger-foreground">
                {t('onboardingPlan.bulk.selection.filter.flowStateError')}
              </p>
            ) : null}
          </div>
          {problem === 'none' ? (
            <p className="text-sm text-foreground/70 md:col-span-2" data-testid="bulk-filter-none">
              {t('onboardingPlan.bulk.selection.filter.none')}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className={TOUCH_TARGET}
          disabled={!selection || checking || applying}
          loading={preview.isPending}
          onClick={seeSelection}
          data-testid="bulk-preview"
        >
          {t('onboardingPlan.bulk.selection.preview')}
        </Button>
        {preview.isError ? (
          <p role="alert" className="text-sm text-danger-foreground" data-testid="bulk-preview-error">
            {getProblemMessage(preview.error, t) ?? t('onboardingPlan.bulk.selection.previewError')}
          </p>
        ) : null}
        {currentPreview ? (
          <div className="space-y-2 rounded-md bg-muted p-3 text-sm" aria-live="polite" data-testid="bulk-preview-result">
            <p className="font-medium" data-testid="bulk-preview-total">
              {t('onboardingPlan.bulk.selection.total', { count: count(currentPreview.total) })}
            </p>
            {tooLarge ? (
              <p role="alert" className="text-danger-foreground" data-testid="bulk-preview-too-large">
                {t('onboardingPlan.bulk.selection.tooLarge', { max: count(currentPreview.maxPropertiesPerCall) })}
              </p>
            ) : null}
            {count(currentPreview.notFound) > 0 ? <p>{t('onboardingPlan.bulk.selection.notFoundIds', { count: count(currentPreview.notFound) })}</p> : null}
            {Array.isArray(currentPreview.sample) && currentPreview.sample.length > 0 ? (
              <>
                <p className="text-foreground/70">{t('onboardingPlan.bulk.selection.sample', { count: currentPreview.sample.length })}</p>
                <ul role="list" className="list-disc space-y-0.5 pl-5" data-testid="bulk-preview-sample">
                  {currentPreview.sample.map((property) => (
                    <li key={property.propertyId} className="break-words">
                      {property.name}
                      {property.city ? ` · ${property.city}` : ''}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <fieldset className="min-w-0 space-y-1" disabled={busy} data-testid="bulk-choice">
        <legend className="text-sm font-semibold">{t('onboardingPlan.bulk.selection.choice')}</legend>
        {SENDERS.map((value) => (
          <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name={`${ids}-sender`} className="size-5 shrink-0" checked={sender === value} onChange={() => setSender(value)} data-testid={`bulk-sender-${value}`} />
            {senderLabel(value)}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className={TOUCH_TARGET}
          disabled={!signature || tooLarge || preview.isPending || applying}
          loading={checking}
          onClick={checkEffect}
          data-testid="bulk-check"
        >
          {t('onboardingPlan.bulk.selection.check')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={TOUCH_TARGET}
          disabled={!check || toChange === 0 || busy}
          onClick={() => setConfirming(true)}
          data-testid="bulk-apply"
        >
          {t('onboardingPlan.bulk.selection.apply', { count: toChange })}
        </Button>
      </div>
      {!signature ? (
        <p className="text-sm text-foreground/70" data-testid="bulk-nothing-chosen">
          {t('onboardingPlan.bulk.selection.nothingChosen')}
        </p>
      ) : null}

      {apply.isError && !confirming && stage?.kind !== 'uncertain' ? (
        <p role="alert" className="text-sm text-danger-foreground" data-testid="bulk-check-error">
          {getProblemMessage(apply.error, t) ?? t('onboardingPlan.bulk.selection.checkError')}
        </p>
      ) : null}

      {check ? (
        <div className="space-y-3" aria-live="polite" data-testid="bulk-check-result">
          <p className="font-medium">{t('onboardingPlan.bulk.selection.checkTitle', { sender: senderName })}</p>
          <ul role="list" className="space-y-0.5 text-sm" data-testid="bulk-check-summary">
            <li data-testid="bulk-check-would-change">{t('onboardingPlan.bulk.selection.summary.wouldChange', { count: toChange })}</li>
            <li data-testid="bulk-check-unchanged">{t('onboardingPlan.bulk.selection.summary.unchanged', { count: count(check.summary?.unchanged) })}</li>
            <li data-testid="bulk-check-refused">{t('onboardingPlan.bulk.selection.summary.refused', { count: count(check.summary?.refused) })}</li>
          </ul>
          {toChange === 0 ? <p className="text-sm text-foreground/70">{t('onboardingPlan.bulk.selection.nothingToApply')}</p> : null}
          <ItemsTable items={checkItems} testId="bulk-check-items" />
        </div>
      ) : null}

      {current?.kind === 'uncertain' ? (
        <p role="alert" className="rounded-md border border-danger-border bg-danger-soft p-3 text-sm text-danger-foreground" data-testid="bulk-uncertain">
          {t('onboardingPlan.bulk.selection.uncertain')}
        </p>
      ) : null}

      {applied ? (
        <div className="space-y-3" aria-live="polite" data-testid="bulk-applied">
          {/* Told as done only when something changed and nothing was refused: a part, or nothing, is told as such, and as a warning. */}
          <p
            className={appliedAll ? 'font-medium text-success-foreground' : 'font-medium text-warning-foreground'}
            role={appliedAll ? 'status' : 'alert'}
            data-testid="bulk-applied-summary"
            data-complete={appliedAll ? 'true' : 'false'}
          >
            {t(appliedAll ? 'onboardingPlan.bulk.selection.appliedAll' : appliedCount > 0 ? 'onboardingPlan.bulk.selection.appliedPartly' : 'onboardingPlan.bulk.selection.appliedNone', { sender: senderName })}
          </p>
          <ul role="list" className="space-y-0.5 text-sm" data-testid="bulk-applied-counts">
            <li data-testid="bulk-applied-applied">{t('onboardingPlan.bulk.selection.summary.applied', { count: appliedCount })}</li>
            <li data-testid="bulk-applied-unchanged">{t('onboardingPlan.bulk.selection.summary.unchanged', { count: count(applied.summary?.unchanged) })}</li>
            <li data-testid="bulk-applied-refused">{t('onboardingPlan.bulk.selection.summary.refused', { count: refusedCount })}</li>
          </ul>
          <ItemsTable items={appliedItems} testId="bulk-applied-items" />
        </div>
      ) : null}

      <ConfirmationDialog
        open={confirming}
        onOpenChange={(open) => {
          // A press on «Annulla», on the outside or a focus that leaves the dialog while the call is on its way does not drop it (the ref, not the state: the
          // handler may be the one of the render before the call started): the dialog closes when the answer is in.
          if (!inFlight.current) setConfirming(open);
        }}
        title={t('onboardingPlan.bulk.selection.confirmTitle', { count: toChange })}
        description={t('onboardingPlan.bulk.selection.confirmDescription', { sender: senderName })}
        confirmLabel={t('onboardingPlan.bulk.selection.confirmAction', { count: toChange })}
        isLoading={apply.isPending}
        onConfirm={applyNow}
        consequences={[
          t('onboardingPlan.bulk.selection.confirmChange', { count: toChange }),
          t('onboardingPlan.bulk.selection.confirmUnchanged', { count: count(check?.summary?.unchanged) }),
          t('onboardingPlan.bulk.selection.confirmRefused', { count: count(check?.summary?.refused) }),
        ]}
      >
        <div className="space-y-1" data-testid="bulk-confirm-properties">
          <p className="text-sm font-medium">{t('onboardingPlan.bulk.selection.confirmWhich')}</p>
          <ul role="list" className="max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-sm">
            {changing.slice(0, BULK_PAGE_SIZE).map((item) => (
              <li key={item.propertyId} className="break-words">
                {item.name}
                {item.city ? ` · ${item.city}` : ''}
              </li>
            ))}
          </ul>
          {changing.length > BULK_PAGE_SIZE ? <p className="text-sm text-foreground/70">{t('onboardingPlan.bulk.selection.confirmMore', { count: changing.length - BULK_PAGE_SIZE })}</p> : null}
        </div>
      </ConfirmationDialog>
    </section>
  );
}
