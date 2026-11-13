import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { getProblemMessage } from '@/lib/api-errors';
import { formatStayDate, romeDateOf } from '@/lib/stay-dates';
import { useInviteOwnerContact, useRevokeOwnerContact, useSetOwnerContactPermissions } from '@/queries/ownerPortal';
import type { OwnerContact, OwnerContactStatus, OwnerPortalPermission } from '@/types';
import { OWNER_PORTAL_PERMISSIONS } from '@/types';
import { contactName, isContactEditable, isContactRevocable, looksLikeEmail, samePermissions, togglePermission } from './owner-portal-model';
import { CheckRow, StatusPill, type PillTone, TOUCH } from './portal-parts';

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

const STATUS_TONE: Record<OwnerContactStatus, PillTone> = {
  invited: 'info',
  active: 'success',
  expired: 'warning',
  revoked: 'neutral',
};

/** The five permissions, each with its words: they are independent of one another and each one is a box of its own. */
function PermissionBoxes({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string;
  value: readonly OwnerPortalPermission[];
  onChange: (next: OwnerPortalPermission[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('ownerPortal.contacts.permissions.label')} className="space-y-1">
      {OWNER_PORTAL_PERMISSIONS.map((permission) => (
        <CheckRow
          key={permission}
          id={`${idPrefix}-${permission}`}
          checked={value.includes(permission)}
          disabled={disabled}
          onChange={(granted) => onChange(togglePermission(value, permission, granted))}
          label={t(`ownerPortal.contacts.permissions.${permission}.label`)}
          description={t(`ownerPortal.contacts.permissions.${permission}.description`)}
          testId={`${idPrefix}-${permission}`}
        />
      ))}
    </div>
  );
}

/**
 * Invites a contact with its own account (E07/F07/US01/T03, AC-NF111-4): its name, its address and the permissions it is given, none of them by default (a contact with no
 * permission is refused, an empty list is never «all»). The invitation is an e-mail with a link; until the contact accepts it, it has no access, and the page says so. What is
 * typed is state of this form: it is not in the address, in a storage or in the cache of the mutation after the answer.
 */
export function InviteContactForm() {
  const { t } = useTranslation();
  const invite = useInviteOwnerContact();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [permissions, setPermissions] = useState<OwnerPortalPermission[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [invitedTo, setInvitedTo] = useState<string | null>(null);

  const refusal = invite.error ? (getProblemMessage(invite.error, t) ?? t('ownerPortal.contacts.invite.failed')) : null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (invite.isPending) return;
    if (!firstName.trim() || !lastName.trim() || !looksLikeEmail(email)) {
      setProblem(t('ownerPortal.contacts.invite.detailsRequired'));
      return;
    }
    if (permissions.length === 0) {
      setProblem(t('ownerPortal.contacts.invite.permissionRequired'));
      return;
    }
    setProblem(null);
    setInvitedTo(null);
    const address = email.trim();
    invite.mutate(
      { email: address, firstName: firstName.trim(), lastName: lastName.trim(), permissions },
      {
        onSuccess: () => {
          setInvitedTo(address);
          setEmail('');
          setFirstName('');
          setLastName('');
          setPermissions([]);
          invite.reset();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-md border bg-card p-4" data-testid="owner-invite-form" aria-labelledby="owner-invite-title">
      <h2 id="owner-invite-title" className="text-lg font-semibold">
        {t('ownerPortal.contacts.invite.title')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('ownerPortal.contacts.invite.description')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('ownerPortal.contacts.invite.firstName')}>
          <Input className={TOUCH} value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="off" data-testid="owner-invite-first-name" />
        </Field>
        <Field label={t('ownerPortal.contacts.invite.lastName')}>
          <Input className={TOUCH} value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="off" data-testid="owner-invite-last-name" />
        </Field>
      </div>
      <Field label={t('ownerPortal.contacts.invite.email')}>
        <Input
          type="email"
          inputMode="email"
          className={TOUCH}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
          data-testid="owner-invite-email"
        />
      </Field>
      <fieldset className="space-y-1">
        <legend className="mb-1 text-sm font-medium">{t('ownerPortal.contacts.invite.permissions')}</legend>
        <PermissionBoxes idPrefix="owner-invite" value={permissions} onChange={setPermissions} disabled={invite.isPending} />
      </fieldset>
      {problem ? (
        <Alert variant="danger" data-testid="owner-invite-problem">
          {problem}
        </Alert>
      ) : null}
      {refusal ? (
        <Alert variant="danger" data-testid="owner-invite-refused">
          {refusal}
        </Alert>
      ) : null}
      {invitedTo ? (
        <Alert variant="info" title={t('ownerPortal.contacts.invite.sentTitle')} data-testid="owner-invite-sent">
          {t('ownerPortal.contacts.invite.sent', { email: invitedTo })}
        </Alert>
      ) : null}
      <Button type="submit" className={`${TOUCH} w-full sm:w-auto`} loading={invite.isPending} data-testid="owner-invite-submit">
        {invite.isPending ? t('ownerPortal.contacts.invite.sending') : t('ownerPortal.contacts.invite.submit')}
      </Button>
    </form>
  );
}

interface ContactCardProps {
  contact: OwnerContact;
  /** One write at a time in the whole list: every button waits while one works. */
  busy: boolean;
  save: ReturnType<typeof useSetOwnerContactPermissions>;
  revoke: ReturnType<typeof useRevokeOwnerContact>;
}

/**
 * A contact of the owner: who, where its invitation stands, and what it may do. An invited contact has no access yet (the page says it); a withdrawn contact is a record with nothing to
 * change; a lapsed invitation has no permission to change but can still be withdrawn (the same question first): for the server it counts in the most contacts until it is, and the owner
 * must be able to clear it. The permissions are changed one by one, saved together, and effective at the contact's next request; withdrawing asks first and also takes
 * effect at the next request. The card is made again when the server's permissions change, so the boxes are always the server's after a save.
 */
function ContactCard({ contact, busy, save, revoke }: ContactCardProps) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<OwnerPortalPermission[]>(contact.permissions);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const editable = isContactEditable(contact);
  const revocable = isContactRevocable(contact);
  const changed = !samePermissions(draft, contact.permissions);

  const saveDraft = async () => {
    setFailure(null);
    try {
      await save.mutateAsync({ contactId: contact.id, permissions: draft });
    } catch (error) {
      setFailure(error);
    }
  };

  const confirmRevoke = async () => {
    setFailure(null);
    try {
      await revoke.mutateAsync(contact.id);
      setConfirming(false);
    } catch (error) {
      setFailure(error);
      setConfirming(false);
    }
  };

  const idPrefix = `owner-contact-${contact.id}`;
  return (
    <li className="min-w-0 rounded-md border bg-card p-4" data-testid="owner-contact" data-status={contact.status}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold">{contactName(contact)}</h3>
          <p className="break-all text-sm text-muted-foreground">{contact.email}</p>
        </div>
        <StatusPill tone={STATUS_TONE[contact.status]}>{t(`ownerPortal.contacts.status.${contact.status}.title`)}</StatusPill>
      </div>
      <p className="mt-2 text-sm">
        {t(`ownerPortal.contacts.status.${contact.status}.description`, {
          date: formatStayDate(romeDateOf(contact.status === 'revoked' ? contact.revokedAt : contact.invitationExpiresAt), i18n.language, DATE),
        })}
      </p>

      {editable ? (
        <div className="mt-3 space-y-3">
          <PermissionBoxes idPrefix={idPrefix} value={draft} onChange={setDraft} disabled={busy} />
          {draft.length === 0 ? <p className="text-sm text-destructive">{t('ownerPortal.contacts.permissions.noneLeft')}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className={TOUCH}
              disabled={busy || !changed || draft.length === 0}
              loading={save.isPending && save.variables?.contactId === contact.id}
              onClick={() => void saveDraft()}
              data-testid="owner-contact-save"
            >
              {t('ownerPortal.contacts.permissions.save')}
            </Button>
            <Button type="button" variant="danger-outline" className={TOUCH} disabled={busy} onClick={() => setConfirming(true)} data-testid="owner-contact-revoke">
              {t('ownerPortal.contacts.revoke.button')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground" aria-label={t('ownerPortal.contacts.permissions.label')}>
            {contact.permissions.map((permission) => (
              <li key={permission}>{t(`ownerPortal.contacts.permissions.${permission}.label`)}</li>
            ))}
          </ul>
          {/* A lapsed invitation has no access, but for the server it is still «invited» and counts in the most contacts until it is withdrawn: the owner can clear it. */}
          {revocable ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="danger-outline" className={TOUCH} disabled={busy} onClick={() => setConfirming(true)} data-testid="owner-contact-revoke">
                {t('ownerPortal.contacts.revoke.button')}
              </Button>
            </div>
          ) : null}
        </>
      )}

      {failure ? (
        <Alert variant="danger" className="mt-3" data-testid="owner-contact-failed">
          {getProblemMessage(failure, t) ?? t('ownerPortal.contacts.failed')}
        </Alert>
      ) : null}

      <ConfirmationDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open && !revoke.isPending) setConfirming(false);
        }}
        title={t('ownerPortal.contacts.revoke.title', { name: contactName(contact) })}
        description={t('ownerPortal.contacts.revoke.description')}
        consequences={[t('ownerPortal.contacts.revoke.consequenceNow'), t('ownerPortal.contacts.revoke.consequenceRecord')]}
        confirmLabel={t('ownerPortal.contacts.revoke.confirm')}
        cancelLabel={t('ownerPortal.contacts.revoke.keep')}
        variant="destructive"
        isLoading={revoke.isPending}
        onConfirm={confirmRevoke}
      />
    </li>
  );
}

/** The contacts of the owner. Every write of the list waits for the one that is working. */
export function ContactList({ contacts }: { contacts: readonly OwnerContact[] }) {
  const { t } = useTranslation();
  const save = useSetOwnerContactPermissions();
  const revoke = useRevokeOwnerContact();
  const busy = save.isPending || revoke.isPending;

  if (contacts.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid="owner-contacts-empty">
        {t('ownerPortal.contacts.empty')}
      </p>
    );
  }

  return (
    <ul className="space-y-3" data-testid="owner-contacts">
      {contacts.map((contact) => (
        <ContactCard key={`${contact.id}-${contact.status}-${contact.permissions.join(',')}`} contact={contact} busy={busy} save={save} revoke={revoke} />
      ))}
    </ul>
  );
}
