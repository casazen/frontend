import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, ShieldCheck } from 'lucide-react';
import '@/features/public-booking/property-page.css';

export const HOST_ACTION_CLASS = 'public-site-outline inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2 text-sm';

export function HostAvatar({ name, size }: { name: string; size: number }) {
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '';
  if (!initial) return null;
  return (
    <span aria-hidden="true" className="pp-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {initial}
    </span>
  );
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  return `tel:${digits.startsWith('+') ? '+' : ''}${digits.replace(/\+/g, '')}`;
}

interface HostCardProps {
  name: string;
  phone?: string | null;
  writeAction?: ReactNode;
  takesPayments?: boolean;
}

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
