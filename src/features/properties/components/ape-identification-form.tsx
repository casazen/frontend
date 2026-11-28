import { useId, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apeReadFoundNothing } from '@/lib/ape-documents';
import { useApeAutoRead, useReadApeIdentification, useUpdateApeIdentification } from '@/queries/use-properties';
import type { PropertyDocumentDto } from '@/types';

interface Props {
  propertyId: string;
  document: PropertyDocumentDto;
  /** Open on the two fields (right after an upload, or where a contract waits for them) instead of on the summary. */
  initiallyEditing?: boolean;
  onDone?: () => void;
  cancelLabel?: string;
  required?: boolean;
  autoRead?: boolean;
}

export function ApeIdentificationForm({
  propertyId,
  document,
  initiallyEditing = false,
  onDone,
  cancelLabel,
  required = false,
  autoRead = false,
}: Props) {
  const { t } = useTranslation();
  const update = useUpdateApeIdentification();
  const read = useReadApeIdentification();
  const fieldsId = useId();
  const hasIdentification = !!document.apeCode && !!document.apeEnergyClass;
  const [editing, setEditing] = useState(initiallyEditing);
  const readByItself = useApeAutoRead(propertyId, document, autoRead && !editing);
  const reading = read.isPending || readByItself.isFetching;
  const readHere = read.isSuccess || readByItself.isSuccess;
  const foundNothing = !hasIdentification && (readHere || apeReadFoundNothing(document.id));
  const [code, setCode] = useState(document.apeCode ?? '');
  const [energyClass, setEnergyClass] = useState(document.apeEnergyClass ?? '');

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await update.mutateAsync({ propertyId, docId: document.id, data: { code: code.trim(), energyClass: energyClass.trim() } });
      setEditing(false);
      onDone?.();
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
        ) : reading ? (
          <span role="status" className="inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            {t('property.documents.apeReading')}
          </span>
        ) : (
          <span className="text-amber-700">
            {foundNothing ? t('property.documents.apeNotReadable') : t('property.documents.apeIdentificationMissing')}
          </span>
        )}
        {hasIdentification || reading || readHere ? null : (
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => read.mutate({ propertyId, docId: document.id })}>
            {t('property.documents.apeReadFromDocument')}
          </Button>
        )}
        <Button type="button" variant="link" size="sm" className="h-auto p-0" disabled={reading} onClick={() => setEditing(true)}>
          {hasIdentification ? t('property.documents.apeIdentificationCorrect') : t('property.documents.apeIdentificationEdit')}
        </Button>
      </div>
    );
  }

  const codeId = `${fieldsId}-code`;
  const classId = `${fieldsId}-class`;
  return (
    <div
      role="group"
      aria-labelledby={fieldsId}
      className="mt-2 flex flex-wrap items-end gap-2"
      data-testid={`ape-identification-fields-${document.id}`}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) void handleSubmit(event);
      }}
    >
      <span id={fieldsId} className="sr-only">{t('property.documents.apeIdentificationTitle')}</span>
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
      <Button type="button" size="sm" disabled={update.isPending || !code.trim() || !energyClass.trim()} onClick={(e) => void handleSubmit(e)}>
        {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('property.documents.apeIdentificationSave')}
      </Button>
      {required ? null : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(false);
            onDone?.();
          }}
          disabled={update.isPending}
        >
          {cancelLabel ?? t('property.documents.apeIdentificationCancel')}
        </Button>
      )}
    </div>
  );
}
