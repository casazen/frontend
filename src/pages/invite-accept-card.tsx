import type { ReactNode } from 'react';
import { CheckCircle2, Link2Off, MailOpen, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { CasaZenLogo } from '@/components/brand/casazen-mark';
import { cn } from '@/lib/utils';

/** How the card feels: an invitation to open, one that is done, one that does not work, one that needs something from the person. */
export type InviteCardTone = 'invite' | 'done' | 'broken' | 'attention';

const TONES: Record<InviteCardTone, { icon: LucideIcon; disc: string }> = {
  invite: { icon: MailOpen, disc: 'bg-primary text-primary-foreground' },
  done: { icon: CheckCircle2, disc: 'bg-success-soft text-success-foreground' },
  broken: { icon: Link2Off, disc: 'bg-muted text-foreground' },
  attention: { icon: TriangleAlert, disc: 'bg-warning-soft text-warning-foreground' },
};

interface InviteAcceptCardProps {
  tone?: InviteCardTone;
  title: string;
  description?: string;
  /** Invitation details stay above the actions on phones and beside them on wider screens. */
  summary?: ReactNode;
  children?: ReactNode;
}

/**
 * The card of the page where an invited person accepts (`/invite/accept`): one icon, one title, a line, and what the person can do. Every
 * state of the page is this card with other words, so there is always a title and a way on, never an empty screen. It sits alone on the
 * screen: the person is not in the app yet, and has no menu to look at.
 */
export function InviteAcceptCard({ tone = 'invite', title, description, summary, children }: InviteAcceptCardProps) {
  const { icon: Icon, disc } = TONES[tone];
  return (
    <main className="grid min-h-svh place-items-center bg-muted/50 p-4 sm:p-8" data-testid="invite-accept-page" data-state={tone}>
      <Card className={cn('w-full min-w-0 max-w-lg overflow-hidden rounded-3xl border-border bg-card shadow-lg', summary && 'max-w-2xl md:grid md:max-w-6xl md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]')}>
        <CardHeader className={cn('min-w-0 gap-3 border-t-4 border-primary px-6 pt-6 text-left sm:px-8 sm:pt-8', summary && 'p-4 sm:p-6 md:items-start md:border-r md:p-8 md:text-left')}>
          <CasaZenLogo size={28} />
          <div className={cn('mb-1 mt-4 grid size-12 place-items-center rounded-2xl', disc)}>
            <Icon aria-hidden="true" className="size-6" />
          </div>
          <h1 className="max-w-full break-words text-2xl font-semibold leading-tight tracking-tight">{title}</h1>
          {description ? <CardDescription className="max-w-full break-words">{description}</CardDescription> : null}
          {summary ? <div className="w-full pt-4 text-left">{summary}</div> : null}
        </CardHeader>
        {children ? <CardContent className={cn('min-w-0 space-y-3 px-6 pb-6 sm:px-8 sm:pb-8', summary && 'p-4 pt-0 sm:p-6 sm:pt-0 md:p-8')}>{children}</CardContent> : null}
      </Card>
    </main>
  );
}
