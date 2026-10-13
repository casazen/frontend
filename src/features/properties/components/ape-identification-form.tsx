import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateApeIdentification } from '@/queries/use-properties';
import type { PropertyDocumentDto } from '@/types';

interface Props {
  propertyId: string;
  document: PropertyDocumentDto;
}

/**
 * Code and energy class printed on an APE document (LT-10): the lease contract states them. The API checks only their
 * shape (no pattern on the code, whose format is not documented).
 */
export function ApeIdentificationForm({ propertyId, document }: Props) {
  const { t } = useTranslation();
  const update = useUpdateApeIdentification();
  const hasIdentification = !!document.apeCode && !!document.apeEnergyClass;
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(document.apeCode ?? '');
  const [energyClass, setEnergyClass] = useState(document.apeEnergyClass ?? '');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await update.mutateAsync({ propertyId, docId: document.id, data: { code: code.trim(), energyClass: energyClass.trim() } });
      setEditing(false);
    } catch {
      // useUpdateApeIdentification.onError shows the server's reason.
    }
  };

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs" data-testid={`ape-identification-${document.id}`}>
        {hasIdentification ? (
          <span>
            {t('property.documents.apeIdentification', { code: document.apeCode, energyClass: document.apeEnergyClass })}
          </span>
        ) : (
          <span className="text-amber-700">{t('property.documents.apeIdentificationMissing')}</span>
        )}
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setEditing(true)}>
          {t('property.documents.apeIdentificationEdit')}
        </Button>
      </div>
    );
  }

  const codeId = `ape-code-${document.id}`;
  const classId = `ape-class-${document.id}`;
  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-2 flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor={codeId}>{t('property.documents.apeCode')}</Label>
        <Input id={codeId} required maxLength={100} value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={classId}>{t('property.documents.apeEnergyClass')}</Label>
        <Input
          id={classId}
          required
          maxLength={3}
          className="w-20"
          placeholder="A4"
          value={energyClass}
          onChange={(e) => setEnergyClass(e.target.value)}
        />
      </div>
      <Button type="submit" size="sm" disabled={update.isPending}>
        {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('property.documents.apeIdentificationSave')}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={update.isPending}>
        {t('property.documents.apeIdentificationCancel')}
      </Button>
    </form>
  );
}
