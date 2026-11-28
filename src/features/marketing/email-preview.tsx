import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EmailPreviewProps {
  subject: string;
  body: string;
  propertyName: string;
  photoUrl?: string;
}

export function EmailPreview({ subject, body, propertyName, photoUrl }: EmailPreviewProps) {
  const { t } = useTranslation();
  return (
    <figure
      aria-label={t('marketingHub.preview.label')}
      data-testid="email-preview"
      className="m-0 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-inset ring-border"
    >
      <div className="flex items-center gap-2 bg-muted/60 px-4 py-2.5 text-xs text-foreground/70">
        <Mail aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 truncate">{t('marketingHub.preview.from', { name: propertyName })}</span>
      </div>
      {photoUrl ? <img src={photoUrl} alt="" loading="lazy" className="h-36 w-full object-cover sm:h-44" /> : null}
      <div className="space-y-3 p-4 sm:p-5">
        <p className="break-words text-lg font-semibold leading-snug">{subject || t('marketingHub.preview.subjectEmpty')}</p>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/85">{body || t('marketingHub.preview.bodyEmpty')}</p>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-center text-xs text-foreground/65">{t('marketingHub.preview.footer')}</figcaption>
    </figure>
  );
}
