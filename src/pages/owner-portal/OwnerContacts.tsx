import { useTranslation } from 'react-i18next';
import { ContactList, InviteContactForm } from '@/features/owner-portal/contacts-panel';
import { PortalLoading, PortalPageHeading, PortalReadProblem } from '@/features/owner-portal/portal-parts';
import { useOwnerContacts } from '@/queries/ownerPortal';

/**
 * The contacts the owner lets into its portal (E07/F07/US01/T03, AC-NF111-4): each one with its own account and the permissions it was given, none shared, all withdrawn at the
 * next request. Only an owner manages them: for a contact it let in, the server says so (403 `owner_contact_owner_only`) and the page says it too, with no list. The entry
 * of the menu is shown only to an owner.
 */
export function OwnerContacts() {
  const { t } = useTranslation();
  const contacts = useOwnerContacts();

  return (
    <div className="space-y-6">
      <PortalPageHeading title={t('ownerPortal.contacts.title')} description={t('ownerPortal.contacts.description')} />
      {contacts.isLoading ? (
        <PortalLoading label={t('ownerPortal.contacts.loading')} />
      ) : contacts.isError ? (
        <PortalReadProblem
          error={contacts.error}
          failedTitle={t('ownerPortal.contacts.error')}
          onRetry={() => void contacts.refetch()}
          testId="owner-contacts-error"
        />
      ) : contacts.data ? (
        <>
          <InviteContactForm />
          <section aria-labelledby="owner-contacts-title" className="space-y-3">
            <h2 id="owner-contacts-title" className="text-xl font-semibold text-[#1f3a3d]">
              {t('ownerPortal.contacts.listTitle')}
            </h2>
            <ContactList contacts={contacts.data} />
          </section>
        </>
      ) : null}
    </div>
  );
}
