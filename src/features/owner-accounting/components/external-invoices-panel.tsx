import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { todayInRome } from '@/lib/stay-dates';
import { useAddExternalDocument, useExternalDocuments, useRemoveExternalDocument, useVerifyExternalDocument } from '@/queries/use-owner-accounting';
import type { OwnerExternalDocument, OwnerStatementVersion } from '@/types';
import { attachmentUrlOf, failureText, messageOf } from '../owner-accounting-model';
import { useOwnerFormat } from '../use-owner-format';
import { FormDialog } from './form-dialog';

const ADD_TEST_ID = 'external-add';

interface ExternalInvoicesPanelProps {
  version: OwnerStatementVersion;
}

/** The SHA-256 of a file, in hex, read in the browser: the file is never sent anywhere, only its fingerprint is kept with the link. */
async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The invoices of the agency's external fiscal system that belong to this statement (E06/F01/US02/T05, E06/F05/US02/T04, NF-110). The statement
 * is not a fiscal document and CasaZen issues no invoice to the owner: here the agency only links the invoice it issued elsewhere (its number,
 * its date, where it is, the fingerprint of the file), checks the link, or removes a mistaken one with its reason: the link stays as evidence.
 * Nothing here has an amount, a VAT or a submission state of its own, and there is no «emetti».
 */
export function ExternalInvoicesPanel({ version }: ExternalInvoicesPanelProps) {
  const { t } = useTranslation();
  const links = useExternalDocuments(version.id);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<OwnerExternalDocument | null>(null);
  const canLink = version.status === 'Approved' || version.status === 'Published';

  return (
    <div className="min-w-0 space-y-3" data-testid="external-invoices">
      <Alert variant="info" data-testid="external-notice">
        {t('ownerAccounting.external.notice')}
      </Alert>
      {!canLink ? <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.external.needsApproval')}</p> : null}

      {links.isPending ? (
        <p role="status" className="text-sm text-foreground/70">
          {t('ownerAccounting.external.loading')}
        </p>
      ) : links.isError ? (
        <Alert variant="danger">{messageOf(links.error, t)}</Alert>
      ) : links.data.length === 0 ? (
        <p className="break-words text-sm text-foreground/70" data-testid="external-empty">
          {t('ownerAccounting.external.empty')}
        </p>
      ) : (
        <ul role="list" className="divide-y divide-border">
          {links.data.map((link) => (
            <LinkRow key={link.id} link={link} onRemove={() => setRemoving(link)} />
          ))}
        </ul>
      )}

      {canLink ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} data-testid={ADD_TEST_ID}>
          {t('ownerAccounting.external.add')}
        </Button>
      ) : null}

      {adding ? <LinkDialog versionId={version.id} onClose={() => setAdding(false)} /> : null}
      {removing ? <RemoveDialog link={removing} onClose={() => setRemoving(null)} /> : null}
    </div>
  );
}

function LinkRow({ link, onRemove }: { link: OwnerExternalDocument; onRemove: () => void }) {
  const { t } = useTranslation();
  const { date, dateTime } = useOwnerFormat();
  const verify = useVerifyExternalDocument();
  const removed = link.removedAt !== null;
  const url = attachmentUrlOf(link.documentUrl);

  return (
    <li className="space-y-1 py-3 text-sm" data-testid="external-link" data-removed={removed}>
      <p className="flex flex-wrap items-center gap-2 font-medium">
        <span className="break-words">{t('ownerAccounting.external.row', { provider: link.provider, number: link.externalNumber, date: date(link.externalDate) })}</span>
        {removed ? <Badge variant="outline">{t('ownerAccounting.external.removed')}</Badge> : link.status === 'Verified' ? <Badge variant="success">{t('ownerAccounting.external.verified')}</Badge> : <Badge variant="secondary">{t('ownerAccounting.external.entered')}</Badge>}
      </p>
      {link.status === 'Verified' && link.verifiedAt && !removed ? <p className="text-foreground/70">{t('ownerAccounting.external.verifiedAt', { date: dateTime(link.verifiedAt) })}</p> : null}
      {removed ? <p className="break-words text-foreground/70">{t('ownerAccounting.external.removalReason', { reason: link.removalReason ?? '', date: dateTime(link.removedAt) })}</p> : null}
      {link.documentSha256 ? <p className="break-words text-foreground/70">{t('ownerAccounting.external.hash', { hash: link.documentSha256.slice(0, 12) })}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {url ? (
          <Button asChild size="sm" variant="outline">
            <a href={url} target="_blank" rel="noopener noreferrer">
              {t('ownerAccounting.external.open')}
            </a>
          </Button>
        ) : null}
        {!removed && link.status === 'Entered' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={verify.isPending}
            onClick={() =>
              verify.mutate(link.id, {
                onSuccess: () => toast.success(t('ownerAccounting.external.verifiedDone')),
                onError: (error) => toast.error(messageOf(error, t)),
              })
            }
            data-testid="external-verify"
          >
            {t('ownerAccounting.external.verify')}
          </Button>
        ) : null}
        {!removed ? (
          <Button type="button" size="sm" variant="danger-outline" onClick={onRemove} data-testid="external-remove">
            {t('ownerAccounting.external.remove')}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

const HEX64 = /^[0-9a-fA-F]{64}$/;

function LinkDialog({ versionId, onClose }: { versionId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const add = useAddExternalDocument(versionId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [provider, setProvider] = useState('');
  const [externalId, setExternalId] = useState('');
  const [externalNumber, setExternalNumber] = useState('');
  const [externalDate, setExternalDate] = useState(() => todayInRome());
  const [documentUrl, setDocumentUrl] = useState('');
  const [hash, setHash] = useState('');
  const [error, setError] = useState<string | null>(null);

  const urlOk = documentUrl.trim() === '' || attachmentUrlOf(documentUrl.trim()) !== null;
  const hashOk = hash.trim() === '' || HEX64.test(hash.trim());
  const valid = provider.trim() !== '' && externalId.trim() !== '' && externalNumber.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(externalDate) && urlOk && hashOk;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setHash(await sha256Hex(file));
    } catch {
      toast.error(t('ownerAccounting.external.hashError'));
    }
  };

  const onSubmit = async () => {
    if (!valid) return;
    setError(null);
    try {
      await add.mutateAsync({
        provider: provider.trim(),
        externalId: externalId.trim(),
        externalNumber: externalNumber.trim(),
        externalDate,
        documentUrl: documentUrl.trim() || undefined,
        documentSha256: hash.trim().toLowerCase() || undefined,
      });
      toast.success(t('ownerAccounting.external.added'));
      onClose();
    } catch (failure) {
      setError(failureText(failure, t, i18n.exists));
    }
  };

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('ownerAccounting.external.dialog.title')}
      description={t('ownerAccounting.external.dialog.description')}
      submitLabel={t('ownerAccounting.external.dialog.submit')}
      pending={add.isPending}
      submitDisabled={!valid}
      error={error}
      onSubmit={onSubmit}
      testId="external-dialog"
    >
      <Field label={t('ownerAccounting.external.dialog.provider')} hint={t('ownerAccounting.external.dialog.providerHint')}>
        <Input value={provider} maxLength={100} autoComplete="off" onChange={(event) => setProvider(event.target.value)} data-testid="external-provider" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('ownerAccounting.external.dialog.number')}>
          <Input value={externalNumber} maxLength={100} autoComplete="off" onChange={(event) => setExternalNumber(event.target.value)} data-testid="external-number" />
        </Field>
        <Field label={t('ownerAccounting.external.dialog.date')}>
          <Input type="date" value={externalDate} onChange={(event) => setExternalDate(event.target.value)} data-testid="external-date" />
        </Field>
      </div>
      <Field label={t('ownerAccounting.external.dialog.externalId')} hint={t('ownerAccounting.external.dialog.externalIdHint')}>
        <Input value={externalId} maxLength={200} autoComplete="off" onChange={(event) => setExternalId(event.target.value)} data-testid="external-id" />
      </Field>
      <Field label={t('ownerAccounting.external.dialog.url')} optional hint={t('ownerAccounting.external.dialog.urlHint')} error={urlOk ? undefined : 'ownerAccounting.external.dialog.urlInvalid'}>
        <Input value={documentUrl} maxLength={1000} inputMode="url" autoComplete="off" onChange={(event) => setDocumentUrl(event.target.value)} data-testid="external-url" />
      </Field>
      <Field label={t('ownerAccounting.external.dialog.hash')} optional hint={t('ownerAccounting.external.dialog.hashHint')} error={hashOk ? undefined : 'ownerAccounting.external.dialog.hashInvalid'}>
        <Input value={hash} maxLength={64} autoComplete="off" onChange={(event) => setHash(event.target.value)} data-testid="external-hash" />
      </Field>
      <div>
        <input ref={fileInput} type="file" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => void onFile(event.target.files?.[0])} data-testid="external-file" />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
          {t('ownerAccounting.external.dialog.fromFile')}
        </Button>
        <p className="mt-1 break-words text-sm text-foreground/70">{t('ownerAccounting.external.dialog.fromFileHint')}</p>
      </div>
    </FormDialog>
  );
}

function RemoveDialog({ link, onClose }: { link: OwnerExternalDocument; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const remove = useRemoveExternalDocument();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    setError(null);
    try {
      await remove.mutateAsync({ referenceId: link.id, reason: reason.trim() });
      toast.success(t('ownerAccounting.external.removedDone'));
    } catch (failure) {
      setError(failureText(failure, t, i18n.exists));
      throw failure;
    }
  };

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('ownerAccounting.external.removeDialog.title')}
      description={t('ownerAccounting.external.removeDialog.description', { number: link.externalNumber })}
      confirmLabel={t('ownerAccounting.external.removeDialog.confirm')}
      variant="destructive"
      isLoading={remove.isPending}
      confirmDisabled={reason.trim().length === 0}
      onConfirm={onConfirm}
    >
      <div className="space-y-3">
        <Field label={t('ownerAccounting.external.removeDialog.reason')} hint={t('ownerAccounting.external.removeDialog.hint')}>
          <Textarea value={reason} maxLength={500} rows={3} onChange={(event) => setReason(event.target.value)} data-testid="external-removal-reason" />
        </Field>
        {error ? <Alert variant="danger">{error}</Alert> : null}
      </div>
    </ConfirmationDialog>
  );
}
