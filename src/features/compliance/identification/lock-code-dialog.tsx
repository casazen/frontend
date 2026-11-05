import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { getProblemMessage } from '@/lib/api-errors';
import { useSetAccessCode } from '@/queries/use-access-codes';
import type { AccessCodeStatusItem } from '@/types';

/** A lock code is a few digits, sometimes with letters or a `#`; this leaves room for a short note ("gate 1234, door 5678") and no more. */
const LOCK_CODE_MAX_LENGTH = 64;

interface LockCodeBodyProps {
  property: AccessCodeStatusItem;
  onClose: () => void;
}

function LockCodeBody({ property, onClose }: LockCodeBodyProps) {
  const { t } = useTranslation();
  const save = useSetAccessCode();
  // Whether there was a code when the window opened: the list changes behind the window as soon as the code is saved, its words must not.
  const [hadCode] = useState(property.accessCodeSet);
  // Write-only: it starts empty every time, even to change a code that exists, and nothing ever puts a stored code in it.
  const [code, setCode] = useState('');
  const clean = code.trim();

  if (save.isSuccess) {
    return (
      <div className="flex min-w-0 flex-col gap-4" data-testid="lock-code-saved">
        <DialogHeader>
          <DialogTitle>{t('compliance.identification.dialog.savedTitle')}</DialogTitle>
          <DialogDescription role="status">{t('compliance.identification.dialog.savedDescription', { name: property.name })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={onClose} autoFocus data-testid="lock-code-done">
            {t('shared.close')}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (clean === '' || save.isPending) return;
    // What was typed is dropped as soon as it is saved: the window keeps no copy of what it sent.
    save.mutate({ propertyId: property.propertyId, code: clean }, { onSuccess: () => setCode('') });
  };

  // In plain words: the answer of the server when it has one worth showing (no permission, session over), ours otherwise.
  const failure = save.isError ? (getProblemMessage(save.error, t) ?? t('compliance.identification.dialog.error')) : undefined;

  return (
    <form onSubmit={submit} className="flex min-w-0 flex-col gap-4" data-testid="lock-code-form">
      <DialogHeader>
        <DialogTitle>{t(hadCode ? 'compliance.identification.dialog.changeTitle' : 'compliance.identification.dialog.setTitle')}</DialogTitle>
        <DialogDescription>
          {t(hadCode ? 'compliance.identification.dialog.changeDescription' : 'compliance.identification.dialog.setDescription', { name: property.name })}
        </DialogDescription>
      </DialogHeader>

      <Field label={t('compliance.identification.dialog.fieldLabel')} hint={t('compliance.identification.dialog.fieldHint')}>
        <Input
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            if (save.isError) save.reset();
          }}
          maxLength={LOCK_CODE_MAX_LENGTH}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          // The code is not a password of the host: no manager of passwords should offer to keep it.
          data-1p-ignore
          data-lpignore="true"
          className="pointer-coarse:h-11 font-mono"
          data-testid="lock-code-input"
        />
      </Field>

      {failure ? <Alert variant="danger" data-testid="lock-code-error">{failure}</Alert> : null}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
          {t('shared.cancel')}
        </Button>
        <Button type="submit" loading={save.isPending} disabled={clean === ''} data-testid="lock-code-save">
          {t(save.isPending ? 'common.saving' : 'compliance.identification.dialog.save')}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface LockCodeDialogProps {
  /** The property whose code is being written. It stays while the window closes, so the window does not empty out while it fades. */
  property: AccessCodeStatusItem | undefined;
  open: boolean;
  onClose: () => void;
}

/**
 * «Imposta codice» / «Cambia codice» (E03/F01/US03): the window where the host writes the lock code of one property. The field is
 * write-only (ADR-013): it is never filled with the code that is stored, the code is never shown again once saved, and it goes only in
 * the body of the request. The content is mounted with the window, so what was typed is forgotten when it closes. After saving, the
 * window says so and shows no code; a failure is said in plain words and the typed text stays, to try again.
 */
export function LockCodeDialog({ property, open, onClose }: LockCodeDialogProps) {
  return (
    <Dialog open={open && property !== undefined} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-h-[90dvh] sm:overflow-y-auto" data-testid="lock-code-dialog">
        {property ? <LockCodeBody key={property.propertyId} property={property} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}
