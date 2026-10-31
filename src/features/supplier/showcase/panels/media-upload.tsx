import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dropzone } from '@/components/ui/dropzone';
import { Progress } from '@/components/ui/progress';
import type { ShowcaseMedia, ShowcaseMediaKind } from '@/types/supplier-showcase';
import { limitLabelOf, SHOWCASE_MEDIA } from '../showcase-media';
import { useShowcaseUpload } from './use-showcase-upload';

interface MediaUploadProps {
  kind: ShowcaseMediaKind;
  /** Told the image the server stored, with the address to put into the content. */
  onStored: (media: ShowcaseMedia) => void;
  /** What the zone invites to do ("Carica una nuova foto"). */
  title: string;
  /** The button that opens the file picker ("Scegli un file"). */
  buttonLabel: string;
  disabled?: boolean;
  'data-testid'?: string;
}

/**
 * The place to upload one image of the showcase (SP-13b): a drop zone with its button (the way in for the keyboard and the phone), the
 * rules in one line, and under it what is happening to the file: being prepared, on its way with how much has gone and a way to stop it,
 * or stopped with the reason and the way to try again. One file at a time; the zone is off while one is on its way.
 */
export function MediaUpload({ kind, onStored, title, buttonLabel, disabled = false, 'data-testid': testId = 'supplier-showcase-media-upload' }: MediaUploadProps) {
  const { t } = useTranslation();
  const upload = useShowcaseUpload(kind, onStored);
  const { state } = upload;

  return (
    <div className="min-w-0 space-y-3" data-testid={testId}>
      <Dropzone
        accept={SHOWCASE_MEDIA.types}
        multiple={false}
        title={title}
        buttonLabel={buttonLabel}
        hint={t('supplier.showcase.media.hint', { limit: limitLabelOf(kind) })}
        disabled={disabled || upload.busy}
        className="py-6"
        data-testid={`${testId}-zone`}
        onFiles={(files) => {
          const [file] = files;
          if (file) void upload.start(file);
        }}
      />

      {state.phase === 'preparing' ? (
        <p className="min-w-0 break-words text-sm text-foreground/70" role="status" data-testid={`${testId}-preparing`}>
          {t('supplier.showcase.media.preparing', { name: state.fileName })}
        </p>
      ) : null}

      {state.phase === 'uploading' ? (
        <div className="space-y-2" role="status" data-testid={`${testId}-uploading`}>
          <p className="min-w-0 break-words text-sm text-foreground/70">{t('supplier.showcase.media.uploading', { name: state.fileName, percent: state.percent })}</p>
          <Progress value={state.percent} size="sm" label={t('supplier.showcase.media.progressLabel')} valueText={`${state.percent}%`} />
          <Button type="button" variant="outline" size="sm" onClick={upload.cancel} data-testid={`${testId}-cancel`}>
            {t('supplier.showcase.media.cancel')}
          </Button>
        </div>
      ) : null}

      {state.phase === 'failed' ? (
        <div className="space-y-2" data-testid={`${testId}-failed`}>
          <p className="min-w-0 break-words text-sm font-medium text-[color:var(--color-danger-foreground,#b4232a)]" role="alert">
            {t('supplier.showcase.media.failedFile', { name: state.fileName, message: state.message })}
          </p>
          <div className="flex flex-wrap gap-2">
            {state.retryable ? (
              <Button type="button" variant="outline" size="sm" onClick={upload.retry} data-testid={`${testId}-retry`}>
                {t('supplier.showcase.media.retry')}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={upload.dismiss}>
              {t('supplier.showcase.media.dismiss')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
