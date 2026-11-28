import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { translateValidationMessage } from '@/i18n/validation-message';

interface FormFieldErrorProps {
  error?: { message?: string } | null;
  message?: string | null;
  id?: string;
  className?: string;
}

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
