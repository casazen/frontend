import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { FACT_LINK, Fact, Facts } from '@/features/bookings/components/booking-facts';
import { getGenderLabel } from '@/lib/i18n-labels';
import { formatDate } from '@/lib/utils';
import type { Guest } from '@/types';

interface GuestDataTabProps {
  guest: Guest;
}

/**
 * The tab Dati dell'ospite: who the guest is, where they live and the notes about them, as the page always showed them, in
 * sections without a box. A value the guest has not given is a dash, so the host sees what is still missing.
 */
export function GuestDataTab({ guest }: GuestDataTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <PlainSection title={t('guests.anagrafica')}>
        <Facts>
          <Fact label={t('guests.email')}>
            {guest.email ? (
              <a href={`mailto:${guest.email}`} className={FACT_LINK}>
                {guest.email}
              </a>
            ) : (
              '—'
            )}
          </Fact>
          <Fact label={t('guests.phone')}>
            {guest.phoneNumber ? (
              <a href={`tel:${guest.phoneNumber.replace(/\s+/g, '')}`} className={FACT_LINK}>
                {guest.phoneNumber}
              </a>
            ) : (
              '—'
            )}
          </Fact>
          <Fact label={t('guests.gender')}>{guest.gender ? getGenderLabel(guest.gender, t) : '—'}</Fact>
          <Fact label={t('guests.dateOfBirth')}>{guest.dateOfBirth ? formatDate(guest.dateOfBirth) : '—'}</Fact>
          <Fact label={t('guests.placeOfBirth')}>{guest.placeOfBirth || '—'}</Fact>
          <Fact label={t('guests.nationality')}>{guest.nationality || '—'}</Fact>
        </Facts>
      </PlainSection>

      <PlainSection title={t('guests.addressSection')}>
        <Facts>
          <Fact label={t('guests.address')}>{guest.address || '—'}</Fact>
          <Fact label={t('guests.city')}>{guest.city || '—'}</Fact>
          <Fact label={t('guests.postalCode')}>{guest.postalCode || '—'}</Fact>
          <Fact label={t('guests.country')}>{guest.country || '—'}</Fact>
        </Facts>
      </PlainSection>

      {guest.notes ? (
        <PlainSection title={t('guests.notes')}>
          <p className="whitespace-pre-line break-words">{guest.notes}</p>
        </PlainSection>
      ) : null}
    </div>
  );
}
