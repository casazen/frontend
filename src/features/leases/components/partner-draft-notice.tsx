import { useId, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CfStatusBadge } from '@/components/cf-status-badge';
import { LEGAL_DOCUMENT_PATHS } from '@/features/legal/legal-paths';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getProblemMessage } from '@/lib/api-errors';
import { formatDateTime } from '@/lib/utils';
import { isCfPrivacyNotAccepted, useCfAcceptPrivacy, useCfAccess, useCfStatus, useOpenCfForm } from '@/queries/use-concordatofacile';
import type { CfAccessResponse, CfPracticeResponse } from '@/types/concordatofacile.types';
import { LEASE_CONFIRMED_STATE, documentsUploadPath } from '../lib/upload-link';

/**
 * A button of this block: the whole width of a phone (360 px) and a label that may take two lines instead of pushing the page
 * sideways; from `sm` as wide as its label.
 */
const BUTTON = 'h-auto min-h-10 w-full whitespace-normal py-2 text-center sm:w-auto';
const BUTTONS = 'flex flex-col gap-2 sm:flex-row sm:flex-wrap';

/** A practice of the partner that is closed without an attestation: the form can be filled in again. Any other one is under way or done. */
const CLOSED = 'ClosedWithoutAttestation';

/** The date of a practice as the person reads it; nothing for a value that is not a date (the sheet never fails on the partner's data). */
function changedOn(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatDateTime(date);
}

/** The block: its title and, where the form is still to be filled in, what it is about. */
function NoticeFrame({ about = true, children }: { about?: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} data-testid="lease-partner-draft" className="space-y-3 rounded-lg bg-primary/5 p-4 ring-1 ring-primary/30">
      <h2 id={titleId} className="text-lg font-semibold">
        {t('leases.partnerDraft.title')}
      </h2>
      {about ? <p className="text-sm">{t('leases.partnerDraft.description')}</p> : null}
      {children}
    </section>
  );
}

/** The way to the documents: the main button once the form is sent, the second one before. */
function UploadLink({ leaseId, primary = false }: { leaseId: string; primary?: boolean }) {
  const { t } = useTranslation();
  return (
    <Button asChild variant={primary ? 'default' : 'outline'} className={BUTTON}>
      <Link to={documentsUploadPath(leaseId)} state={LEASE_CONFIRMED_STATE} data-testid="lease-partner-upload">
        {t('guidedContract.uploadDocuments')}
      </Link>
    </Button>
  );
}

/**
 * The form is sent and its practice is not closed: where it stands (the status the server read), and nothing that opens the form
 * again. A second visit to the form after the sending makes a second practice, and for a practice already attested no link is made.
 * What is left to do is to upload the documents when they arrive.
 */
function StatusView({ leaseId, practice }: { leaseId: string; practice: CfPracticeResponse }) {
  const { t } = useTranslation();
  const changed = changedOn(practice.statusChangedAt);
  return (
    <NoticeFrame about={false}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-testid="lease-partner-status">
        <span className="text-foreground/70">{t('guidedContract.statusLabel')}</span>
        <CfStatusBadge status={practice.status} />
        {changed ? <span className="text-foreground/70">{t('guidedContract.lastChange', { date: changed })}</span> : null}
      </p>
      <p className="text-sm">{t('guidedContract.sent')}</p>
      <div className={BUTTONS}>
        <UploadLink leaseId={leaseId} primary />
      </div>
    </NoticeFrame>
  );
}

interface FormViewProps {
  leaseId: string;
  /** What the server said about the access (undefined until it has, or when it could not). */
  access: CfAccessResponse | undefined;
  accessPending: boolean;
  /** The form was opened before, so the status is being read: until it is known nothing is offered that could make a second practice. */
  checking: boolean;
  /** The form was opened before and the status could not be read. */
  unavailable: boolean;
}

/**
 * No practice under way (none yet, or all closed): the person fills the form in. Before anything, the privacy notice (a box, once, kept
 * on the server); then ONE main button — «Procedi con la creazione del contratto», or «Riprendi la compilazione» when the form was opened
 * before. Without the access it goes to the page of the service (payment, or the gift practice); with it (platform administrator,
 * payment, gift) it goes straight to the form, in this same tab, with no page in between.
 */
function FormView({ leaseId, access, accessPending, checking, unavailable }: FormViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const privacyId = useId();
  const accept = useCfAcceptPrivacy(leaseId);
  const form = useOpenCfForm(leaseId);
  const [agreed, setAgreed] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const hasAccess = access?.hasAccess === true;
  const opened = Boolean(access?.linkOpenedAt);
  const mustAccept = !accessPending && access?.privacyAccepted !== true;
  // Pressed once: the page is on its way out when the link has been made (see `useOpenCfForm`).
  const busy = accept.isPending || form.isPending || form.isSuccess;
  const waiting = accessPending || checking;

  const go = async () => {
    setFailure(null);
    try {
      if (mustAccept) await accept.mutateAsync();
      if (hasAccess) await form.mutateAsync();
      else navigate(`/app/long-rent/leases/${leaseId}/guided-contract`);
    } catch (error) {
      // A privacy notice the server does not have is not an error to show: the access is read again and the box is there to tick.
      if (!isCfPrivacyNotAccepted(error)) setFailure(error);
    }
  };

  return (
    <NoticeFrame>
      {unavailable && opened ? (
        <p className="text-sm font-medium" data-testid="lease-partner-status-unavailable">
          {t('concordatofacile.entry.statusFailed')}
        </p>
      ) : null}
      {mustAccept ? (
        <div className="flex items-start gap-3" data-testid="lease-partner-privacy">
          <Checkbox id={privacyId} checked={agreed} onCheckedChange={(value) => setAgreed(value === true)} className="mt-1" />
          <div className="space-y-1">
            <Label htmlFor={privacyId} className="cursor-pointer text-sm leading-relaxed">
              {t('guidedContract.privacyLabel')}
            </Label>
            <p className="text-sm">
              <a href={LEGAL_DOCUMENT_PATHS.privacy} target="_blank" rel="noopener noreferrer" className="underline">
                {t('guidedContract.privacyRead')}
              </a>
            </p>
          </div>
        </div>
      ) : null}
      <div className={BUTTONS}>
        <Button
          type="button"
          onClick={() => void go()}
          loading={busy || waiting}
          disabled={mustAccept && !agreed}
          className={BUTTON}
          data-testid="lease-partner-proceed"
        >
          {opened ? t('guidedContract.resume') : t('leases.partnerDraft.proceed')}
        </Button>
        <UploadLink leaseId={leaseId} />
      </div>
      {failure !== null ? (
        <Alert variant="warning" role="alert" data-testid="lease-partner-open-error">
          {getProblemMessage(failure, t) ?? t('guidedContract.openError')}
        </Alert>
      ) : null}
      {accessPending ? null : <p className="text-sm text-foreground/70">{hasAccess ? t('guidedContract.formReady') : t('leases.partnerDraft.ready')}</p>}
    </NoticeFrame>
  );
}

/** The service is on: the access and, where the form was opened before, the status of its practice decide what the block offers. */
function LiveNotice({ leaseId }: { leaseId: string }) {
  const access = useCfAccess(leaseId);
  const opened = access.data?.hasAccess === true && Boolean(access.data.linkOpenedAt);
  // Asked only where there is an access and the form was opened at least once: before that there is nothing to read.
  const status = useCfStatus(leaseId, { enabled: opened });
  const running = status.data?.practices.find((practice) => practice.status !== CLOSED);

  if (running) return <StatusView leaseId={leaseId} practice={running} />;

  return (
    <FormView
      leaseId={leaseId}
      access={access.data}
      accessPending={access.isPending}
      checking={opened && status.isPending}
      unavailable={opened && (status.isError || status.data?.available === false)}
    />
  );
}

/**
 * What a canone concordato draft made for the partner waits for, and the status page of its practice (CF-FLOW): the ONE highlighted
 * block of the sheet, with this precedence:
 *  - service off: the guided form is not available yet (button disabled);
 *  - a contract document uploaded: `CfImportPanel` takes the place of this block (the caller);
 *  - the form was sent and its practice is not closed: its status and «Carica i documenti» — no button that opens the form again;
 *  - otherwise the privacy notice (once), the main button and «Carica i documenti» (`FormView`).
 * The person tells nobody anything: the link that opens the form carries the reference of the contract.
 */
export function PartnerDraftNotice({ leaseId }: { leaseId: string }) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();

  if (flags.concordatoFacile) return <LiveNotice leaseId={leaseId} />;

  return (
    <NoticeFrame>
      <div className={BUTTONS}>
        <Button type="button" disabled className={BUTTON} data-testid="lease-partner-proceed">
          {t('leases.partnerDraft.proceed')}
        </Button>
        <UploadLink leaseId={leaseId} />
      </div>
      <p className="text-sm text-foreground/70">{t('leases.partnerDraft.soon')}</p>
    </NoticeFrame>
  );
}
