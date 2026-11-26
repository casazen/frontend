import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { matchesSearch } from '@/components/shared/list-view/list-data';
import { useProperties } from '@/queries/use-properties';
import { propertyTabPath, propertyWizardPath } from '@/features/properties/properties-paths';

import type { TFunction } from 'i18next';

export function propertySettingsOptions(t: TFunction, query: string, canEdit: boolean) {
  const title = t('workspaceView.propertySettings');
  return [
    ...(canEdit ? [
      { label: t('propertyWizard.steps.rules.label'), to: (id: string) => propertyWizardPath(id, 'rules') },
      { label: t('property.form.amenities.title'), to: (id: string) => propertyWizardPath(id, 'amenities') },
      { label: t('propertyWizard.steps.prices.label'), to: (id: string) => propertyWizardPath(id, 'prices') },
    ] : []),
    { label: t('property.detail.tabs.documents'), to: (id: string) => propertyTabPath(id, 'documents') },
    { label: t('property.detail.tabs.ical'), to: (id: string) => propertyTabPath(id, 'ical') },
  ].filter(option => matchesSearch(title + ' ' + option.label, query.trim()));
}

export function PropertySettingsLinks({ options, searching }: { options: ReturnType<typeof propertySettingsOptions>; searching: boolean }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState('');
  const title = t('workspaceView.propertySettings');
  const open = searching || expanded;
  const properties = useProperties({ mode: 'short' }, { enabled: open });
  if (!options.length) return null;
  const rows = properties.data ?? [];
  const id = rows.find(row => row.id === selected)?.id ?? (rows.length === 1 ? rows[0].id : '');
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2>
        <button type="button" className="flex min-h-11 w-full items-center gap-3 text-start font-semibold" onClick={() => setExpanded(!expanded)} aria-expanded={open} disabled={searching}>
          <Building2 aria-hidden="true" className="size-5" />
          {title}
          <ChevronDown aria-hidden="true" className={open ? 'ms-auto size-4 rotate-180' : 'ms-auto size-4'} />
        </button>
      </h2>
      {open && (
        <div className="grid gap-3 border-t pt-4">
          {properties.isError ? <div role="alert">{t('guestPortal.host.unavailable')} <Button variant="outline" onClick={() => void properties.refetch()}>{t('propertyWizard.page.retry')}</Button></div>
            : properties.isPending ? <p role="status">{t('guestPortal.host.loading')}</p>
            : !rows.length ? <p>{t('guestPortal.setup.noProperties')}</p>
            : <label className="grid max-w-md gap-1 text-sm font-medium">{t('workspaceView.property')}
                <select value={id} className="min-h-11 rounded-lg border bg-background px-3" onChange={e => setSelected(e.target.value)}>
                  {!id && <option value="">{t('workspaceView.chooseProperty')}</option>}
                  {rows.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
              </label>}
          {id && !properties.isError && <ul className="grid gap-x-5 sm:grid-cols-2">
            {options.map(option => <li key={option.to(id)}><Link className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 text-sm font-medium hover:bg-muted" to={option.to(id)}>
              {option.label}<ChevronRight aria-hidden="true" className="size-4" />
            </Link></li>)}
          </ul>}
        </div>
      )}
    </section>
  );
}
