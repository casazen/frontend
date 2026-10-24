import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  /**
   * For what cannot be undone: the word the user has to type before the confirm button works ("ELIMINA"). Capital letters
   * and the spaces around it do not matter. Without it the dialog asks as it always did.
   */
  requireText?: string;
  /** What will happen if the user confirms, one short sentence each, listed above the buttons. */
  consequences?: readonly string[];
  /** What the confirmation needs to know (a date): fields between the description and the consequences, inside the form. */
  children?: ReactNode;
  /** Keeps the confirm button off, whatever was typed, while what `children` asks for is not valid (nor does Enter confirm). */
  confirmDisabled?: boolean;
  /**
   * Where the focus goes when the dialog has closed. By default it goes back to what had it before; when the confirmation
   * removes that (a photo of a list), call `event.preventDefault()` and give the focus to something that is still there.
   */
  onCloseAutoFocus?: (event: Event) => void;
}

/** What the user typed and what is asked of them are the same word, whatever the capital letters or the spaces around it. */
function sameWord(typed: string, asked: string): boolean {
  return typed.trim().toLocaleLowerCase() === asked.trim().toLocaleLowerCase();
}

type ConfirmationFormProps = Pick<
  ConfirmationDialogProps,
  'title' | 'description' | 'variant' | 'isLoading' | 'requireText' | 'consequences' | 'children' | 'confirmDisabled'
> & {
  confirmLabel: string;
  cancelLabel: string;
  onCancel: () => void;
  onSubmit: () => void;
};

/**
 * The inside of the dialog. It is a component of its own so that what the user typed is forgotten when the dialog closes
 * (the content of a Radix dialog is unmounted with it) and is not there the next time it opens.
 */
function ConfirmationForm({
  title,
  description,
  variant,
  isLoading,
  requireText,
  consequences,
  children,
  confirmDisabled = false,
  confirmLabel,
  cancelLabel,
  onCancel,
  onSubmit,
}: ConfirmationFormProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const mayConfirm = !confirmDisabled && (requireText === undefined || sameWord(typed, requireText));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // The dialog is drawn outside the page's form but sits inside it for React, which hands an event to the parents of a portal:
    // without this, confirming here would submit the form around the dialog (a wizard that publishes, a page that saves).
    event.stopPropagation();
    if (mayConfirm && !isLoading) onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {children}

      {consequences && consequences.length > 0 ? (
        <ul
          role="list"
          aria-label={t('shared.confirmationDialog.consequences')}
          className="grid gap-2"
          data-testid="confirmation-consequences"
        >
          {consequences.map((consequence, index) => (
            <li key={`${index}-${consequence}`} className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span className="min-w-0 break-words">{consequence}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {requireText !== undefined ? (
        <div className="grid gap-2">
          <Label htmlFor={inputId} className="leading-snug">
            <Trans
              i18nKey="shared.confirmationDialog.requireText"
              values={{ text: requireText }}
              components={{ strong: <strong className="font-semibold" /> }}
            />
          </Label>
          <Input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            disabled={isLoading}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            data-testid="confirmation-input"
          />
        </div>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button type="submit" variant={variant} disabled={isLoading || !mayConfirm}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onConfirm,
  isLoading = false,
  requireText,
  consequences,
  children,
  confirmDisabled,
  onCloseAutoFocus,
}: ConfirmationDialogProps) {
  const { t } = useTranslation();
  const resolvedConfirmLabel = confirmLabel ?? t('shared.confirm');
  const resolvedCancelLabel = cancelLabel ?? t('shared.cancel');
  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <ConfirmationForm
          title={title}
          description={description}
          variant={variant}
          isLoading={isLoading}
          requireText={requireText}
          consequences={consequences}
          confirmDisabled={confirmDisabled}
          confirmLabel={resolvedConfirmLabel}
          cancelLabel={resolvedCancelLabel}
          onCancel={() => onOpenChange(false)}
          onSubmit={() => void handleConfirm()}
        >
          {children}
        </ConfirmationForm>
      </DialogContent>
    </Dialog>
  );
}
