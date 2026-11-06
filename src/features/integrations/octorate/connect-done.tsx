import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarSync, ShieldCheck } from 'lucide-react';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { PROPERTIES_PATH } from '@/features/properties/properties-paths';
import { useOctorateConnection } from '@/queries/use-octorate-connection';
import { OCTORATE_CONNECT_PATH } from './octorate-callback';

/** The home of the area. */
const HOME_PATH = '/app/short-rent';

interface ConnectDoneProps {
  /** How many properties the consent covers, when this visit completed it. */
  propertyCount: number | null;
  /** The wizard has just finished. Not the case when the address is opened again (a reload): then nothing proves that the connection works. */
  fresh: boolean;
}

/**
 * "What happens now" after the consent (E02/F01/US01/T04): the connection works. It says only what is true today: CasaZen can read the
 * account, and nothing on the listings changes without the host's confirmation. The next steps of the wizard (the listings found, their
 * mapping, the summary) come after the consent as steps of the same wizard.
 *
 * Opened again on its address, it asks the server first: a connection that is not there sends the host back to the beginning.
 */
export function ConnectDone({ propertyCount, fresh }: ConnectDoneProps) {
  const { t } = useTranslation();
  const connection = useOctorateConnection({ enabled: !fresh });

  if (!fresh) {
    if (connection.isPending) return <LoadingScreen message={t('octorate.connect.consent.checking')} className="h-auto flex-1" />;
    if (connection.data?.status !== 'Connected') return <Navigate to={OCTORATE_CONNECT_PATH} replace />;
  }

  return (
    <WizardDone
      title={t('octorate.connect.consent.connected.title')}
      description={
        propertyCount === null
          ? undefined
          : propertyCount === 0
            ? t('octorate.connect.consent.connected.none')
            : t('octorate.connect.consent.connected.found', { count: propertyCount })
      }
      whatNext={[
        { text: t('octorate.connect.done.reads'), icon: CalendarSync },
        { text: t('octorate.connect.done.confirm'), icon: ShieldCheck },
      ]}
      primary={{ label: t('octorate.connect.done.toProperties'), to: PROPERTIES_PATH }}
      secondary={{ label: t('octorate.connect.done.toHome'), to: HOME_PATH }}
    />
  );
}
