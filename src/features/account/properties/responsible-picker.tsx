import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { toastUndo } from '@/lib/toast-undo';
import { useSetPropertyResponsible } from '@/queries/use-properties';
import type { OrgMember } from '@/types/org-team.types';
import { orgRoleLabel } from '../account-roles';
import { ACCOUNT_PEOPLE_PATH } from '../account-home-model';
import { memberName } from '@/features/team/people-rows';
import { candidatesFor, type AccountPropertyRow } from './account-properties-model';
import { useMemberAccess } from './use-account-property-rows';

const NOBODY = '-';

interface Failure {
  id: string;
  name: string;
  message: string;
}

export interface ResponsiblePickerProps {
  rows: readonly AccountPropertyRow[] | null;
  members: readonly OrgMember[];
  onClose: () => void;
  /**
   * The selection of a list: called when every property was done, instead of the toast with "Annulla" that this dialog shows for
   * one property (the list says it itself, for all the rows it selected, and takes them back with its own undo).
   */
  onAllDone?: () => void;
}

function commonChoice(rows: readonly AccountPropertyRow[]): string {
  const choices = new Set(rows.map((row) => row.responsible?.userId ?? NOBODY));
  return choices.size === 1 ? [...choices][0] : '';
}

interface PickerFormProps extends Omit<ResponsiblePickerProps, 'rows'> {
  rows: readonly AccountPropertyRow[];
  busy: boolean;
  setBusy: (busy: boolean) => void;
}

/**
 * The inside of the dialog. It is a component of its own so that what was chosen and what went wrong are forgotten when the dialog
 * closes (the content of a Radix dialog is unmounted with it) and are not there the next time it opens.
 */
function PickerForm({ rows, members, onClose, onAllDone, busy, setBusy }: PickerFormProps) {
  const { t } = useTranslation();
  const assign = useSetPropertyResponsible();
  const { granted, isPending, isError, retry } = useMemberAccess(members);
  const candidates = useMemo(() => candidatesFor(members, rows, granted), [members, rows, granted]);
  const initial = useMemo(() => commonChoice(rows), [rows]);
  const [choice, setChoice] = useState(initial);
  const [failures, setFailures] = useState<Failure[] | null>(null);

  const many = rows.length > 1;
  const unchanged = choice === '' || choice === initial;

  const submit = async () => {
    if (unchanged || busy) return;
    const userId = choice === NOBODY ? null : choice;
    setBusy(true);
    const done: AccountPropertyRow[] = [];
    const failed: Failure[] = [];
    for (const row of rows) {
      try {
        await assign.mutateAsync({ id: row.property.id, userId });
        done.push(row);
      } catch (error) {
        failed.push({ id: row.property.id, name: row.property.name, message: getProblemMessage(error, t) ?? t('accountProperties.responsible.failedGeneric') });
      }
    }
    setBusy(false);

    const undoDone = async () => {
      for (const row of done) await assign.mutateAsync({ id: row.property.id, userId: row.responsible?.userId ?? null });
    };

    if (failed.length === 0) {
      onClose();
      if (onAllDone) onAllDone();
      else toastUndo(t('accountProperties.responsible.done', { count: done.length }), { undo: undoDone });
      return;
    }
    setFailures(failed);
    if (done.length > 0) toastUndo(t('accountProperties.responsible.done', { count: done.length }), { undo: undoDone });
  };

  if (failures) {
    return (
      <div className="grid gap-4" data-testid="responsible-picker-failures">
        <DialogHeader>
          <DialogTitle>{t('accountProperties.responsible.failedTitle', { count: failures.length })}</DialogTitle>
          <DialogDescription>{t('accountProperties.responsible.failedDescription')}</DialogDescription>
        </DialogHeader>
        <ul role="list" className="grid gap-2 text-sm">
          {failures.map((failure) => (
            <li key={failure.id} className="min-w-0 break-words">
              <span className="font-medium">{failure.name}</span>
              <span className="block text-foreground/70">{failure.message}</span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t('accountProperties.responsible.close')}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {many ? t('accountProperties.responsible.titleMany', { count: rows.length }) : t('accountProperties.responsible.titleOne', { name: rows[0].property.name })}
        </DialogTitle>
        <DialogDescription>{t('accountProperties.responsible.description')}</DialogDescription>
      </DialogHeader>

      {isPending ? (
        <SkeletonLine lines={2} label={t('accountProperties.responsible.loading')} />
      ) : (
        <Field label={t('accountProperties.responsible.label')} hint={t('accountProperties.responsible.hint', { count: rows.length })}>
          <Select value={choice} onChange={(event) => setChoice(event.target.value)} disabled={busy} data-testid="responsible-select">
            {initial === '' ? (
              <option value="" disabled>
                {t('accountProperties.responsible.choose')}
              </option>
            ) : null}
            {candidates.map((member) => (
              <option key={member.id} value={member.userId}>
                {`${memberName(member)} · ${orgRoleLabel(member.role, t)}`}
              </option>
            ))}
            <option value={NOBODY}>{t('accountProperties.responsible.nobody')}</option>
          </Select>
        </Field>
      )}

      {isError ? (
        <Alert
          variant="warning"
          action={
            <Button type="button" size="sm" variant="outline" onClick={retry}>
              {t('accountProperties.responsible.retry')}
            </Button>
          }
        >
          {t('accountProperties.responsible.accessUnavailable')}
        </Alert>
      ) : null}

      <Link to={ACCOUNT_PEOPLE_PATH} className="text-sm font-medium text-primary underline underline-offset-4">
        {t('accountProperties.responsible.manageAccess')}
      </Link>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          {t('accountProperties.responsible.cancel')}
        </Button>
        <Button type="submit" loading={busy} disabled={unchanged || isPending}>
          {t('accountProperties.responsible.assign')}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ResponsiblePicker({ rows, members, onClose, onAllDone }: ResponsiblePickerProps) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={rows !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>{rows ? <PickerForm rows={rows} members={members} onClose={onClose} onAllDone={onAllDone} busy={busy} setBusy={setBusy} /> : null}</DialogContent>
    </Dialog>
  );
}
