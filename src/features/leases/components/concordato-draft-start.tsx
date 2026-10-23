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
import { useCreateConcordatoDraft } from '@/queries/use-leases';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/**
 * A canone concordato contract is prepared with the partner (ConcordatoFacile): here only its property is asked, and a real draft
 * is saved at once, so the contract has its leaseId (the reference the partner links the practice to) before anything else. No
 * APE, parties, rent or dates: they come from the partner's contract.
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
  const createDraft = useCreateConcordatoDraft();

  const create = async () => {
    if (!propertyId || createDraft.isPending) return;
    try {
      const leaseId = await createDraft.mutateAsync(propertyId);
      navigate(`/app/long-rent/leases/${leaseId}`);
    } catch {
      // useCreateConcordatoDraft.onError says why; the property stays chosen to try again on the same draft.
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
              <span className="flex-1">{t('leases.concordato.noProperties')}</span>
              <Button asChild variant="outline" size="sm">
                <Link to={LONG_RENT_PROPERTY_CREATE_PATH}>{t('leases.form.createProperty')}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <p className="text-sm text-foreground/70">{t('leases.concordato.whatHappens')}</p>

      <Button type="submit" disabled={!propertyId} loading={createDraft.isPending} data-testid="concordato-draft-create">
        {createDraft.isPending ? t('leases.form.creating') : t('leases.concordato.create')}
      </Button>
    </form>
  );
}
