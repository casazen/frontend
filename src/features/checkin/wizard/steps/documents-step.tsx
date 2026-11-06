import { useRef, useState, type ChangeEvent } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { Camera, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { StayGuestDocumentFields } from '@/features/checkin/components/stay-guest-fields';
import type { CodeTableSource } from '@/features/checkin/components/code-table';
import { requiresDocument } from '@/features/checkin/schemas/checkin.schema';
import { getProblemMessage } from '@/lib/api-errors';
import { useReadCheckInDocument } from '@/queries/use-checkin-wizard';
import type { CheckInWizardState, DocumentReading } from '@/types/checkin-wizard.types';
import {
  ISSUE_FIELD_LABEL_KEYS,
  formValuesFromReading,
  mergeReading,
  type CheckInWizardValues,
  type ReadableGuestField,
  type ReadingMerge,
} from '../lib/checkin-wizard-model';
import { useFocusFromAddress } from '../lib/use-focus-from-address';

/** The photo is read in memory by the server, which takes JPEG and PNG up to 10 MB. */
const MAX_PHOTO_BYTES = 10_000_000;
const PHOTO_TYPES = ['image/jpeg', 'image/png'];

/** What a reading left for the host to look at. */
interface ReadingReview {
  reading: DocumentReading;
  merge: ReadingMerge;
  /** What the photo shows for the fields in conflict, until the host decides. */
  read: Partial<Record<ReadableGuestField, string>>;
}

interface DocumentPhotoReaderProps {
  bookingId: string;
  form: UseFormReturn<CheckInWizardValues>;
  index: number;
}

/**
 * The photo of the document of one guest (`capabilities.documentReading`): the server reads it (MRZ, then OCR) and the page fills the fields
 * that are still empty. A field the host already typed is never overwritten without asking. The photo is held only for the request: its
 * preview is revoked as soon as the reading ends, the mutation is reset, the file field is emptied, and nothing goes to the draft (the wizard
 * has none), to a storage or to a log.
 */
function DocumentPhotoReader({ bookingId, form, index }: DocumentPhotoReaderProps) {
  const { t } = useTranslation();
  const read = useReadCheckInDocument(bookingId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [review, setReview] = useState<ReadingReview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const field = (name: ReadableGuestField) => `guests.${index}.${name}` as const;

  const readPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Emptied at once: the browser keeps no reference to the photo once the request has it.
    event.target.value = '';
    if (!file) return;
    setReview(null);
    if (!PHOTO_TYPES.includes(file.type)) {
      setProblem(t('checkin.wizard.documents.photoType'));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setProblem(t('checkin.wizard.documents.photoTooLarge'));
      return;
    }

    setProblem(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    try {
      const reading = await read.mutateAsync({ photo: file, fileName: file.type === 'image/png' ? 'document.png' : 'document.jpg' });
      const values = formValuesFromReading(reading.fields);
      const current = form.getValues(`guests.${index}`);
      const merge = mergeReading(current, values);
      // What was empty is filled; what the host typed differently waits for the host's answer.
      for (const name of merge.filled) form.setValue(field(name), values[name] ?? '', { shouldDirty: true });
      setReview({ reading, merge, read: values });
    } catch (error) {
      setProblem(getProblemMessage(error, t) ?? t('checkin.wizard.documents.readFailed'));
    } finally {
      URL.revokeObjectURL(url);
      setPreview(null);
      read.reset();
    }
  };

  const applyPhotoValues = () => {
    if (!review) return;
    for (const { field: name, read: value } of review.merge.conflicts) form.setValue(field(name), value, { shouldDirty: true });
    setReview({ ...review, merge: { ...review.merge, conflicts: [] } });
  };

  const keepTyped = () => {
    if (review) setReview({ ...review, merge: { ...review.merge, conflicts: [] } });
  };

  const nothingRead = review !== null && (review.reading.method === 'None' || review.reading.fields == null);

  return (
    <section className="space-y-3 rounded-md border border-dashed p-4" data-testid={`document-photo-${index}`}>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          data-testid={`document-photo-${index}-input`}
          onChange={(event) => void readPhoto(event)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={read.isPending}
          onClick={() => fileInput.current?.click()}
          data-testid={`document-photo-${index}-button`}
        >
          {read.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" aria-hidden="true" />}
          {t('checkin.wizard.documents.photoButton')}
        </Button>
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">{t('checkin.wizard.documents.photoHint')}</p>
      </div>

      {read.isPending && preview && (
        <div className="flex items-center gap-3" role="status" data-testid={`document-photo-${index}-reading`}>
          <img src={preview} alt={t('checkin.wizard.documents.photoAlt')} className="h-16 w-auto rounded border" />
          <span className="text-sm">{t('checkin.wizard.documents.reading')}</span>
        </div>
      )}

      {problem && (
        <p role="alert" className="text-sm text-destructive" data-testid={`document-photo-${index}-problem`}>
          {problem}
        </p>
      )}

      {nothingRead && (
        <Alert variant="info" data-testid={`document-photo-${index}-nothing`}>
          {t('checkin.wizard.documents.nothingRead')}
        </Alert>
      )}

      {review && !nothingRead && review.reading.requiresManualReview && (
        <Alert variant="warning" title={t('checkin.wizard.documents.checkTitle')} data-testid={`document-photo-${index}-check`}>
          {t('checkin.wizard.documents.checkText')}
        </Alert>
      )}

      {review && review.merge.filled.length > 0 && (
        <p className="text-sm" role="status" data-testid={`document-photo-${index}-filled`}>
          {t('checkin.wizard.documents.filled', {
            fields: review.merge.filled.map((name) => t(ISSUE_FIELD_LABEL_KEYS[name]).toLowerCase()).join(', '),
          })}
        </p>
      )}

      {review && review.merge.conflicts.length > 0 && (
        <Alert
          variant="info"
          title={t('checkin.wizard.documents.conflictTitle')}
          data-testid={`document-photo-${index}-conflicts`}
          action={
            <>
              <Button type="button" size="sm" onClick={applyPhotoValues} data-testid={`document-photo-${index}-use`}>
                {t('checkin.wizard.documents.usePhoto')}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={keepTyped} data-testid={`document-photo-${index}-keep`}>
                {t('checkin.wizard.documents.keepTyped')}
              </Button>
            </>
          }
        >
          <ul className="list-disc space-y-0.5 pl-5">
            {review.merge.conflicts.map((conflict) => (
              <li key={conflict.field}>
                {t('checkin.wizard.documents.conflict', {
                  field: t(ISSUE_FIELD_LABEL_KEYS[conflict.field]),
                  typed: conflict.typed,
                  read: conflict.read,
                })}
              </li>
            ))}
          </ul>
        </Alert>
      )}
    </section>
  );
}

interface DocumentsStepProps {
  bookingId: string;
  form: UseFormReturn<CheckInWizardValues>;
  state: CheckInWizardState;
  source: CodeTableSource;
}

/**
 * The documents step: for each guest who needs a document (the single guest, the head of family or group) the photo, when the reading is
 * open, and the manual fields, which are always there and are the only way while the reading is closed.
 */
export function DocumentsStep({ bookingId, form, state, source }: DocumentsStepProps) {
  const { t } = useTranslation();
  useFocusFromAddress();
  const guests = useWatch({ control: form.control, name: 'guests' });
  const leaders = guests.map((guest, index) => ({ guest, index })).filter(({ guest }) => requiresDocument(guest.type));

  if (leaders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="checkin-wizard-no-documents">
        {t('checkin.wizard.documents.none')}
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="checkin-wizard-documents">
      <p className="text-sm text-muted-foreground">{t('checkin.documentIntro')}</p>
      {leaders.map(({ index }) => (
        <div key={index} className="space-y-3">
          {state.capabilities.documentReading && <DocumentPhotoReader bookingId={bookingId} form={form} index={index} />}
          <StayGuestDocumentFields index={index} source={source} />
        </div>
      ))}
    </div>
  );
}
