import { UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ContactList, InviteContactForm } from '@/features/owner-portal/contacts-panel';
import { PortalLoading, PortalPageHeading, PortalReadProblem } from '@/features/owner-portal/portal-parts';
import { useOwnerContacts } from '@/queries/ownerPortal';

export function OwnerContacts() {
  const { t } = useTranslation();
  const contacts = useOwnerContacts();

  return (
    <div className="space-y-6">
      <PortalPageHeading icon={UsersRound} title={t('ownerPortal.contacts.title')} description={t('ownerPortal.contacts.description')} />
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
            <h2 id="owner-contacts-title" className="text-xl font-semibold">
              {t('ownerPortal.contacts.listTitle')}
            </h2>
            <ContactList contacts={contacts.data} />
          </section>
        </>
      ) : null}
    </div>
  );
}
