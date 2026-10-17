import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getProblemMessage } from '@/lib/api-errors';
import { copyTextToClipboard } from '@/lib/utils';
import { useCopyOrgInvitationLink } from '@/queries/use-org-team';

/**
 * «Copia il link» of an invitation: asks for a fresh link (the secret, which also stops the one of the email from working), puts it
 * on the clipboard and says so. The link is never shown, kept or logged here: it goes from the answer to the clipboard and the
 * mutation forgets it. A refusal (the invitation is not pending any more) is told with the message of the server.
 */
export function useCopyInvitationLink() {
  const { t } = useTranslation();
  const { mutateAsync, reset, isPending } = useCopyOrgInvitationLink();

  const copyLink = useCallback(
    async (invitationId: string) => {
      try {
        const link = await mutateAsync(invitationId);
        await copyTextToClipboard(link.url);
        toast.success(t('team.link.copied'), { description: t('team.link.copiedHint') });
      } catch (error) {
        toast.error(getProblemMessage(error, t) ?? t('team.link.failed'));
      } finally {
        reset();
      }
    },
    [mutateAsync, reset, t],
  );

  return { copyLink, copying: isPending };
}
