import { useId, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { normalizePortalState, ownerReasonKey } from '@/lib/owner-onboarding';
import { formatRomeDateTime } from '@/lib/stay-dates';
import {
  useConfirmOwnerInvitations,
  useOwnerInvitations,
  usePreviewOwnerInvitations,
  useResendOwnerInvitation,
  useRevokeOwnerInvitation,
} from '@/queries/use-owner-onboarding';
import type {
  OwnerInvitationBatchResult,
  OwnerInvitationPreview,
  OwnerInvitationStatus,
  OwnerPortalState,
  OwnerReadinessReport,
} from '@/types/owner-onboarding.types';
import { PortalStateMark, ReasonLine } from './owner-readiness-table';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/** The states a new batch can invite: an owner that is ready, or whose last invitation lapsed or was withdrawn. An invited or accepted one is never invited again by the batch. */
const INVITABLE: ReadonlySet<OwnerPortalState> = new Set<OwnerPortalState>(['ready', 'expired', 'revoked']);

/** The states in the order the lifecycle is told, with the counts shown above the list. */
const LIFECYCLE: readonly OwnerPortalState[] = ['ready', 'invited', 'accepted', 'expired', 'revoked'];

/** The reasons an owner is left out of a batch that are not facts of the readiness. */
const EXCLUSION_CODES: ReadonlySet<string> = new Set(['already_invited', 'already_accepted', 'owner_not_found']);

const camel = (code: string) => code.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** What was asked of one owner's invitation: a new link (the one in force withdrawn) or only the withdrawal. They are different acts, and each asks its own confirmation. */
interface Pending {
  kind: 'resend' | 'revoke';
  invitation: OwnerInvitationStatus;
}

/** What the page says about the last thing done, so that a state that is not complete never reads as a success. */
interface Outcome {
  tone: 'success' | 'warning';
  text: string;
}

/** The previewed batch: the owners it was asked for (the confirmation judges the same selection again) and what the server said. Never the link, never a token. */
interface Previewed {
  ownerIds: string[];
  preview: OwnerInvitationPreview;
}

function ExclusionLine({ code }: { code: string }) {
  const { t } = useTranslation();
  const readiness = ownerReasonKey(code);
  const text = readiness ? t(readiness) : EXCLUSION_CODES.has(code) ? t(`ownerOnboarding.invitations.exclusions.${camel(code)}`) : t('ownerOnboarding.reasons.unknown');
  return <span className="break-words">{text}</span>;
}

interface OwnerInvitationPanelProps {
  /** The readiness the page already read: the reasons an owner is not ready for the portal are its own. */
  report: OwnerReadinessReport;
}

/**
 * The invitations of the owners to the portal (E10/F03/US05/T01, NF-109, AC-NF109-4): the state of every owner (ready, invited, accepted, expired, revoked), a preview
 * of who would be invited and who is left out and why, and a confirmation that says the exact effect (to whom, for which properties, with which permissions). Nothing
 * is sent by importing, by selecting or by asking for the preview: the one act that sends is the confirmation, which carries the fingerprint of the preview. The new
 * link and the withdrawal of an invitation are two different acts, each with its own confirmation. Every button of the card is off while any request of the card is in
 * flight. The panel never shows or keeps a link or a token (the server answers none), and the addresses of the preview live only as long as its dialog.
 */
export function OwnerInvitationPanel({ report }: OwnerInvitationPanelProps) {
  const { t, i18n } = useTranslation();
  const listId = useId();
  const invitations = useOwnerInvitations(true);
  const preview = usePreviewOwnerInvitations();
  const confirm = useConfirmOwnerInvitations();
  const resend = useResendOwnerInvitation();
  const revoke = useRevokeOwnerInvitation();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [previewed, setPreviewed] = useState<Previewed | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const busy = preview.isPending || confirm.isPending || resend.isPending || revoke.isPending;
  // An error of a read, a 404 first: «not found» is never what an older answer held, and an error is never «nothing to invite».
  const notFound = invitations.isError && getHttpStatus(invitations.error) === 404;
  const list = useMemo(() => (invitations.isError ? [] : (invitations.data ?? [])), [invitations.data, invitations.isError]);

  const reasonsOf = useMemo(() => {
    const byOwner = new Map(report.owners.map((owner) => [owner.ownerId, owner.reasons.filter((reason) => reason.dimension === 'portal')] as const));
    return (ownerId: string) => byOwner.get(ownerId) ?? [];
  }, [report.owners]);

  const counts = useMemo(() => {
    const result = new Map<OwnerPortalState, number>();
    for (const owner of list) {
      const state = normalizePortalState(owner.state);
      result.set(state, (result.get(state) ?? 0) + 1);
    }
    return result;
  }, [list]);

  // Only the owners that can be invited, and still can: a selection never outlives the state that made it possible.
  const selectedIds = list.filter((owner) => selected.has(owner.ownerId) && INVITABLE.has(normalizePortalState(owner.state))).map((owner) => owner.ownerId);
  const nameOf = (ownerId: string) => list.find((owner) => owner.ownerId === ownerId)?.displayName ?? t('ownerOnboarding.invitations.anOwner');

  function toggle(ownerId: string, checked: boolean) {
    setOutcome(null);
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(ownerId);
      else next.delete(ownerId);
      return next;
    });
  }

  function askPreview() {
    if (selectedIds.length === 0 || busy) return;
    setOutcome(null);
    const ownerIds = [...selectedIds];
    preview.mutate(ownerIds, { onSuccess: (answer) => setPreviewed({ ownerIds, preview: answer }) });
  }

  function closePreview(open: boolean) {
    if (open || confirm.isPending) return;
    setPreviewed(null);
    confirm.reset();
    preview.reset();
  }

  async function sendBatch() {
    if (!previewed || previewed.preview.recipients.length === 0) return;
    const result: OwnerInvitationBatchResult = await confirm.mutateAsync({ ownerIds: previewed.ownerIds, fingerprint: previewed.preview.fingerprint });
    setSelected(new Set());
    setPreviewed(null);
    preview.reset();
    if (result.failed.length > 0) {
      setOutcome({
        tone: 'warning',
        text: t('ownerOnboarding.invitations.sentSome', {
          sent: result.sent,
          failed: result.failed.length,
          owners: result.failed.map((failure) => nameOf(failure.ownerId)).join(', '),
        }),
      });
    } else if (result.sent === 0) {
      setOutcome({ tone: 'warning', text: t('ownerOnboarding.invitations.sentNone') });
    } else {
      setOutcome({ tone: 'success', text: t('ownerOnboarding.invitations.sent', { count: result.sent }) });
    }
  }

  async function runPending() {
    if (!pending) return;
    const { kind, invitation } = pending;
    if (kind === 'resend') await resend.mutateAsync(invitation.invitationId ?? '');
    else await revoke.mutateAsync(invitation.invitationId ?? '');
    setOutcome({ tone: 'success', text: t(kind === 'resend' ? 'ownerOnboarding.invitations.resent' : 'ownerOnboarding.invitations.revoked', { name: invitation.displayName }) });
    setPending(null);
  }

  const pendingError = pending ? (pending.kind === 'resend' ? resend.error : revoke.error) : null;

  let body: ReactNode;
  if (notFound) {
    body = (
      <Alert variant="info" data-testid="owner-invitations-not-found">
        {t('ownerOnboarding.notFound')}
      </Alert>
    );
  } else if (invitations.isLoading) {
    body = (
      <div role="status" aria-busy="true" className="space-y-2" data-testid="owner-invitations-loading">
        <span className="sr-only">{t('ownerOnboarding.loading')}</span>
        <Skeleton className="h-12 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
        <Skeleton className="h-12 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  } else if (invitations.isError) {
    // A failed read is told as such, with a way to ask again: never an empty list that reads as «nobody to invite».
    body = (
      <Alert
        variant="danger"
        role="alert"
        data-testid="owner-invitations-error"
        action={
          <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void invitations.refetch()}>
            {t('shared.errorState.retry')}
          </Button>
        }
      >
        {getProblemMessage(invitations.error, t) ?? t('ownerOnboarding.invitations.loadError')}
      </Alert>
    );
  } else if (list.length === 0) {
    body = (
      <p className="text-sm text-foreground/70" data-testid="owner-invitations-empty">
        {t('ownerOnboarding.invitations.empty')}
      </p>
    );
  } else {
    body = (
      <>
        <ul role="list" className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={t('ownerOnboarding.invitations.countsLabel')} data-testid="owner-invitations-counts">
          {LIFECYCLE.map((state) => (
            <li key={state} data-state={state}>
              {t(`ownerOnboarding.portalStates.${state}`)}: <span className="font-semibold">{counts.get(state) ?? 0}</span>
            </li>
          ))}
        </ul>

        <ul role="list" className="divide-y rounded-lg border" data-testid="owner-invitations-list" aria-describedby={listId}>
          {list.map((owner) => {
            const state = normalizePortalState(owner.state);
            const invitable = INVITABLE.has(state);
            const checkId = `${listId}-${owner.ownerId}`;
            const when =
              state === 'accepted' && owner.acceptedAt
                ? t('ownerOnboarding.invitations.acceptedOn', { date: formatRomeDateTime(owner.acceptedAt, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }) })
                : state === 'invited' && owner.expiresAt
                  ? t('ownerOnboarding.invitations.expiresOn', { date: formatRomeDateTime(owner.expiresAt, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }) })
                  : (state === 'expired' || state === 'revoked') && (owner.closedAt ?? owner.expiresAt)
                    ? t('ownerOnboarding.invitations.closedOn', { date: formatRomeDateTime((owner.closedAt ?? owner.expiresAt) as string, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }) })
                    : null;
            const reasons = state === 'notReady' ? reasonsOf(owner.ownerId) : [];
            const canAct = owner.invitationId !== null;
            return (
              <li key={owner.ownerId} className="flex min-w-0 flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between" data-testid="owner-invitation-row" data-state={state}>
                <div className="flex min-w-0 items-start gap-3">
                  {invitable ? (
                    <Checkbox
                      id={checkId}
                      className="mt-1 size-5"
                      checked={selected.has(owner.ownerId)}
                      disabled={busy}
                      onCheckedChange={(checked) => toggle(owner.ownerId, checked === true)}
                      aria-label={t('ownerOnboarding.invitations.select', { name: owner.displayName })}
                      data-testid="owner-invitation-select"
                    />
                  ) : null}
                  <div className="min-w-0 space-y-1">
                    <p className="break-words text-sm font-semibold">{owner.displayName}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <PortalStateMark state={state} testId="owner-invitation-state" />
                      {when ? <span className="text-sm text-foreground/70">{when}</span> : null}
                    </div>
                    {reasons.length > 0 ? (
                      <ul role="list" className="list-disc space-y-0.5 pl-5 text-sm" data-testid="owner-invitation-reasons">
                        {reasons.map((reason, index) => (
                          <li key={`${reason.code}-${index}`}>
                            <ReasonLine reason={reason} />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
                {canAct && (state === 'invited' || state === 'expired') ? (
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className={TOUCH_TARGET}
                      disabled={busy}
                      aria-label={t('ownerOnboarding.invitations.resendFor', { name: owner.displayName })}
                      onClick={() => setPending({ kind: 'resend', invitation: owner })}
                      data-testid="owner-invitation-resend"
                    >
                      {t('ownerOnboarding.invitations.resend')}
                    </Button>
                    {state === 'invited' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className={TOUCH_TARGET}
                        disabled={busy}
                        aria-label={t('ownerOnboarding.invitations.revokeFor', { name: owner.displayName })}
                        onClick={() => setPending({ kind: 'revoke', invitation: owner })}
                        data-testid="owner-invitation-revoke"
                      >
                        {t('ownerOnboarding.invitations.revoke')}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p id={listId} className="text-sm text-foreground/70">
          {t('ownerOnboarding.invitations.listHint')}
        </p>
      </>
    );
  }

  const previewError = preview.isError ? (getProblemMessage(preview.error, t) ?? t('ownerOnboarding.invitations.previewError')) : null;
  const effect = previewed
    ? [
        t('ownerOnboarding.invitations.confirm.to', { count: previewed.preview.recipients.length }),
        t('ownerOnboarding.invitations.confirm.scope', { properties: report.summary.properties }),
        t('ownerOnboarding.invitations.confirm.permissions'),
        t('ownerOnboarding.invitations.confirm.link'),
      ]
    : [];

  return (
    <div className="min-w-0 space-y-4" data-testid="owner-invitation-panel">
      <Alert variant="info" data-testid="owner-invitations-sends-nothing">
        {t('ownerOnboarding.invitations.sendsNothing')}
      </Alert>

      {body}

      {outcome ? (
        <Alert variant={outcome.tone} data-testid="owner-invitations-outcome" role="status">
          {outcome.text}
        </Alert>
      ) : null}
      {previewError ? (
        <Alert variant="danger" role="alert" data-testid="owner-invitations-preview-error">
          {previewError}
        </Alert>
      ) : null}

      {!notFound && !invitations.isError && list.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" className={TOUCH_TARGET} disabled={selectedIds.length === 0 || busy} loading={preview.isPending} onClick={askPreview} data-testid="owner-invitations-preview">
            {t('ownerOnboarding.invitations.preview', { count: selectedIds.length })}
          </Button>
          {selectedIds.length === 0 ? <p className="text-sm text-foreground/70">{t('ownerOnboarding.invitations.selectFirst')}</p> : null}
        </div>
      ) : null}

      <ConfirmationDialog
        open={previewed !== null}
        onOpenChange={closePreview}
        title={t('ownerOnboarding.invitations.confirm.title', { count: previewed?.preview.recipients.length ?? 0 })}
        description={t('ownerOnboarding.invitations.confirm.description')}
        consequences={effect}
        confirmLabel={t('ownerOnboarding.invitations.confirm.action', { count: previewed?.preview.recipients.length ?? 0 })}
        cancelLabel={t('ownerOnboarding.invitations.confirm.cancel')}
        confirmDisabled={(previewed?.preview.recipients.length ?? 0) === 0 || (previewed?.preview.quota.remaining ?? 0) < (previewed?.preview.recipients.length ?? 0)}
        isLoading={confirm.isPending}
        onConfirm={sendBatch}
      >
        {previewed ? (
          <div className="min-w-0 space-y-3 text-sm" data-testid="owner-invitation-preview">
            <div>
              <p className="font-semibold">{t('ownerOnboarding.invitations.confirm.recipients')}</p>
              {previewed.preview.recipients.length === 0 ? (
                <p className="text-foreground/70" data-testid="owner-invitation-no-recipients">
                  {t('ownerOnboarding.invitations.confirm.noRecipients')}
                </p>
              ) : (
                <ul role="list" className="list-disc space-y-1 pl-5" data-testid="owner-invitation-recipients">
                  {previewed.preview.recipients.map((recipient) => (
                    <li key={recipient.ownerId} className="break-words">
                      {recipient.displayName} - {recipient.email}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {previewed.preview.exclusions.length > 0 ? (
              <div>
                <p className="font-semibold">{t('ownerOnboarding.invitations.confirm.exclusions')}</p>
                <ul role="list" className="list-disc space-y-1 pl-5" data-testid="owner-invitation-exclusions">
                  {previewed.preview.exclusions.map((exclusion) => (
                    <li key={exclusion.ownerId} className="break-words">
                      {exclusion.displayName ?? t('ownerOnboarding.invitations.anOwner')}:{' '}
                      {exclusion.reasons.map((code, index) => (
                        <span key={`${code}-${index}`}>
                          {index > 0 ? '; ' : ''}
                          <ExclusionLine code={code} />
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-foreground/70" data-testid="owner-invitation-quota">
              {t('ownerOnboarding.invitations.confirm.quota', { remaining: previewed.preview.quota.remaining, limit: previewed.preview.quota.limit })}
            </p>
            {previewed.preview.quota.remaining < previewed.preview.recipients.length ? (
              <Alert variant="warning" data-testid="owner-invitation-over-quota">
                {t('ownerOnboarding.invitations.confirm.overQuota')}
              </Alert>
            ) : null}
            {confirm.isError ? (
              <Alert variant="danger" role="alert" data-testid="owner-invitation-confirm-error">
                {getHttpStatus(confirm.error) === 409
                  ? t('ownerOnboarding.invitations.confirm.stale')
                  : (getProblemMessage(confirm.error, t) ?? t('ownerOnboarding.invitations.confirm.error'))}
              </Alert>
            ) : null}
          </div>
        ) : null}
      </ConfirmationDialog>

      <ConfirmationDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (open || resend.isPending || revoke.isPending) return;
          setPending(null);
          resend.reset();
          revoke.reset();
        }}
        title={pending ? t(`ownerOnboarding.invitations.${pending.kind}Confirm.title`, { name: pending.invitation.displayName }) : ''}
        description={pending ? t(`ownerOnboarding.invitations.${pending.kind}Confirm.description`) : ''}
        consequences={pending ? [t(`ownerOnboarding.invitations.${pending.kind}Confirm.effect`)] : []}
        confirmLabel={pending ? t(`ownerOnboarding.invitations.${pending.kind}Confirm.action`) : undefined}
        cancelLabel={t('ownerOnboarding.invitations.confirm.cancel')}
        variant={pending?.kind === 'revoke' ? 'destructive' : 'default'}
        isLoading={resend.isPending || revoke.isPending}
        onConfirm={runPending}
      >
        {pendingError ? (
          <Alert variant="danger" role="alert" data-testid="owner-invitation-pending-error">
            {getProblemMessage(pendingError, t) ?? t('ownerOnboarding.invitations.actionError')}
          </Alert>
        ) : null}
      </ConfirmationDialog>
    </div>
  );
}
