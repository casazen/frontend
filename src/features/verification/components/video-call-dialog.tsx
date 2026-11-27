import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Video } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { isFeatureEnabled } from '@/config/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import {
  VIDEO_CALL_URL_MAX_LENGTH,
  VIDEO_CALL_URL_PLACEHOLDER,
  classifyVideoCallError,
  isMeetingUrl,
  videoCallProblemKey,
  type VideoCallProblem,
} from '../lib/video-call-model';

/** What decides a verification: the same permission the server asks for the queue and for the video call (`verification.decision`). */
const DECISION_PERMISSION = 'verification.decision';

interface VideoCallFormProps {
  guestName: string;
  /** The e-mail with the link is being queued (this dialog or another action of the card): nothing here can start another. */
  pending: boolean;
  /** Sends the link to the guest. It resolves when the e-mail was queued and rejects with the answer of the API otherwise. */
  onSend: (url: string) => Promise<unknown>;
  onCancel: () => void;
}

/**
 * The inside of the dialog. It is a component of its own so that the address that was typed is forgotten when the dialog closes (the content of a Radix dialog is unmounted with it) and is
 * not there the next time it opens: nothing of the link stays in this page once it has gone to the guest.
 */
function VideoCallForm({ guestName, pending, onSend, onCancel }: VideoCallFormProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<VideoCallProblem | null>(null);

  const missing = url.trim() === '';
  // The shape is checked here before anything leaves; the server decides again, and its refusal is shown in the same place.
  const fieldError =
    tried && missing
      ? t('verification.videoCall.errors.required')
      : problem === 'invalid_url' || (tried && !missing && !isMeetingUrl(url))
        ? t(videoCallProblemKey('invalid_url'))
        : undefined;

  const submit = async (event: FormEvent) => {
    // The dialog is drawn outside the card but sits inside it for React: the form of the dialog is the only one that submits.
    event.preventDefault();
    event.stopPropagation();
    setTried(true);
    setProblem(null);
    if (pending || !isMeetingUrl(url)) return;

    try {
      await onSend(url.trim());
    } catch (error) {
      setProblem(classifyVideoCallError(error));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4" data-testid="verification-video-call-form">
      <DialogHeader>
        <DialogTitle>{t('verification.videoCall.title', { name: guestName })}</DialogTitle>
        <DialogDescription>{t('verification.videoCall.description')}</DialogDescription>
      </DialogHeader>

      <Field label={t('verification.videoCall.linkLabel')} hint={t('verification.videoCall.linkHint')} error={fieldError}>
        <Input
          data-testid="verification-video-call-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={VIDEO_CALL_URL_MAX_LENGTH}
          placeholder={VIDEO_CALL_URL_PLACEHOLDER}
          value={url}
          disabled={pending}
          onChange={(event) => {
            setUrl(event.target.value);
            setProblem(null);
          }}
        />
      </Field>

      {problem !== null && problem !== 'invalid_url' && (
        <Alert variant="danger" data-testid="verification-video-call-error" data-problem={problem}>
          {t(videoCallProblemKey(problem))}
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          {t('shared.cancel')}
        </Button>
        <Button type="submit" loading={pending} disabled={pending} data-testid="verification-video-call-send">
          {pending ? t('verification.videoCall.sending') : t('verification.videoCall.send')}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface VideoCallDialogProps extends Omit<VideoCallFormProps, 'onCancel'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The dialog of the video call (E22/F02/US01/T02): the operator pastes the address of a meeting they made with the tool they use, and CasaZen sends it to the guest by e-mail. Then the verification
 * waits as it did: the decision after the call is the usual approval or rejection, with its note. The address is not kept here once it has gone, and not shown again.
 *
 * While the e-mail is being queued the dialog cannot be closed by any way a dialog has (the cross, the Escape key, a click outside, the grip of the sheet on a phone, which all ask `onOpenChange`
 * with `false`): what the server answers, a refusal included, is told in this dialog, and a dialog that had gone would take the answer with it.
 */
export function VideoCallDialog({ open, onOpenChange, guestName, pending, onSend }: VideoCallDialogProps) {
  const requestOpen = (next: boolean) => {
    if (!next && pending) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={requestOpen}>
      <DialogContent>
        <VideoCallForm
          guestName={guestName}
          pending={pending}
          onCancel={() => onOpenChange(false)}
          onSend={async (url) => {
            await onSend(url);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

interface VideoCallActionProps {
  /** The guest of the verification, named in the dialog. */
  guestName: string;
  /** Another write of the card is in flight: the button stays disabled until it ends. */
  busy: boolean;
  /** The e-mail with the link is being queued. */
  pending: boolean;
  /** Sends the link; resolves when the e-mail was queued, rejects with the answer of the API otherwise. */
  onSend: (url: string) => Promise<unknown>;
}

function PermittedVideoCallAction({ guestName, busy, pending, onSend }: VideoCallActionProps) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  // The server decides again (404 for a verification outside the reach of the caller): this keeps the button off the page of who may not decide.
  if (!hasPermission('short-rent', DECISION_PERMISSION)) return null;

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} disabled={busy} data-testid="verification-video-call">
        <Video className="mr-2 h-4 w-4" aria-hidden="true" />
        {t('verification.videoCall.button')}
      </Button>
      {sent && (
        <p role="status" className="self-center text-sm text-muted-foreground" data-testid="verification-video-call-sent">
          {t('verification.videoCall.sentNote')}
        </p>
      )}
      <VideoCallDialog
        open={open}
        onOpenChange={setOpen}
        guestName={guestName}
        pending={pending}
        onSend={async (url) => {
          await onSend(url);
          setSent(true);
        }}
      />
    </>
  );
}

/**
 * The «Videochiamata» action of a verification of the queue: shown only while the identity verification is on (the flag `checkInIdentityVerification`: the backend answers 404 to the call while it
 * is off, and with it off the queue is the one it always was) and only to who holds `verification.decision`, the permission that opens the queue and decides its verifications.
 */
export function VideoCallAction(props: VideoCallActionProps) {
  const { flags } = useFeatureFlags();
  if (!isFeatureEnabled(flags, 'checkInIdentityVerification')) return null;
  return <PermittedVideoCallAction {...props} />;
}
