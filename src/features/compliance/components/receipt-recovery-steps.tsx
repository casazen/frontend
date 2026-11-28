import { useId, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatStayDate } from '@/lib/stay-dates';

interface ReceiptRecoveryStepsProps {
  /** The portal of Alloggiati Web the configuration of the API names (`alloggiatiPortalUrl`, https): the first step opens it. Without a valid address the step tells where to go and offers no link: the client never writes one. */
  portalUrl?: string;
  day?: string;
  children: ReactNode;
}

/**
 * «Recupera la ricevuta» (CHK-04 point 3, NF-43): the three short steps of a host who has no receipt of the Alloggiati communication yet, inside the layer that files it, so the host never
 * leaves the page: where to get it on the portal of the police (the address comes from the configuration, never from the client), which day to choose there, and the file dragged here.
 * The receipt is one for each day and for each account of the portal, whatever the number of flats: the second step says so. It only guides: it never says that anything was sent or
 * that a receipt exists, and it asks the host to declare nothing.
 */
export function ReceiptRecoverySteps({ portalUrl, day, children }: ReceiptRecoveryStepsProps) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const link = portalUrl !== undefined && portalUrl.startsWith('https://') ? portalUrl : undefined;
  const dayText = day ? formatStayDate(day, i18n.language) : '';

  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-lg bg-muted p-3 text-sm" data-testid="proof-upload-portal-step">
      <h3 id={titleId} className="font-medium">
        {t('complianceArchive.upload.recovery.title')}
      </h3>
      <ol className="list-decimal space-y-4 pl-5 marker:font-medium">
        <li className="space-y-2" data-testid="receipt-step-portal">
          <p className="font-medium">{t('complianceArchive.upload.portalTitle')}</p>
          <p>{t('complianceArchive.upload.portalBody')}</p>
          {link ? (
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <a href={link} target="_blank" rel="noopener noreferrer" data-testid="proof-upload-portal-link">
                <ExternalLink className="size-4" aria-hidden="true" />
                {t('complianceArchive.upload.portalLink')}
              </a>
            </Button>
          ) : null}
        </li>
        <li className="space-y-1" data-testid="receipt-step-day">
          <p className="font-medium">{t('complianceArchive.upload.recovery.dayTitle')}</p>
          <p>{dayText ? t('complianceArchive.upload.recovery.dayBody', { day: dayText }) : t('complianceArchive.upload.recovery.dayBodyNoDay')}</p>
        </li>
        <li className="space-y-2" data-testid="receipt-step-file">
          <p className="font-medium">{t('complianceArchive.upload.recovery.fileTitle')}</p>
          {children}
        </li>
      </ol>
    </section>
  );
}
