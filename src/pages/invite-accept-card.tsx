import type { ReactNode } from 'react';
import { CheckCircle2, Link2Off, MailOpen, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
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
  children?: ReactNode;
}

/**
 * The card of the page where an invited person accepts (`/invite/accept`): one icon, one title, a line, and what the person can do. Every
 * state of the page is this card with other words, so there is always a title and a way on, never an empty screen. It sits alone on the
 * screen: the person is not in the app yet, and has no menu to look at.
 */
export function InviteAcceptCard({ tone = 'invite', title, description, children }: InviteAcceptCardProps) {
  const { icon: Icon, disc } = TONES[tone];
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4" data-testid="invite-accept-page" data-state={tone}>
      <Card className="w-full min-w-0 max-w-md">
        <CardHeader className="text-center">
          <div className={cn('mx-auto mb-4 grid size-16 place-items-center rounded-full', disc)}>
            <Icon aria-hidden="true" className="size-8" />
          </div>
          <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight">{title}</h1>
          {description ? <CardDescription className="break-words">{description}</CardDescription> : null}
        </CardHeader>
        {children ? <CardContent className="min-w-0 space-y-4">{children}</CardContent> : null}
      </Card>
    </main>
  );
}
