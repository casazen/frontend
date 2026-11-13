import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  /** The write is on its way: the button is busy and the form is not sent twice. */
  pending?: boolean;
  submitDisabled?: boolean;
  /** Why the server refused, in words: the dialog stays open with it. */
  error?: string | null;
  onSubmit: () => void | Promise<void>;
  testId: string;
  children: ReactNode;
}

/**
 * A dialog that is one form: the fields, the reason a write was refused, «Annulla» and the button. The form is not sent from the page around it
 * (the event stops here: a dialog drawn in a portal still bubbles to the parents of its component), and it is a form so Enter sends it.
 */
export function FormDialog({ open, onOpenChange, title, description, submitLabel, pending = false, submitDisabled = false, error, onSubmit, testId, children }: FormDialogProps) {
  const { t } = useTranslation();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!pending && !submitDisabled) void onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto" data-testid={testId}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          {children}
          {error ? (
            <Alert variant="danger" data-testid={`${testId}-error`}>
              {error}
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('shared.cancel')}
            </Button>
            <Button type="submit" loading={pending} disabled={submitDisabled} data-testid={`${testId}-submit`}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
