import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getProblemMessage } from '@/lib/api-errors';
import { registrationPreparationApi, type RegistrationField, type RegistrationPreparation } from '@/api/registration-preparation.api';
import { leaseDocumentsApi, type LeaseDocument } from '@/api/lease-documents.api';

interface Props {
  leaseId: string; open: boolean; onOpenChange: (open: boolean) => void;
  onPrepared: (paid: boolean) => Promise<void>; isStartingCheckout: boolean;
}
const GROUPS = ['contract', 'property', 'applicant', 'landlords', 'tenants', 'taxes', 'otherProperties'];

/** A server-validated registration supplement. Clear data lives only in this mounted form, never in browser storage. */
export function RegistrationPreparationDialog({ leaseId, open, onOpenChange, onPrepared, isStartingCheckout }: Props) {
  const { t } = useTranslation();
  const formId = useId();
  const [preparation, setPreparation] = useState<RegistrationPreparation | null>(null);
  const [documents, setDocuments] = useState<LeaseDocument[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.all([registrationPreparationApi.get(leaseId), leaseDocumentsApi.list(leaseId)]).then(([result, files]) => {
      if (active) { setPreparation(result); setDocuments(files); setLoadError(false); }
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; setPreparation(null); setDocuments([]); setLoadError(false); setShowIssues(false); };
  }, [leaseId, open, retry]);
  const busy = saving || uploading !== null || isStartingCheckout;
  const changeValue = (name: string, value: string) => setPreparation(current => current ? {
    ...current, data: { ...current.data, values: { ...current.data.values, [name]: value } },
  } : current);
  const changeDocument = (name: string, id: string) => setPreparation(current => {
    if (!current) return current;
    const refs = { ...current.data.documents };
    if (id) refs[name] = id; else delete refs[name];
    return { ...current, data: { ...current.data, documents: refs } };
  });
  const upload = async (field: string, file: File | undefined) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error(t('registrationPreparation.fileTooLarge')); return; }
    setUploading(field);
    try {
      const saved = await registrationPreparationApi.upload(leaseId, file);
      setDocuments(current => [...current, saved]);
      changeDocument(field, saved.id);
    } catch (error) { toast.error(getProblemMessage(error, t) ?? t('registrationPreparation.uploadError')); }
    finally { setUploading(null); }
  };
  const save = async (continueToPayment: boolean) => {
    if (!preparation) return;
    setSaving(true);
    try {
      const result = await registrationPreparationApi.save(leaseId, preparation.data);
      setPreparation(result);
      setShowIssues(true);
      if (continueToPayment && result.ready) await onPrepared(result.paid);
      else if (!continueToPayment) toast.success(t('registrationPreparation.saved'));
    } catch (error) { toast.error(getProblemMessage(error, t) ?? t('registrationPreparation.saveError')); }
    finally { setSaving(false); }
  };
  const renderField = (field: RegistrationField) => {
    const id = `${formId}-${field.name}`;
    const error = showIssues ? preparation?.issues.find(issue => issue.field === field.name)?.message : undefined;
    const value = preparation?.data.values[field.name] ?? '';
    const cedolare = preparation?.data.values.taxRegime === 'CEDOLARE';
    const conditional = (field.name.endsWith('Percentage') && cedolare && !!preparation?.data.values[field.name.replace('Percentage', 'Name')])
      || (['ibanCode', 'accountHolderTaxCode', 'taxPaymentType'].includes(field.name) && preparation?.data.values.taxRegime === 'ORDINARIO')
      || (['guaranteeProviderTaxCode', 'maximumGuaranteeAmount'].includes(field.name) && preparation?.data.values.feesPaymentGuarantees === 'SI');
    if (field.name === 'contractFile') return <p key={field.name} className="text-sm">{t('registrationPreparation.signedContract')}{error && <span role="alert"> {error}</span>}</p>;
    return <div key={field.name} className="min-w-0 space-y-1">
      <label className="text-sm font-medium" htmlFor={id}>{field.label}{field.required || conditional ? ' *' : ''}</label>
      {field.type === 'file' ? <div className="space-y-2">
        <select id={id} className="h-10 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm" value={preparation?.data.documents[field.name] ?? ''}
          onChange={e => changeDocument(field.name, e.target.value)} disabled={busy} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}>
          <option value="">{t('registrationPreparation.selectDocument')}</option>
          {documents.filter(d => d.kind === 'Other' || d.kind === 'RegistrationIdentity').map(d => <option key={d.id} value={d.id}>{d.fileName}</option>)}
        </select>
        <label htmlFor={`${id}-upload`} className="block text-xs">{t('registrationPreparation.uploadDocument')}</label>
        <Input id={`${id}-upload`} type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy}
          onChange={e => { void upload(field.name, e.target.files?.[0]); e.target.value = ''; }} />
        {uploading === field.name && <p role="status" className="text-xs">{t('registrationPreparation.uploading')}</p>}
      </div> : field.options.length > 0 ? <select id={id} className="h-10 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm" value={value}
        onChange={e => changeValue(field.name, e.target.value)} disabled={busy} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}>
        <option value="">{t('registrationPreparation.selectValue')}</option>
        {field.options.map(o => <option key={o.code} value={o.code}>{o.description || o.code}</option>)}
      </select> : <Input id={id} type={field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'} value={value} disabled={busy}
        inputMode={field.type === 'integer' ? 'numeric' : field.type === 'float' ? 'decimal' : undefined} maxLength={500}
        onChange={e => changeValue(field.name, e.target.value)} aria-invalid={!!error} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} />}
      <p id={`${id}-help`} className="text-xs text-muted-foreground">{field.help}</p>
      {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
    </div>;
  };
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl" data-testid="registration-preparation-dialog">
      <DialogHeader>
        <DialogTitle>{t('registrationPreparation.title')}</DialogTitle>
        <DialogDescription>{t('registrationPreparation.description')}</DialogDescription>
      </DialogHeader>
      <p className="text-sm">{t('registrationPreparation.privacy')}</p>
      {loadError ? <div role="alert"><p>{t('registrationPreparation.loadError')}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>{t('registrationPreparation.retry')}</Button></div>
        : !preparation ? <p role="status">{t('registrationPreparation.loading')}</p> : <>
          {showIssues && preparation.issues.length > 0 && <div role="alert" className="rounded-md border border-destructive p-3 text-sm">
            <p>{t('registrationPreparation.fixIssues')}</p>
            <ul className="list-disc pl-5">{preparation.issues.map(issue => <li key={issue.field}>{preparation.schema.fields.find(f => f.name === issue.field)?.label ?? t('registrationPreparation.contract')}: {issue.message}</li>)}</ul>
          </div>}
          {GROUPS.map(group => <fieldset key={group} className="min-w-0 space-y-4 rounded-lg border p-4" disabled={busy}>
            <legend className="px-2 font-semibold">{t(`registrationPreparation.groups.${group}`)}</legend>
            <div className="grid gap-4 sm:grid-cols-2">{preparation.schema.fields.filter(f => f.group === group && f.required).map(renderField)}</div>
            {preparation.schema.fields.some(f => f.group === group && !f.required) && <details open={showIssues || undefined}>
              <summary className="cursor-pointer text-sm font-medium">{t('registrationPreparation.additionalFields')}</summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">{preparation.schema.fields.filter(f => f.group === group && !f.required).map(renderField)}</div>
            </details>}
          </fieldset>)}
          <p className="text-sm">{t('registrationPreparation.costs')}</p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button className="h-auto min-h-10 max-w-full whitespace-normal" variant="outline" disabled={busy} onClick={() => void save(false)}>{t('registrationPreparation.saveDraft')}</Button>
            <Button className="h-auto min-h-10 max-w-full whitespace-normal" disabled={busy} onClick={() => void save(true)}>{busy ? t('registrationPreparation.saving') : preparation.paid ? t('registrationPreparation.continuePaid') : t('registrationPreparation.continuePayment')}</Button>
          </div>
        </>}
    </DialogContent>
  </Dialog>;
}
