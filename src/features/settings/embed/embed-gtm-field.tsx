import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { getProblemMessage } from '@/lib/api-errors';
import type { OrgDomainConfig } from '@/types/domain.types';
import { readGtmDraft, useTrackingSettings } from './use-tracking-settings';

interface EmbedGtmFieldProps {
  orgId: string;
  config: OrgDomainConfig;
}

/**
 * The Google Tag Manager container of the agency (E41/F03/US01, NF-149), one field in a quiet row: `GTM-` and 4 to 12 letters or digits, trimmed and upper-cased, checked here
 * before any request is made. Saving an empty field clears the container. A refusal of the server is shown under the field with its own words. The field follows what the server
 * holds: it shows the saved value when the page opens (and after a reload), and the value as the server stored it after a save. While a save is on its way the field and the button are off.
 */
export function EmbedGtmField({ orgId, config }: EmbedGtmFieldProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const { saved, save } = useTrackingSettings(orgId, config);
  const [draft, setDraft] = useState(saved ?? '');
  const [formatError, setFormatError] = useState(false);

  // The field follows the server: adjusted while rendering when the saved value changes (a save, a read again, another visit), never in an effect.
  const [syncedFrom, setSyncedFrom] = useState(saved);
  if (saved !== syncedFrom) {
    setSyncedFrom(saved);
    setDraft(saved ?? '');
    setFormatError(false);
  }

  const dirty = draft.trim().toUpperCase() !== (saved ?? '');
  const serverError = save.isError ? (getProblemMessage(save.error, t) ?? t('embed.settings.gtm.failed')) : undefined;

  const handleChange = (value: string) => {
    setDraft(value);
    if (formatError) setFormatError(false);
    if (save.isError) save.reset();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (save.isPending) return;
    const value = readGtmDraft(draft);
    if (value.state === 'invalid') {
      setFormatError(true);
      return;
    }
    save.mutate(value.state === 'valid' ? value.id : null);
  };

  return (
    <section className="space-y-3" aria-labelledby={titleId} data-testid="embed-gtm">
      <h2 id={titleId} className="text-sm font-semibold">
        {t('embed.settings.gtm.title')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('embed.settings.gtm.description')}</p>
      <form onSubmit={handleSubmit} noValidate className="max-w-sm space-y-3">
        <Field label={t('embed.settings.gtm.label')} hint={t('embed.settings.gtm.hint')} error={formatError ? t('embed.settings.gtm.invalid') : serverError}>
          <Input
            value={draft}
            onChange={(event) => handleChange(event.target.value)}
            placeholder={t('embed.settings.gtm.placeholder')}
            autoComplete="off"
            spellCheck={false}
            disabled={save.isPending}
            data-testid="embed-gtm-input"
          />
        </Field>
        <Button type="submit" variant="outline" disabled={save.isPending || !dirty} loading={save.isPending} data-testid="embed-gtm-save">
          {t('embed.settings.gtm.save')}
        </Button>
      </form>
    </section>
  );
}
