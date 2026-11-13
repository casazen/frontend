import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Mail, MessageCircle, Phone, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { formatInstantDay } from '@/features/crm/lib/crm-format';
import { basisLabel, confirmationLabel, contactChannelLabel, originLabel, reachabilitySentence } from '@/features/crm/lib/contact-labels';
import { getProblemCode } from '@/lib/api-errors';
import { useSendContactConfirmation } from '@/queries/crm';
import type { CrmContact } from '@/types/crm.types';
import { contactStateOf } from './contact-state';
import { ContactStateBadge } from './contact-state-badge';

const CHANNEL_ICONS: Record<string, LucideIcon> = { Email: Mail, Phone, WhatsApp: MessageCircle };

/** The `code` of the problem a failed call answered with, or `undefined` (no answer, or one without a code). */
function errorCodeOf(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

/**
 * A contact that has the guest's consent for marketing and was never confirmed: the host can ask for the double opt-in e-mail. A contact
 * that is already confirmed, a soft opt-in, a service-only address or a forward address of a channel has nothing to confirm.
 */
function needsConfirmation(contact: CrmContact): boolean {
  return contact.channel === 'Email' && contact.legalBasis === 'Consent' && contact.confirmation !== 'Confirmed' && !contact.isOtaForward;
}

interface ContactItemProps {
  contact: CrmContact;
  profileId: string;
  canWrite: boolean;
}

/** One contact of the profile: its channel and value, where it came from, what it may be used for, and why it may or may not be written to. */
function ContactItem({ contact, profileId, canWrite }: ContactItemProps) {
  const { t, i18n } = useTranslation();
  const send = useSendContactConfirmation();
  // The server does not say how many requests were sent: the limit is known when it answers 409, and the button waits from then on.
  const [limitReached, setLimitReached] = useState(false);

  const Icon = CHANNEL_ICONS[contact.channel] ?? Mail;
  const isEmail = contact.channel === 'Email';
  const recorded = formatInstantDay(contact.basisRecordedAt, i18n.language);
  const version = contact.basisVersion.trim();
  const basisDetail =
    version && recorded
      ? t('crm.contacts.basisVersionAndDate', { version, date: recorded })
      : version
        ? t('crm.contacts.basisVersion', { version })
        : recorded
          ? t('crm.contacts.basisDate', { date: recorded })
          : '';

  const showButton = canWrite && needsConfirmation(contact);
  const blockedReason = contact.isSuppressed ? t('crm.contacts.confirmationSuppressed') : limitReached ? t('crm.contacts.confirmationLimit') : null;

  const requestConfirmation = () => {
    send.mutate(
      { contactId: contact.id, profileId },
      {
        onError: (error) => {
          if (errorCodeOf(error) === 'crm_confirmation_limit_reached') setLimitReached(true);
        },
      },
    );
  };

  return (
    <li className="space-y-2 border-t py-4 first:border-t-0 first:pt-0" data-testid="crm-contact" data-contact-id={contact.id}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">
          <Icon className="size-4 shrink-0 text-foreground/70" aria-hidden="true" />
          <span className="min-w-0 break-all">{contact.value}</span>
        </span>
        {isEmail ? (
          <ContactStateBadge
            state={contactStateOf({
              hasAddress: contact.value !== '',
              basis: contact.legalBasis,
              reachable: contact.marketable,
              suppressed: contact.isSuppressed,
              otaForward: contact.isOtaForward,
            })}
          />
        ) : null}
      </div>

      <dl className="grid grid-cols-[minmax(6.5rem,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        <dt className="text-foreground/70">{t('crm.contacts.fields.channel')}</dt>
        <dd>{contactChannelLabel(t, contact.channel)}</dd>
        <dt className="text-foreground/70">{t('crm.contacts.fields.origin')}</dt>
        <dd>{originLabel(t, contact.origin)}</dd>
        <dt className="text-foreground/70">{t('crm.contacts.fields.basis')}</dt>
        <dd className="break-words">
          {basisLabel(t, contact.legalBasis)}
          {basisDetail ? ` · ${basisDetail}` : ''}
        </dd>
        {isEmail && (contact.legalBasis === 'Consent' || contact.confirmation !== 'Unconfirmed') ? (
          <>
            <dt className="text-foreground/70">{t('crm.contacts.fields.confirmation')}</dt>
            <dd>{confirmationLabel(t, contact.confirmation)}</dd>
          </>
        ) : null}
        {contact.isSuppressed ? (
          <>
            <dt className="text-foreground/70">{t('crm.contacts.fields.optOut')}</dt>
            <dd>{t('crm.contacts.suppressed')}</dd>
          </>
        ) : null}
      </dl>

      {contact.isOtaForward ? (
        <p className="text-sm text-foreground/70" data-testid="crm-contact-ota-note">
          {t('crm.contacts.otaForward')}
        </p>
      ) : null}

      <p className="text-sm" data-testid="crm-contact-reachability">
        {reachabilitySentence(t, contact)}
      </p>

      {showButton ? (
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={send.isPending}
            disabled={blockedReason !== null}
            aria-label={t('crm.contacts.sendConfirmationFor', { value: contact.value })}
            onClick={requestConfirmation}
            data-testid="crm-contact-send-confirmation"
          >
            {t('crm.contacts.sendConfirmation')}
          </Button>
          {blockedReason ? (
            <p className="text-sm text-foreground/70" data-testid="crm-contact-confirmation-blocked">
              {blockedReason}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

interface ProfileContactsProps {
  profileId: string;
  contacts: CrmContact[];
  /** The guest record of the profile, where the consent of the guest is withdrawn; `null` for a lead that has none. */
  primaryGuestId: string | null;
  /** The caller may ask for a confirmation (`guest.write`). */
  canWrite: boolean;
}

/**
 * The contacts of a profile (E07/F01/US04/T02, NF-89): each with its channel, its value, where it came from, its confirmation, its
 * legal basis with the version of the text and the day, whether the guest opted out, and one sentence on whether it may be written
 * to for marketing and why not. The forward address of a booking channel is told for what it is: service messages only. For a
 * consent that was never confirmed the host can ask for the confirmation e-mail. Withdrawing a consent is not done here: it
 * stays in the privacy tab of the guest's record, which this section links to.
 */
export function ProfileContacts({ profileId, contacts, primaryGuestId, canWrite }: ProfileContactsProps) {
  const { t } = useTranslation();

  return (
    <PlainSection title={t('crm.contacts.title')} count={contacts.length} data-testid="crm-contacts-section">
      <p className="text-sm text-foreground/70">{t('crm.contacts.description')}</p>

      {contacts.length === 0 ? (
        <p className="text-sm text-foreground/70" data-testid="crm-contacts-empty">
          {t('crm.contacts.empty')}
        </p>
      ) : (
        <ul role="list" aria-label={t('crm.contacts.title')} className="mt-2">
          {contacts.map((contact) => (
            <ContactItem key={contact.id} contact={contact} profileId={profileId} canWrite={canWrite} />
          ))}
        </ul>
      )}

      <p className="text-sm text-foreground/70" data-testid="crm-contacts-withdrawals">
        {t('crm.contacts.withdrawals')}{' '}
        {primaryGuestId ? (
          <Link
            to={`/app/short-rent/guests/${primaryGuestId}?tab=privacy`}
            className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('crm.contacts.withdrawalsLink')}
          </Link>
        ) : null}
      </p>
    </PlainSection>
  );
}
