import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { CIN_FORMAT_MESSAGE_KEY, isEmptyOrValidCin, normalizeCin } from '@/lib/cin-format';
import { useUpdatePropertyCin } from '@/queries/use-cin';

interface CinSectionProps {
  propertyId: string;
  /** The CIN the property has, as the server stores it. */
  storedCin: string | null;
  /** The page where the CIN is asked for, as the activation gives it (`linkUrl` of its `cin` step). */
  guidanceUrl?: string | null;
}

/** Id of the input: «Correggi» of the missing list puts the focus here. */
export const CIN_INPUT_ID = 'property-wizard-cin';

/**
 * The CIN, saved on its own (`PUT …/cin`, the format checked as everywhere else) so that what is missing is read again at once. It is
 * never a reason to stop: without it the property is saved as «Da completare» and the host finishes later.
 */
export function CinSection({ propertyId, storedCin, guidanceUrl }: CinSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const update = useUpdatePropertyCin();
  // null = not touched: the field shows the stored CIN.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const changed = draft !== null && normalizeCin(draft) !== normalizeCin(storedCin);

  const save = async () => {
    if (!isEmptyOrValidCin(draft)) {
      setError(t(CIN_FORMAT_MESSAGE_KEY));
      return;
    }
    try {
      await update.mutateAsync({ propertyId, cinCode: normalizeCin(draft) });
    } catch {
      return; // The toast of the mutation tells why; the field keeps what was typed.
    }
    setDraft(null);
    void queryClient.invalidateQueries({ queryKey: ['compliance', 'activation', propertyId] });
  };

  return (
    <section id="property-wizard-section-cin" tabIndex={-1} aria-labelledby="property-wizard-cin-title" className="min-w-0 space-y-3 outline-none">
      <h3 id="property-wizard-cin-title" className="text-base font-semibold">
        {t('propertyWizard.last.cin.title')}
      </h3>
      <Field label={t('propertyWizard.last.cin.label')} hint={t('propertyWizard.last.cin.hint')} error={error} className="max-w-md">
        <Input
          id={CIN_INPUT_ID}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          placeholder={t('property.form.cin.placeholder')}
          value={draft ?? storedCin ?? ''}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => void save()} disabled={!changed} loading={update.isPending} data-testid="property-wizard-cin-save">
          {t('propertyWizard.last.cin.save')}
        </Button>
        {guidanceUrl ? (
          <a
            href={guidanceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            data-testid="property-wizard-cin-guidance"
          >
            {t('compliance.activation.cinGuidance')}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : null}
      </div>
    </section>
  );
}
