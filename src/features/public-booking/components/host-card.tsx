import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, ShieldCheck } from 'lucide-react';
import '@/features/public-booking/property-page.css';

/** The look of an action of the card (a button or a link): the same height and weight, so «Scrivi a» and «Chiama» are a pair. */
export const HOST_ACTION_CLASS = 'public-site-outline inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2 text-sm';

/** The initial of the host on the color of the site: the host has no photo on the site (no avatar upload), only a name. */
export function HostAvatar({ name, size }: { name: string; size: number }) {
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '';
  if (!initial) return null;
  return (
    <span aria-hidden="true" className="pp-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {initial}
    </span>
  );
}

/** A phone number as the host published it, reduced to what a `tel:` link accepts (digits and a leading plus). */
function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  return `tel:${digits.startsWith('+') ? '+' : ''}${digits.replace(/\+/g, '')}`;
}

interface HostCardProps {
  /** How the host is named on the site (their name, else the name of the site). */
  name: string;
  /** The phone number the host chose to publish; the call button is there only with one. */
  phone?: string | null;
  /** The «Scrivi a {host}» action: the page decides what it is (the contact dialog, a mail link) and may have none. */
  writeAction?: ReactNode;
  /** The site takes payments itself: only then it can tell the guest to pay nowhere else. */
  takesPayments?: boolean;
}

/**
 * Who hosts (DB-04a): the name, a way to write and, if the host published one, a number to call. Nothing here is measured or
 * promised (no «risponde in un'ora», no «host verificato»: DB-D9), and a host with no name or contact on the site has no card.
 */
export function HostCard({ name, phone, writeAction, takesPayments = false }: HostCardProps) {
  const { t } = useTranslation();
  const call = phone?.trim() ?? '';

  return (
    <section id="host" aria-labelledby="property-host-title" className="scroll-mt-20" data-testid="property-host">
      <div className="pp-host">
        <div className="pp-host__id">
          <HostAvatar name={name} size={72} />
          <div className="min-w-0">
            <p className="pp-eyebrow">{t('publicProperty.host.eyebrow')}</p>
            <h2 id="property-host-title" className="public-display break-words text-2xl font-semibold">
              {name}
            </h2>
          </div>
        </div>
        {writeAction || call ? (
          <div className="pp-host__actions">
            {writeAction}
            {call ? (
              <a
                href={telHref(call)}
                className={HOST_ACTION_CLASS}
                aria-label={t('publicProperty.host.callLabel', { host: name })}
                data-testid="property-host-call"
              >
                <Phone className="h-4 w-4" aria-hidden />
                {t('publicProperty.host.call')}
              </a>
            ) : null}
          </div>
        ) : null}
        {takesPayments ? (
          <p className="pp-host__safe">
            <ShieldCheck aria-hidden />
            <span>{t('publicProperty.host.paySafely')}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
