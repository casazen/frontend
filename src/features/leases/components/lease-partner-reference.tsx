import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** A real saved lease id for the partner: it is distinct from the property id. */
export function LeasePartnerReference({ leaseId }: { leaseId: string }) {
  const { t } = useTranslation();
  const inputId = useId();
  const [message, setMessage] = useState('');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(leaseId);
      setMessage(t('cfDocuments.copied'));
    } catch {
      setMessage(t('cfDocuments.copyFailed'));
    }
  };
  return (
    <section className="space-y-2 rounded-lg border p-4">
      <Label htmlFor={inputId}>{t('cfDocuments.partnerReference')}</Label>
      <div className="flex flex-wrap gap-2">
        <Input id={inputId} readOnly value={leaseId} className="min-w-0 flex-1 font-mono" onFocus={(event) => event.target.select()} />
        <Button type="button" variant="outline" onClick={() => void copy()}>{t('cfDocuments.copy')}</Button>
      </div>
      <p className="text-sm text-muted-foreground">{t('cfDocuments.referenceHelp')}</p>
      <p role="status" className="text-sm">{message}</p>
      <Link className="inline-block underline" to={`/app/long-rent/documents/upload?leaseId=${encodeURIComponent(leaseId)}`}>{t('cfDocuments.title')}</Link>
    </section>
  );
}
