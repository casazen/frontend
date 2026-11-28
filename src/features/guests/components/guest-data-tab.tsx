import { Mail, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { FACT_LINK, Fact, Facts } from '@/features/bookings/components/booking-facts';
import { getGenderLabel } from '@/lib/i18n-labels';
import { formatDate } from '@/lib/utils';
import type { Guest } from '@/types';

interface GuestDataTabProps {
  guest: Guest;
}

export function GuestDataTab({ guest }: GuestDataTabProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
      <PlainSection className="rounded-xl border bg-card p-4 sm:p-5" title={t('guests.anagrafica')}>
        <Facts>
          <Fact label={t('guests.email')}>
            {guest.email ? (
              <a href={`mailto:${guest.email}`} className={FACT_LINK}>
                <Mail aria-hidden="true" className="me-2 size-4 shrink-0" />{guest.email}
              </a>
            ) : (
              '—'
            )}
          </Fact>
          <Fact label={t('guests.phone')}>
            {guest.phoneNumber ? (
              <a href={`tel:${guest.phoneNumber.replace(/\s+/g, '')}`} className={FACT_LINK}>
                <Phone aria-hidden="true" className="me-2 size-4 shrink-0" />{guest.phoneNumber}
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

      <PlainSection className="rounded-xl border bg-card p-4 sm:p-5" title={t('guests.addressSection')}>
        <Facts>
          <Fact label={t('guests.address')}>{guest.address || '—'}</Fact>
          <Fact label={t('guests.city')}>{guest.city || '—'}</Fact>
          <Fact label={t('guests.postalCode')}>{guest.postalCode || '—'}</Fact>
          <Fact label={t('guests.country')}>{guest.country || '—'}</Fact>
        </Facts>
      </PlainSection>

      {guest.notes ? (
        <PlainSection className="rounded-xl border bg-card p-4 sm:p-5" title={t('guests.notes')}>
          <p className="whitespace-pre-line break-words">{guest.notes}</p>
        </PlainSection>
      ) : null}
    </div>
  );
}
