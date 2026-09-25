import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { translateValidationMessage } from '@/i18n/validation-message';

interface FormFieldErrorProps {
  /** A react-hook-form `FieldError` (or anything with a `message`), e.g. `errors.name`. */
  error?: { message?: string } | null;
  /** Alternative to `error`: the raw message (i18n key or text). */
  message?: string | null;
  id?: string;
  className?: string;
}

/**
 * Shows the validation error of a form field, translating the i18n key used as Zod message.
 * Renders nothing when there is no error.
 */
export function FormFieldError({ error, message, id, className }: FormFieldErrorProps) {
  const { t, i18n } = useTranslation();
  const text = translateValidationMessage(message ?? error?.message, t, i18n);
  if (!text) return null;

  return (
    <p id={id} className={cn('text-sm text-destructive', className)}>
      {text}
    </p>
  );
}
