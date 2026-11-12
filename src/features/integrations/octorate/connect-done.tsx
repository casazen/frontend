import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarSync, ClipboardCheck, Clock, ShieldCheck } from 'lucide-react';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { PROPERTIES_PATH } from '@/features/properties/properties-paths';
import { useOctorateConnection } from '@/queries/use-octorate-connection';
import { useFoundListings } from '@/queries/use-octorate-mapping';
import { ConnectResult } from './connect-summary-step';
import { ExistingImportResult, NewListingsCard } from './existing-import-result';
import { resultRows, type ListingOutcome } from './mapping-model';
import { OCTORATE_CONNECT_PATH } from './octorate-callback';

/** The home of the area. */
const HOME_PATH = '/app/short-rent';

interface ConnectDoneProps {
  /** What this visit did, listing by listing. `null` when the address is opened again (a reload): the server then says where each listing stands. */
  outcomes: readonly ListingOutcome[] | null;
  /** The wizard has just finished. Not the case when the address is opened again (a reload): then nothing proves that the connection works. */
  fresh: boolean;
  /** The import of the listings that already exist on OTAs, when this wizard started one: its result is shown channel by channel. */
  batchId?: string | null;
  /** A mixed portfolio with properties that are new: the listing wizard is offered for them, never started by itself. */
  hasNew?: boolean;
}

/**
 * "What happens now" at the end of the wizard (E02/F01/US02/T05, NF-05): the result for each listing (linked, imported, left for later,
 * excluded), what happens to the iCal calendars the host already has on the channels, and one suggested next step: check the listings
 * that were imported. It says only what is true today: CasaZen can read the account, and nothing on the listings changes without the
 * host's confirmation.
 *
 * Opened again on its address, it asks the server first: a connection that is not there sends the host back to the beginning, and the
 * rows say where each listing stands now (what only the visit that did it knew, such as which listing was imported, is not repeated).
 */
export function ConnectDone({ outcomes, fresh, batchId = null, hasNew = false }: ConnectDoneProps) {
  const { t } = useTranslation();
  const connection = useOctorateConnection({ enabled: !fresh });
  const listings = useFoundListings({ enabled: fresh || connection.data?.status === 'Connected' });

  if (!fresh) {
    if (connection.isPending) return <LoadingScreen message={t('octorate.connect.consent.checking')} className="h-auto flex-1" />;
    if (connection.data?.status !== 'Connected') return <Navigate to={OCTORATE_CONNECT_PATH} replace />;
  }
  if (listings.isPending) return <LoadingScreen message={t('octorate.connect.done.loading')} className="h-auto flex-1" />;

  const rows = listings.isSuccess ? resultRows(listings.data, outcomes) : [];
  const kinds = new Set(rows.map((row) => row.kind));

  return (
    <WizardDone
      title={t('octorate.connect.done.title')}
      whatNext={[
        { text: t('octorate.connect.done.reads'), icon: CalendarSync },
        { text: t('octorate.connect.done.confirm'), icon: ShieldCheck },
        ...(kinds.has('imported') ? [{ text: t('octorate.connect.done.imported'), icon: ClipboardCheck }] : []),
        ...(kinds.has('later') ? [{ text: t('octorate.connect.done.later'), icon: Clock }] : []),
      ]}
      primary={{ label: t('octorate.connect.done.checkImported'), to: PROPERTIES_PATH }}
      secondary={{ label: t('octorate.connect.done.toHome'), to: HOME_PATH }}
    >
      {batchId ? <ExistingImportResult batchId={batchId} /> : null}
      {listings.isSuccess ? <ConnectResult rows={rows} /> : null}
      {hasNew ? <NewListingsCard /> : null}
    </WizardDone>
  );
}
