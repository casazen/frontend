import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert } from 'lucide-react';

/** What a control inside a {@link BookingField} needs to be read and announced as one: the id its label points at, and its description. */
export interface BookingFieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}

interface BookingFieldProps {
  label: string;
  /** The field may stay empty: the label says so. */
  optional?: boolean;
  hint?: string;
  /** The words of the problem, in the language of the page. Announced when they appear. */
  error?: string;
  children: (control: BookingFieldControlProps) => ReactNode;
}

/**
 * One field of the booking: its label (with "facoltativo" when it can stay empty), a line of help, the control, and the problem in words
 * once there is one. The control is wired to the label, the help and the problem, so it reads out as one thing and the problem is
 * announced when it shows.
 */
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
