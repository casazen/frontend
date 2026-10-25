import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { getProblemMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { LONG_RENT_PROPERTY_CREATE_PATH } from '@/features/properties/long-rent/paths';
import { useProperties } from '@/queries/use-properties';
import { useCreateCfDraft } from '@/queries/use-leases';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/**
 * «Parto da zero» of a canone concordato: the contract is prepared with the partner (ConcordatoFacile). Here only its property is
 * asked, and a real draft is saved at once (`POST /leases/drafts/concordatofacile`: an imported draft marked as the partner's, one per
 * property, so a second click or a second visit opens the same one), so the contract has its leaseId (the reference the partner links the
 * practice to) before anything else; then the person goes straight to the page of the service (pay it, or use the practice that is a
 * gift, and open the partner's form with our signed link). No APE, parties, rent or dates: they come from the partner's contract, which
 * comes back to this draft to be read and imported (`CfImportPanel`).
 */
export function ConcordatoDraftStart({ defaultPropertyId }: { defaultPropertyId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const selectId = useId();
  const { data, isLoading, isError, error, refetch, isFetching } = useProperties({ mode: 'long' });
  const properties = data ?? [];
  const noProperties = !isLoading && !isError && data !== undefined && properties.length === 0;
  // Null until the person picks one: then the property of the link "new contract" of a property page, once it is in the list.
  const [chosen, setChosen] = useState<string | null>(null);
  const propertyId = chosen ?? (defaultPropertyId && properties.some((property) => property.id === defaultPropertyId) ? defaultPropertyId : '');
  const createDraft = useCreateCfDraft();

  const create = async () => {
    if (!propertyId || createDraft.isPending) return;
    try {
      const draft = await createDraft.mutateAsync(propertyId);
      // Replaced, not pushed: "back" from the page of the service must not land on this form again.
      navigate(`/app/long-rent/leases/${draft.id}/concordatofacile`, { replace: true });
    } catch {
      // useCreateCfDraft.onError says why; the property stays chosen to try again (the server gives back the draft it made).
    }
  };

  return (
    <form
      className={cn(FOCUS_COLUMN, 'space-y-4')}
      data-testid="concordato-draft-start"
      onSubmit={(event) => {
        event.preventDefault();
        void create();
      }}
    >
      {isError ? (
        <div
          role="alert"
          data-testid="concordato-properties-error"
          className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{getProblemMessage(error, t) ?? t('leases.form.propertiesLoadError')}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {t('leases.form.retry')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={selectId}>{t('leases.form.propertyLabel')}</Label>
          <select
            id={selectId}
            value={propertyId}
            onChange={(event) => setChosen(event.target.value)}
            aria-busy={isLoading}
            disabled={createDraft.isPending}
            className={SELECT_CLASS}
          >
            <option value="">{isLoading ? t('leases.form.propertiesLoading') : t('leases.form.selectProperty')}</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name} — {property.city}
              </option>
            ))}
          </select>
          {noProperties ? (
            <div
              role="status"
              data-testid="concordato-no-properties"
              className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
            >
              <span className="flex-1">{t('leaseWizard.start.concordato.noProperties')}</span>
              <Button asChild variant="outline" size="sm">
                <Link to={LONG_RENT_PROPERTY_CREATE_PATH}>{t('leases.form.createProperty')}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <p className="text-sm text-foreground/70">{t('leaseWizard.start.concordato.whatHappens')}</p>

      <Button type="submit" disabled={!propertyId} loading={createDraft.isPending} data-testid="concordato-draft-create">
        {createDraft.isPending ? t('leases.form.creating') : t('leaseWizard.start.continue')}
      </Button>
    </form>
  );
}
