import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileCheck2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { isAdmin } from '@/lib/auth-roles';
import { lacksCurrentConsents } from '@/lib/onboarding';
import { useCurrentUser } from '@/queries/use-users';

/**
 * A quiet line at the top of the shell for a platform administrator who also has an organization of their own, when the legal documents
 * changed and the current ones are not accepted yet (LR-WIZ-1): the backend withholds the host features until they are (PL-02), so their
 * workspaces as an owner disappear without a word, and the app does not send an administrator to the consents (they work in the admin
 * area). Nothing is forced: the line says what happened and links to the page where the documents are accepted.
 */
export function LegalConsentsNotice() {
  const { t } = useTranslation();
  const { user: signedIn } = useAuth();
  const { user: profile } = useCurrentUser();
  if (!isAdmin(signedIn) || !lacksCurrentConsents(profile)) return null;

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/60 px-4 py-2 text-sm"
      data-testid="legal-consents-notice"
    >
      <FileCheck2 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 basis-60 break-words">{t('leaseWizardGuide.adminNotice.message')}</span>
      <Link
        to="/onboarding"
        className="inline-flex min-h-11 shrink-0 items-center rounded-md font-semibold underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
      >
        {t('leaseWizardGuide.adminNotice.action')}
      </Link>
    </div>
  );
}
