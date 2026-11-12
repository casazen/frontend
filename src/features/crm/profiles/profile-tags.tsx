import { useId, useState, type FormEvent } from 'react';
import { AlertCircle, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSaveProfileTags } from '@/queries/crm';

/** Most tags a profile holds, and the longest tag: what the server accepts (ADR-021-R9). */
const MAX_TAGS = 50;
const MAX_TAG_LENGTH = 40;

interface ProfileTagsProps {
  profileId: string;
  tags: string[];
  /** The caller may change the tags (`guest.write`); without it they are shown and nothing more. */
  canWrite: boolean;
}

/**
 * The tags of a profile (E07/F01/US04/T02): the host's own words for finding a guest again and for the audiences of the campaigns. Each
 * add or removal is saved at once with the whole list (`PUT`), so nothing is left to save and nothing is lost; the controls wait while a
 * save is on its way, so two changes never cross. At most 50, each 1 to 40 characters, no two alike (the server checks it too).
 */
export function ProfileTags({ profileId, tags, canWrite }: ProfileTagsProps) {
  const { t } = useTranslation();
  const save = useSaveProfileTags();
  const inputId = useId();
  const errorId = useId();
  const [draft, setDraft] = useState('');
  const [duplicate, setDuplicate] = useState(false);
  const full = tags.length >= MAX_TAGS;

  const add = (event: FormEvent) => {
    event.preventDefault();
    const tag = draft.trim();
    if (!tag || full || save.isPending) return;
    if (tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      setDuplicate(true);
      return;
    }
    save.mutate({ id: profileId, tags: [...tags, tag] }, { onSuccess: () => setDraft('') });
  };

  const remove = (tag: string) => {
    if (save.isPending) return;
    save.mutate({ id: profileId, tags: tags.filter((existing) => existing !== tag) });
  };

  return (
    <PlainSection title={t('crm.tags.title')} count={tags.length} data-testid="crm-tags-section">
      <p className="text-sm text-foreground/70">{t('crm.tags.description')}</p>

      {tags.length === 0 ? (
        <p className="text-sm text-foreground/70" data-testid="crm-tags-empty">
          {t('crm.tags.empty')}
        </p>
      ) : (
        <ul role="list" aria-label={t('crm.tags.title')} className="flex flex-wrap gap-2" data-testid="crm-tags-list">
          {tags.map((tag) => (
            <li key={tag} className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted py-1 pl-3 pr-1 text-sm">
              <span className="min-w-0 break-words">{tag}</span>
              {canWrite ? (
                <button
                  type="button"
                  aria-label={t('crm.tags.remove', { tag })}
                  disabled={save.isPending}
                  onClick={() => remove(tag)}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-foreground/70 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 pointer-coarse:size-11"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : (
                <span className="pr-2" />
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && full ? (
        <p className="text-sm text-foreground/70" data-testid="crm-tags-full">
          {t('crm.tags.limit', { count: MAX_TAGS })}
        </p>
      ) : null}

      {canWrite && !full ? (
        <form onSubmit={add} className="space-y-1" data-testid="crm-tags-form">
          <label htmlFor={inputId} className="sr-only">
            {t('crm.tags.addLabel')}
          </label>
          <div className="flex gap-2">
            <Input
              id={inputId}
              value={draft}
              maxLength={MAX_TAG_LENGTH}
              placeholder={t('crm.tags.addPlaceholder')}
              autoComplete="off"
              disabled={save.isPending}
              aria-invalid={duplicate || undefined}
              aria-describedby={duplicate ? errorId : undefined}
              onChange={(event) => {
                setDraft(event.target.value);
                setDuplicate(false);
              }}
            />
            <Button type="submit" variant="outline" loading={save.isPending} disabled={draft.trim() === ''}>
              <Plus className="size-4" aria-hidden="true" />
              {t('crm.tags.add')}
            </Button>
          </div>
          {duplicate ? (
            <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-[color:var(--color-danger-foreground,#b4232a)]">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0">{t('crm.tags.duplicate')}</span>
            </p>
          ) : null}
        </form>
      ) : null}
    </PlainSection>
  );
}
