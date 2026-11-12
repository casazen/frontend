import type { UseFormReturn } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { WizardSummary, type WizardSummaryItem } from '@/components/shared/wizard/wizard-summary';
import { requiresDocument } from '@/features/checkin/schemas/checkin.schema';
import { formatCurrency } from '@/lib/utils';
import { useStayTouristTax } from '@/queries/use-checkin-wizard';
import type { CheckInWizardState } from '@/types/checkin-wizard.types';
import { taxOutlook, type CheckInWizardValues } from '../lib/checkin-wizard-model';

interface SendStepProps {
  bookingId: string;
  form: UseFormReturn<CheckInWizardValues>;
  state: CheckInWizardState;
}

/** How the guests reach the police, in plain words: through the channel manager, or by the host on the portal. */
type SendRoute = 'channelManager' | 'channelManagerNotConnected' | 'senderCasaZen' | 'senderManual';

function sendRouteOf(state: CheckInWizardState): SendRoute {
  const { alloggiatiSender } = state.sender;
  if (alloggiatiSender === 'ChannelManager') return state.octorate.mirrored ? 'channelManager' : 'channelManagerNotConnected';
  return alloggiatiSender === 'CasaZen' ? 'senderCasaZen' : 'senderManual';
}

/**
 * The summary before sending (NF-05): who stays, what is sent to Octorate and how, the tourist tax and the warnings, each block with an
 * "Edit" that goes back to its step. Nothing is sent by looking at it; the last button, "Confirm and send", does it. What leaves for
 * Octorate depends on the sender of the property: with the channel manager as sender, Octorate sends the data to the police; with CasaZen
 * or the host as sender nothing goes to Octorate for now and the communication to the police is made on the Alloggiati Web portal.
 */
export function SendStep({ bookingId, form, state }: SendStepProps) {
  const { t, i18n } = useTranslation();
  const guests = useWatch({ control: form.control, name: 'guests' });
  const taxQuery = useStayTouristTax(bookingId);
  const tax = taxQuery.data ?? state.tax;
  const outlook = taxOutlook(tax);
  const money = (amount: number) => formatCurrency(amount, 'EUR', i18n.language.startsWith('en') ? 'en-GB' : 'it-IT');
  const route = sendRouteOf(state);
  const warnings = state.issues.filter((issue) => !issue.blocking).length;
  const blocking = state.issues.filter((issue) => issue.blocking).length;

  const names = guests
    .map((guest, index) => `${guest.firstName} ${guest.lastName}`.trim() || t('checkin.guestHeading', { index: index + 1 }))
    .join(', ');
  const leaders = guests.filter((guest) => requiresDocument(guest.type));
  const withDocument = leaders.filter((guest) => guest.documentNumber.trim() !== '' || guest.documentNumberOnFile).length;

  const taxValue = (() => {
    if (!tax) return t('checkin.wizard.send.tax.none');
    switch (outlook) {
      case 'toCollect':
        return t('checkin.wizard.send.tax.toCollect', { amount: money(tax.amountDue ?? tax.total ?? 0) });
      case 'collectedByChannel':
        return t('checkin.wizard.send.tax.channel', { amount: money(tax.total ?? 0) });
      case 'missingRate':
        return t('checkin.wizard.send.tax.missingRate');
      case 'collectorNeeded':
        return t('checkin.wizard.send.tax.collectorNeeded');
      default:
        return t('checkin.wizard.send.tax.notCalculable');
    }
  })();

  const items: WizardSummaryItem[] = [
    {
      id: 'guests',
      label: t('checkin.wizard.send.guests'),
      value: t('checkin.wizard.send.guestsValue', { count: guests.length, names }),
      stepId: 'guests',
    },
    {
      id: 'documents',
      label: t('checkin.wizard.send.documents'),
      value: t('checkin.wizard.send.documentsValue', { done: withDocument, total: leaders.length }),
      stepId: 'documents',
    },
    {
      id: 'octorate',
      label: t('checkin.wizard.send.octorate'),
      value: t(`checkin.wizard.send.route.${route}.short`),
      stepId: 'guests',
    },
    { id: 'tax', label: t('checkin.wizard.send.tax.label'), value: taxValue, stepId: 'tax' },
    {
      id: 'warnings',
      label: t('checkin.wizard.send.warnings'),
      value: blocking > 0 ? t('checkin.wizard.send.blockingValue', { count: blocking }) : warnings > 0 ? t('checkin.wizard.send.warningsValue', { count: warnings }) : t('checkin.wizard.send.noWarnings'),
      stepId: 'checks',
    },
  ];

  return (
    <div className="space-y-5" data-testid="checkin-wizard-send">
      <p className="text-sm text-muted-foreground">{t('checkin.wizard.send.intro')}</p>
      <WizardSummary items={items} />
      {blocking > 0 && (
        <Alert variant="danger" title={t('checkin.wizard.send.blockedTitle')} data-testid="checkin-wizard-send-blocked">
          {t('checkin.wizard.send.blockedText')}
        </Alert>
      )}
      <Alert variant="info" title={t('checkin.wizard.send.routeTitle')} data-testid="checkin-wizard-send-route" data-route={route}>
        {t(`checkin.wizard.send.route.${route}.long`)}
      </Alert>
    </div>
  );
}
