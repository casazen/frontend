import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import type { ChannelAccountHolder, Property } from '@/types';
import { holderChangesRequest, holderChoiceOf, holderKey } from '../billing-wizard-model';
import { ACCOUNT_HOLDER_PORTALS, type BillingWizardValues, type HolderChoice } from '../billing-wizard-schema';

interface AccountHolderTableProps {
  /** The listings of the organization, by name. */
  properties: readonly Pick<Property, 'id' | 'name'>[];
  /** The holders the server has where they differ from the default. */
  overrides: readonly ChannelAccountHolder[];
}

const CHOICES: readonly HolderChoice[] = ['default', 'Owner', 'Agency'];
const ALL_PORTALS = 'all';

/**
 * The table «annuncio × portale» of the step «Commissioni dei canali» (E14/F01/US01/T01, ⚖ I10): who holds the account of each listing on each portal, where it is not the
 * default of the organization. A cell says «come l'organizzazione» until it is given a holder of its own; the bulk bar sets one portal (or all) for the listings that are
 * ticked, so that a hundred flats are one action. Nothing is sent from here: the changes wait in the form and are saved with «Continua», in one write.
 */
export function AccountHolderTable({ properties, overrides }: AccountHolderTableProps) {
  const { t } = useTranslation();
  const { control, getValues, setValue } = useFormContext<BillingWizardValues>();
  const changes = useWatch({ control, name: 'holderChanges' });
  const defaultHolder = useWatch({ control, name: 'portalAccountHolder' });

  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkPortal, setBulkPortal] = useState<string>(ALL_PORTALS);
  const [bulkChoice, setBulkChoice] = useState<HolderChoice>('Agency');

  const choose = (propertyId: string, channel: string, choice: HolderChoice) => {
    setValue('holderChanges', { ...getValues('holderChanges'), [holderKey(propertyId, channel)]: choice }, { shouldDirty: true });
  };

  const applyToSelection = () => {
    const portals = bulkPortal === ALL_PORTALS ? ACCOUNT_HOLDER_PORTALS : ACCOUNT_HOLDER_PORTALS.filter((portal) => portal === bulkPortal);
    const next = { ...getValues('holderChanges') };
    for (const propertyId of selected) for (const portal of portals) next[holderKey(propertyId, portal)] = bulkChoice;
    setValue('holderChanges', next, { shouldDirty: true });
  };

  const toggle = (propertyId: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(propertyId);
      else next.delete(propertyId);
      return next;
    });
  const allSelected = properties.length > 0 && selected.size === properties.length;
  // What differs from what the server has: a cell the person put back to what it was is not a change.
  const pending = holderChangesRequest(changes, overrides)?.length ?? 0;
  const holderName = (holder: HolderChoice) => (holder === 'default' ? t('billingWizard.channels.exceptions.sameAsOrganization', { holder: t(`billingWizard.channels.holder.names.${defaultHolder}`) }) : t(`billingWizard.channels.holder.names.${holder}`));

  if (properties.length === 0) {
    return (
      <p className="text-sm text-foreground/70" data-testid="billing-holders-empty">
        {t('billingWizard.channels.exceptions.empty')}
      </p>
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="billing-holders-title" data-testid="billing-holders">
      <div className="space-y-1">
        <h3 id="billing-holders-title" className="text-base font-semibold">
          {t('billingWizard.channels.exceptions.title')}
        </h3>
        <p className="text-sm text-foreground/70">{t('billingWizard.channels.exceptions.hint')}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md bg-muted p-3" role="group" aria-label={t('billingWizard.channels.exceptions.bulk.label')} data-testid="billing-holders-bulk">
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="font-medium">{t('billingWizard.channels.exceptions.bulk.portal')}</span>
          <Select value={bulkPortal} onChange={(event) => setBulkPortal(event.target.value)} data-testid="billing-holders-bulk-portal">
            <option value={ALL_PORTALS}>{t('billingWizard.channels.exceptions.bulk.allPortals')}</option>
            {ACCOUNT_HOLDER_PORTALS.map((portal) => (
              <option key={portal} value={portal}>
                {t(`booking.source.${portal}`)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="font-medium">{t('billingWizard.channels.exceptions.bulk.holder')}</span>
          <Select value={bulkChoice} onChange={(event) => setBulkChoice(event.target.value as HolderChoice)} data-testid="billing-holders-bulk-holder">
            {CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {holderName(choice)}
              </option>
            ))}
          </Select>
        </label>
        <Button type="button" variant="outline" disabled={selected.size === 0} onClick={applyToSelection} data-testid="billing-holders-bulk-apply">
          {t('billingWizard.channels.exceptions.bulk.apply', { count: selected.size })}
        </Button>
      </div>

      <div className="min-w-0 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[40rem] text-left text-sm" data-testid="billing-holders-table">
          <caption className="sr-only">{t('billingWizard.channels.exceptions.caption')}</caption>
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-foreground/70">
            <tr>
              <th scope="col" className="w-10 px-3 py-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(on) => setSelected(on === true ? new Set(properties.map((property) => property.id)) : new Set())}
                  aria-label={t('billingWizard.channels.exceptions.selectAll')}
                  data-testid="billing-holders-select-all"
                />
              </th>
              <th scope="col" className="px-3 py-2">
                {t('billingWizard.channels.exceptions.listing')}
              </th>
              {ACCOUNT_HOLDER_PORTALS.map((portal) => (
                <th key={portal} scope="col" className="px-3 py-2">
                  {t(`booking.source.${portal}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {properties.map((property) => (
              <tr key={property.id} data-testid={`billing-holders-row-${property.id}`}>
                <td className="px-3 py-2">
                  <Checkbox
                    checked={selected.has(property.id)}
                    onCheckedChange={(on) => toggle(property.id, on === true)}
                    aria-label={t('billingWizard.channels.exceptions.selectListing', { name: property.name })}
                  />
                </td>
                <th scope="row" className="max-w-[14rem] break-words px-3 py-2 font-medium">
                  {property.name}
                </th>
                {ACCOUNT_HOLDER_PORTALS.map((portal) => (
                  <td key={portal} className="px-3 py-2">
                    <Select
                      size="sm"
                      value={holderChoiceOf(property.id, portal, changes, overrides)}
                      onChange={(event) => choose(property.id, portal, event.target.value as HolderChoice)}
                      aria-label={t('billingWizard.channels.exceptions.cell', { name: property.name, portal: t(`booking.source.${portal}`) })}
                      data-testid={`billing-holder-${property.id}-${portal}`}
                    >
                      {CHOICES.map((choice) => (
                        <option key={choice} value={choice}>
                          {holderName(choice)}
                        </option>
                      ))}
                    </Select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pending > 0 ? (
        <p role="status" className="text-sm" data-testid="billing-holders-pending">
          {t('billingWizard.channels.exceptions.pending', { count: pending })}
        </p>
      ) : null}
    </section>
  );
}
