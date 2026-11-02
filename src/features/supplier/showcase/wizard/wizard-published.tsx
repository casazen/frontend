import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, Info, Inbox, Pencil } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { formatDeadline } from '@/lib/supplier-site/format';
import { useSupplierSettings } from '@/queries/use-supplier-settings';
import type { ShowcaseContent } from '@/types/supplier-showcase';
import { bookingsReasonKey, OVERVIEW_PATH } from '../showcase-model';

/**
 * The last screen of "Crea la tua vetrina": the showcase is online, and what happens now in the true things only: the customers find it at
 * its address; whether they can book already or not and why; how long a request waits for an answer (read from the settings of the
 * supplier, never written by hand here); and that everything can be changed. Two ways on: open the showcase, share the link.
 * Opened again by a reload it reads the showcase from the server; a showcase that is not published has nothing to confirm.
 */
export function WizardPublished({ content }: { content: ShowcaseContent | undefined }) {
  const { t } = useTranslation();
  const settings = useSupplierSettings();
  if (!content || content.state === 'Draft') return <Navigate to={OVERVIEW_PATH} replace />;

  const reasonKey = bookingsReasonKey(content.bookings.blockedBy);
  const minutes = settings.data?.respondWithinMinutes;
  const deadline = minutes && minutes > 0 ? formatDeadline(minutes, t) : null;

  return (
    <WizardDone
      title={t('supplier.showcase.wizard.done.title')}
      lead={t('supplier.showcase.wizard.done.lead')}
      whatNext={[
        content.bookings.open
          ? { text: t('supplier.showcase.wizard.done.bookingsOpen'), icon: Inbox }
          : { text: reasonKey ? t(reasonKey) : t('supplier.showcase.wizard.done.readOnly'), icon: Info },
        ...(content.bookings.open && deadline ? [{ text: t('supplier.showcase.wizard.done.respond', { deadline }), icon: Clock }] : []),
        { text: t('supplier.showcase.wizard.done.edit'), icon: Pencil },
      ]}
      primary={{ label: t('supplier.showcase.wizard.done.open'), to: content.publicPath ?? OVERVIEW_PATH }}
      secondary={{ label: t('supplier.showcase.wizard.done.share'), to: `${OVERVIEW_PATH}?condividi=1` }}
    />
  );
}
