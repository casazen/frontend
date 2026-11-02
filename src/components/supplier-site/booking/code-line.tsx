import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';

/** The code of a booking (`XXXXX-XXXXX`), to keep: shown whole, with a button that copies it (and says so to a screen reader). */
export function CodeLine({ code }: { code: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <p className="vf-code">
      <span>{t('supplierSite.booking.confirm.code')}</span>
      <strong>{code}</strong>
      <button type="button" className="vf-copy" onClick={() => void copy()} aria-label={t('supplierSite.booking.confirm.copy')}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </button>
      <span className="sr-only" role="status">
        {copied ? t('supplierSite.booking.confirm.copied') : ''}
      </span>
    </p>
  );
}
