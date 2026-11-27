import { useId, useState } from 'react';
import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { useChannelTemplates, useMessageTemplates, useRenderTemplate } from '@/queries/use-message-thread';

interface TemplatePickerProps {
  threadKey: string;
  /** The conversation is one of a channel: the channel's own templates are offered too. */
  withChannelTemplates: boolean;
  /** Puts a text in the draft; the host reads it and edits it before it is sent. */
  onInsert: (text: string) => void;
}

const ROW =
  'flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

/**
 * The templates the composer offers (NF-63): the host's own, which the server fills in for this conversation (the guest, the property, the
 * dates; a variable the conversation has no value for comes back as a sentence that names it, and nothing is inserted), and, for a
 * conversation of a channel, the templates the channel keeps, read only, which are copied as they are. What is chosen goes in the draft
 * and is never sent by itself. Nothing is read until the list is opened. The interface says «del canale» and never who keeps them (NF-12).
 */
export function TemplatePicker({ threadKey, withChannelTemplates, onInsert }: TemplatePickerProps) {
  const { t } = useTranslation();
  const mineId = useId();
  const channelId = useId();
  const [open, setOpen] = useState(false);
  const mine = useMessageTemplates(open);
  const channel = useChannelTemplates(threadKey, open && withChannelTemplates);
  const render = useRenderTemplate(threadKey);

  const choose = (templateId: string) =>
    render.mutate(templateId, {
      onSuccess: (rendered) => {
        onInsert(rendered.text);
        setOpen(false);
      },
    });

  const templates = Array.isArray(mine.data) ? mine.data : [];
  const channelTemplates = Array.isArray(channel.data) ? channel.data : [];

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) render.reset();
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" data-testid="template-picker-trigger">
          <FileText className="size-4" aria-hidden="true" />
          {t('messages.composer.templates')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-4" data-testid="template-picker">
        <section aria-labelledby={mineId} className="space-y-1">
          <h3 id={mineId} className="text-sm font-semibold">
            {t('messages.template.mine')}
          </h3>
          {mine.isPending ? (
            <div role="status" aria-busy="true">
              <span className="sr-only">{t('messages.template.loading')}</span>
              <Skeleton className="h-9 w-full motion-reduce:animate-none" aria-hidden="true" />
            </div>
          ) : mine.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {t('messages.template.loadError')}
            </p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('messages.template.empty')}</p>
          ) : (
            <ul className="space-y-0.5">
              {templates.map((template) => (
                <li key={template.id}>
                  <button type="button" className={ROW} disabled={render.isPending} onClick={() => choose(template.id)} data-testid="template-option">
                    <span className="min-w-0 truncate font-medium">{template.name}</span>
                    <span className="shrink-0 text-xs uppercase text-muted-foreground">{template.language}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {render.isError ? (
            <p className="text-sm text-destructive" role="alert" data-testid="template-render-problem">
              {getProblemMessage(render.error, t) ?? t('messages.template.renderError')}
            </p>
          ) : null}
        </section>

        {withChannelTemplates ? (
          <section aria-labelledby={channelId} className="space-y-1">
            <h3 id={channelId} className="text-sm font-semibold">
              {t('messages.template.channel')}
            </h3>
            <p className="text-xs text-muted-foreground">{t('messages.template.channelHint')}</p>
            {channel.isPending ? (
              <Skeleton className="h-9 w-full motion-reduce:animate-none" aria-hidden="true" />
            ) : channel.isError ? (
              <p className="text-sm text-muted-foreground">{t('messages.template.channelUnavailable')}</p>
            ) : channelTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('messages.template.channelEmpty')}</p>
            ) : (
              <ul className="space-y-0.5">
                {channelTemplates.map((template) => (
                  <li key={`${template.name}-${template.text.length}`}>
                    <button
                      type="button"
                      className={ROW}
                      onClick={() => {
                        onInsert(template.text);
                        setOpen(false);
                      }}
                      data-testid="channel-template-option"
                    >
                      <span className="min-w-0 truncate font-medium">{template.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
