import { useId, useState, type FormEvent } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { SkeletonLine } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { isFeatureEnabled } from '@/config/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { cn } from '@/lib/utils';
import { useProperties } from '@/queries/use-properties';
import {
  IDENTITY_SEGMENT_MODES,
  IDENTITY_SEGMENT_REASON_MAX_LENGTH,
  type IdentitySegment,
  type IdentitySegmentMode,
  type IdentitySegments,
} from '@/types/biometric-settings.types';
import { SEGMENT_CHANNEL_KEYS, segmentFormatLabel, segmentModeKey, segmentModeOf, segmentReasonKey, suspensionReasonOf } from '../lib/biometric-settings-model';
import { useBiometricCardBusy, useCreateIdentitySegment, useIdentitySegments, useSetIdentitySegmentMode } from '../use-biometric-settings';

/** The family of browser as the staff reads it; the code itself for one the page has no words for. */
function channelLabel(channel: string, t: TFunction): string {
  const key = SEGMENT_CHANNEL_KEYS[channel];
  return key ? t(key) : channel;
}

/** What a segment is called in a sentence: property (or all of them), document type and browser. */
function segmentName(segment: IdentitySegment, formats: IdentitySegments['formats'], t: TFunction): string {
  return [segment.propertyName ?? t('biometricSettings.segments.allProperties'), segmentFormatLabel(formats, segment.formatId), channelLabel(segment.channel, t)].join(' · ');
}

interface ModeChoiceProps {
  segment: IdentitySegment;
  name: string;
  busy: boolean;
  onChoose: (mode: IdentitySegmentMode) => void;
}

/**
 * The mode of one segment as a group of radio buttons: the one in force is checked, «Automatica» is there but cannot be chosen until the segment is qualified (and says why), and choosing another mode is
 * the request itself. Each choice is a 44 px target with a real radio under it, so the arrows and the space bar work as in any group of radios.
 */
function ModeChoice({ segment, name, busy, onChoose }: ModeChoiceProps) {
  const { t } = useTranslation();
  const hintId = useId();
  const current = segmentModeOf(segment.mode);

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">{t('biometricSettings.segments.mode.legend', { name })}</legend>
      <span aria-hidden="true" className="mb-1 block text-xs font-medium text-foreground/70">
        {t('biometricSettings.segments.modeLabel')}
      </span>
      <div className="flex flex-wrap gap-2">
        {IDENTITY_SEGMENT_MODES.map((mode) => {
          const unavailable = mode === 'automatic' && !segment.qualified;
          return (
            <label
              key={mode}
              className={cn(
                'relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted/40',
                'has-checked:bg-primary/5 has-checked:ring-2 has-checked:ring-primary',
                'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                'has-disabled:cursor-not-allowed has-disabled:opacity-60 has-disabled:hover:bg-background',
              )}
            >
              <input
                type="radio"
                name={`identity-segment-mode-${segment.id}`}
                value={mode}
                checked={current === mode}
                disabled={busy || unavailable}
                aria-describedby={unavailable ? hintId : undefined}
                onChange={() => onChoose(mode)}
                className="size-4 accent-primary"
              />
              {t(segmentModeKey(mode))}
            </label>
          );
        })}
      </div>
      {!segment.qualified && (
        <p id={hintId} className="mt-1 text-xs text-foreground/70">
          {t('biometricSettings.segments.automaticNeedsQualification')}
        </p>
      )}
    </fieldset>
  );
}

interface SegmentRowProps {
  segment: IdentitySegment;
  formats: IdentitySegments['formats'];
  busy: boolean;
  /** The failure of the last write on this segment, when there is one to tell (the server's own words when it gave them). */
  failure: unknown;
  onChoose: (segment: IdentitySegment, mode: IdentitySegmentMode) => void;
}

/** One segment: where it applies, its mode, whether it is qualified (or why not, in plain words) and the choice of its mode. */
function SegmentRow({ segment, formats, busy, failure, onChoose }: SegmentRowProps) {
  const { t } = useTranslation();
  const mode = segmentModeOf(segment.mode);
  const name = segmentName(segment, formats, t);
  // «Automatica» that does not approve (the platform permission is off, the policy is provisional, the document needs the chip...) says so: the mode alone would promise more than the server does.
  const notApproving = mode === 'automatic' && !segment.autoApprovalAllowed;

  return (
    <li className="space-y-3 rounded-xl border p-4" data-testid="identity-segment" data-mode={mode} data-segment-id={segment.id}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words font-medium" data-testid="identity-segment-property">
            {segment.propertyName ?? t('biometricSettings.segments.allProperties')}
          </p>
          <p className="break-words text-sm text-foreground/70" data-testid="identity-segment-kind">
            {segmentFormatLabel(formats, segment.formatId)} · {channelLabel(segment.channel, t)}
          </p>
        </div>
        <Badge variant={mode === 'automatic' ? 'success' : mode === 'suspended' ? 'warning' : 'secondary'} data-testid="identity-segment-mode">
          {t(segmentModeKey(mode))}
        </Badge>
      </div>

      <p className="text-sm" data-testid="identity-segment-qualification" data-qualified={segment.qualified ? 'true' : 'false'}>
        {segment.qualified
          ? segment.qualifiedPolicyVersion
            ? t('biometricSettings.segments.qualifiedFor', { version: segment.qualifiedPolicyVersion })
            : t('biometricSettings.segments.qualified')
          : t(segmentReasonKey(segment.qualificationReason ?? 'segment_not_qualified'))}
      </p>

      {notApproving && (
        <p className="text-sm text-foreground/70" data-testid="identity-segment-not-approving">
          {t('biometricSettings.segments.notApproving')} {segment.autoApprovalReason ? t(segmentReasonKey(segment.autoApprovalReason)) : null}
        </p>
      )}

      {mode === 'suspended' && segment.suspendedReason && (
        <p className="break-words text-sm" data-testid="identity-segment-suspended-reason">
          {t('biometricSettings.segments.suspendedReason', { reason: segment.suspendedReason })}
        </p>
      )}

      <ModeChoice segment={segment} name={name} busy={busy} onChoose={(chosen) => onChoose(segment, chosen)} />

      {failure !== null && (
        <Alert variant="danger" data-testid="identity-segment-error">
          {getProblemMessage(failure, t) ?? t('biometricSettings.segments.saveFailed')}
        </Alert>
      )}
    </li>
  );
}

interface SuspendDialogProps {
  segment: IdentitySegment;
  name: string;
  onClose: () => void;
}

/**
 * The reason a segment is suspended for: asked before anything is sent, 1 to 200 characters, kept with the segment. It is a dialog of its own and not a form of the page: the confirmation is the dialog's, and
 * what the server refuses (422) is told inside it, where the guest of the window is looking, with the dialog still open.
 */
function SuspendDialog({ segment, name, onClose }: SuspendDialogProps) {
  const { t } = useTranslation();
  const setMode = useSetIdentitySegmentMode();
  const [reason, setReason] = useState('');
  const clean = suspensionReasonOf(reason);

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        // While the suspension is on its way the dialog cannot be left (Esc, a click outside, the X: every way out comes through here, and the button to cancel is off already): what the server answers, a refusal
        // included, is told inside it, where it is being looked for, and never goes unseen. The close that follows a successful answer is the dialog's own, made with the state of the render of the click (nothing on its way yet).
        if (!open && !setMode.isPending) onClose();
      }}
      title={t('biometricSettings.segments.suspend.title')}
      description={t('biometricSettings.segments.suspend.description', { name })}
      confirmLabel={t('biometricSettings.segments.suspend.confirm')}
      confirmDisabled={clean === null}
      isLoading={setMode.isPending}
      contentClassName="sm:max-h-[90dvh] sm:overflow-y-auto"
      onConfirm={async () => {
        if (clean === null) return;
        await setMode.mutateAsync({ id: segment.id, request: { mode: 'suspended', reason: clean } });
      }}
    >
      <Field
        label={t('biometricSettings.segments.suspend.reasonLabel')}
        hint={t('biometricSettings.segments.suspend.reasonHint')}
        counter={`${reason.length}/${IDENTITY_SEGMENT_REASON_MAX_LENGTH}`}
      >
        <Textarea
          data-testid="identity-segment-suspend-reason"
          rows={3}
          maxLength={IDENTITY_SEGMENT_REASON_MAX_LENGTH}
          required
          value={reason}
          disabled={setMode.isPending}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      {setMode.isError && (
        <Alert variant="danger" data-testid="identity-segment-suspend-error">
          {getProblemMessage(setMode.error, t) ?? t('biometricSettings.segments.saveFailed')}
        </Alert>
      )}
    </ConfirmationDialog>
  );
}

interface AddSegmentProps {
  overview: IdentitySegments;
  busy: boolean;
}

/** A new segment: the property (or all of them), the document type and the browser. It starts in observation, whatever is chosen here. */
function AddSegment({ overview, busy }: AddSegmentProps) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const create = useCreateIdentitySegment();
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState('');
  const [formatId, setFormatId] = useState<string | null>(null);
  const [channel, setChannel] = useState<string | null>(null);
  // The homes are read when the form opens, and again each time: they are changed on other pages. A person who may not read them is not asked (the server would answer 403): «Tutte le strutture» is still there.
  const properties = useProperties({ mode: 'short' }, { fresh: true, enabled: open && hasPermission('short-rent', 'property.read') });
  const chosenFormat = formatId ?? overview.formats[0]?.id ?? '';
  const chosenChannel = channel ?? overview.channels[0] ?? '';
  const complete = chosenFormat !== '' && chosenChannel !== '';

  const close = () => {
    setOpen(false);
    setPropertyId('');
    setFormatId(null);
    setChannel(null);
    create.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // The form is its own: a page that holds the section inside a form of its own is not submitted by it.
    event.stopPropagation();
    if (busy || !complete) return;
    create.mutate({ ...(propertyId !== '' ? { propertyId } : {}), formatId: chosenFormat, channel: chosenChannel }, { onSuccess: close });
  };

  if (!open) {
    return (
      <div>
        <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(true)} data-testid="identity-segment-add">
          {t('biometricSettings.segments.add.open')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border p-4" data-testid="identity-segment-form">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">{t('biometricSettings.segments.add.title')}</h4>
        <p className="text-sm text-foreground/70">{t('biometricSettings.segments.add.hint')}</p>
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-3">
        <Field label={t('biometricSettings.segments.add.property')}>
          <Select data-testid="identity-segment-property-select" value={propertyId} disabled={busy} onChange={(event) => setPropertyId(event.target.value)}>
            <option value="">{t('biometricSettings.segments.allProperties')}</option>
            {(properties.isError ? [] : (properties.data ?? [])).map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('biometricSettings.segments.add.format')}>
          <Select data-testid="identity-segment-format-select" value={chosenFormat} disabled={busy || overview.formats.length === 0} onChange={(event) => setFormatId(event.target.value)}>
            {overview.formats.map((format) => (
              <option key={format.id} value={format.id}>
                {format.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('biometricSettings.segments.add.channel')}>
          <Select data-testid="identity-segment-channel-select" value={chosenChannel} disabled={busy || overview.channels.length === 0} onChange={(event) => setChannel(event.target.value)}>
            {overview.channels.map((code) => (
              <option key={code} value={code}>
                {channelLabel(code, t)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {properties.isError && <p className="text-sm text-foreground/70">{t('biometricSettings.segments.add.propertiesError')}</p>}
      {overview.formats.length === 0 && <p className="text-sm text-foreground/70">{t('biometricSettings.segments.add.noFormats')}</p>}

      {create.isError && (
        <Alert variant="danger" data-testid="identity-segment-create-error">
          {getProblemMessage(create.error, t) ?? t('biometricSettings.segments.saveFailed')}
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={create.isPending} disabled={busy || !complete} data-testid="identity-segment-submit">
          {t('biometricSettings.segments.add.submit')}
        </Button>
        <Button type="button" variant="ghost" disabled={create.isPending} onClick={close}>
          {t('biometricSettings.segments.add.cancel')}
        </Button>
      </div>
    </form>
  );
}

/**
 * The segments of the self-hosted identity verification, inside the card «Verifica dell'identità» (E70/F03/US01/T02, NF-194, decision D4): for each property (or all of them) × document type × browser, whether the
 * policy only observes (the system works out a decision and a person always decides), may approve by itself (a segment that is qualified, with the platform permission on) or is suspended, and why a segment cannot
 * be automatic. The host adds a segment and changes its mode; the qualification is the platform administrators' (no screen here, and the hint says so).
 *
 * Only for the org billing administrator and only while both flags are on: anything else draws nothing and asks nothing (the server asks the same of every call). A write the server refuses (422) is told in its own
 * words next to the segment, or inside the dialog of the suspension; and while any write of the card is in flight every control stays off.
 */
export function IdentitySegmentsSection() {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const { contexts } = useWorkspace();
  const available = isFeatureEnabled(flags, 'checkInIdentityVerification') && isFeatureEnabled(flags, 'checkInIdentitySelfHosted') && isOrgBillingAdmin(contexts);
  const segments = useIdentitySegments(available);
  const setMode = useSetIdentitySegmentMode();
  const busy = useBiometricCardBusy();
  // The segment whose suspension is being asked for, with the name it was given when it was chosen: the dialog stands on this and not on the list, so a read in the background that fails while the reason is being typed
  // takes neither the dialog nor the reason away (and does not bring an empty one back when the list is read again).
  const [suspending, setSuspending] = useState<{ segment: IdentitySegment; name: string } | null>(null);
  const titleId = useId();

  if (!available) return null;

  // A read that failed leaves the older answer in memory: the section says it cannot be read, and shows none of it.
  const overview = segments.isError ? undefined : segments.data;

  const choose = (segment: IdentitySegment, mode: IdentitySegmentMode) => {
    if (busy) return;
    if (mode === 'suspended') {
      setMode.reset();
      setSuspending({ segment, name: segmentName(segment, overview?.formats ?? [], t) });
      return;
    }
    setMode.mutate({ id: segment.id, request: { mode } });
  };

  return (
    <section className="space-y-4 border-t pt-4" aria-labelledby={titleId} data-testid="identity-segments-section">
      <div className="space-y-1">
        <h3 id={titleId} className="text-sm font-semibold">
          {t('biometricSettings.segments.title')}
        </h3>
        <p className="max-w-prose text-sm text-foreground/70">{t('biometricSettings.segments.description')}</p>
      </div>

      {segments.isError ? (
        <Alert
          variant="danger"
          data-testid="identity-segments-error"
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void segments.refetch()}>
              {t('biometricSettings.segments.retry')}
            </Button>
          }
        >
          {t('biometricSettings.segments.loadError')}
        </Alert>
      ) : overview === undefined ? (
        <div data-testid="identity-segments-loading">
          <SkeletonLine lines={3} lineClassName="h-10" />
        </div>
      ) : (
        <>
          <Alert variant="info" data-testid="identity-segments-observation">
            <p>{t('biometricSettings.segments.observation')}</p>
            {!overview.autoApprovalEnabled && (
              <p className="mt-1" data-testid="identity-segments-auto-disabled">
                {t('biometricSettings.segments.autoDisabled')}
              </p>
            )}
          </Alert>

          <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="identity-segments-policy">
            {overview.activePolicy.version !== null ? t('biometricSettings.segments.policy.version', { version: overview.activePolicy.version }) : t('biometricSettings.segments.policy.none')}
            {overview.activePolicy.version !== null && overview.activePolicy.provisional && <Badge variant="warning">{t('biometricSettings.segments.policy.provisional')}</Badge>}
          </p>

          {overview.segments.length === 0 ? (
            <p className="text-sm text-foreground/70" data-testid="identity-segments-empty">
              {t('biometricSettings.segments.empty')}
            </p>
          ) : (
            <ul className="space-y-3">
              {overview.segments.map((segment) => (
                <SegmentRow
                  key={segment.id}
                  segment={segment}
                  formats={overview.formats}
                  busy={busy}
                  // The refusal of the last write is told on the segment it was for (the dialog of a suspension tells its own inside it).
                  failure={setMode.isError && setMode.variables?.id === segment.id ? setMode.error : null}
                  onChoose={choose}
                />
              ))}
            </ul>
          )}

          <AddSegment overview={overview} busy={busy} />

          <p className="text-sm text-foreground/70" data-testid="identity-segments-qualification-hint">
            {t('biometricSettings.segments.qualificationHint')}
          </p>
        </>
      )}

      {suspending !== null && (
        <SuspendDialog
          key={suspending.segment.id}
          segment={suspending.segment}
          name={suspending.name}
          onClose={() => {
            setMode.reset();
            setSuspending(null);
          }}
        />
      )}
    </section>
  );
}
