import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert } from 'lucide-react';

export interface BookingFieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}

interface BookingFieldProps {
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: (control: BookingFieldControlProps) => ReactNode;
}

export function BookingField({ label, optional, hint, error, children }: BookingFieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="vb-field">
      <label className="vb-label" htmlFor={id}>
        {label}
        {optional ? <span className="vb-label__opt">{t('supplierSite.booking.optional')}</span> : null}
      </label>
      {hint ? (
        <p className="vb-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {children({ id, 'aria-describedby': describedBy, ...(error ? { 'aria-invalid': true as const } : {}) })}
      {error ? (
        <p className="vb-error" id={errorId} role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
