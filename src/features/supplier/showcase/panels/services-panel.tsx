import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { useSupplierServices } from '@/queries/use-supplier-services';
import type { SupplierService } from '@/types/supplier-services';
import { SERVICES_PATH } from '../showcase-model';
import { planServices, SECTION_KEYS, sectionsOf, serviceOrderOf } from '../showcase-services';
import type { PanelProps } from './panel-types';

/**
 * "Servizi e sezioni" (SP-13d): which of the active services the page shows and in what order (an empty order is every active service in
 * the order of the catalog, so a service added later shows up by itself), and which blocks of the home are shown. A draft or a paused
 * service cannot be shown: it is listed apart with the reason and the way to "Servizi e prezzi". Moving is done with buttons; the
 * page says the new place and the focus stays on the button that was pressed.
 */
export function ServicesPanel({ doc, change }: PanelProps) {
  const { t } = useTranslation();
  const services = useSupplierServices();
  const items = services.data?.items;
  const plan = items ? planServices(items, doc.serviceOrder) : null;
  const sections = sectionsOf(doc.sections);

  const [announcement, setAnnouncement] = useState('');
  const pressed = useRef<{ id: string; action: 'up' | 'down' } | null>(null);
  const orderKey = plan ? plan.shown.map((service) => service.id).join(',') : '';

  // A moved row keeps the focus on the button that moved it (at the end of the list the other one takes it).
  useEffect(() => {
    const wanted = pressed.current;
    pressed.current = null;
    if (!wanted) return;
    const row = document.querySelector<HTMLElement>(`[data-service-id="${wanted.id}"]`);
    const same = row?.querySelector<HTMLButtonElement>(`[data-action="${wanted.action}"]`);
    (same && !same.disabled ? same : row?.querySelector<HTMLButtonElement>('[data-action]:not(:disabled)'))?.focus();
  }, [orderKey]);

  if (services.isLoading) {
    return (
      <p className="text-sm text-foreground/70" role="status" data-testid="supplier-showcase-services-loading">
        {t('supplier.showcase.editor.services.loading')}
      </p>
    );
  }
  if (services.isError || !items || !plan) {
    return (
      <div className="space-y-3" role="alert">
        <p className="text-sm">{t('supplier.showcase.editor.services.loadError')}</p>
        <Button type="button" variant="outline" onClick={() => void services.refetch()}>
          {t('supplier.showcase.editor.save.retry')}
        </Button>
      </div>
    );
  }

  const send = (shown: SupplierService[]) => change({ serviceOrder: serviceOrderOf(items, shown) });
  const show = (service: SupplierService) => send([...plan.shown, service]);
  const hide = (service: SupplierService) => send(plan.shown.filter((candidate) => candidate.id !== service.id));
  const move = (service: SupplierService, index: number, to: number, action: 'up' | 'down') => {
    if (to < 0 || to >= plan.shown.length) return;
    const next = [...plan.shown];
    [next[index], next[to]] = [next[to], next[index]];
    pressed.current = { id: service.id, action };
    setAnnouncement(t('supplier.showcase.editor.services.moved', { name: service.name, position: to + 1, total: next.length }));
    send(next);
  };

  const activeCount = plan.shown.length + plan.hidden.length;
  const onlyOne = plan.shown.length === 1;

  const row = (service: SupplierService, index: number | null) => {
    const isShown = index !== null;
    const switchId = `showcase-service-${service.id}`;
    return (
      <li
        key={service.id}
        data-service-id={service.id}
        data-shown={isShown}
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3"
        data-testid={`supplier-showcase-service-${service.slug}`}
      >
        <Switch
          id={switchId}
          checked={isShown}
          // The page cannot show none: an empty order means every service.
          disabled={isShown && onlyOne}
          onCheckedChange={(on) => (on ? show(service) : hide(service))}
        />
        <Label htmlFor={switchId} className="min-w-0 flex-1 basis-40 cursor-pointer break-words text-base leading-snug">
          {service.name}
          <span className="block text-sm font-normal text-foreground/70">{getServiceCategoryLabel(service.category, t)}</span>
        </Label>
        {isShown ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-action="up"
              disabled={index === 0}
              aria-label={t('reorderable.up', { item: service.name })}
              onClick={() => move(service, index, index - 1, 'up')}
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-action="down"
              disabled={index === plan.shown.length - 1}
              aria-label={t('reorderable.down', { item: service.name })}
              onClick={() => move(service, index, index + 1, 'down')}
            >
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="space-y-8" data-testid="supplier-showcase-panel-services">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t('supplier.showcase.editor.services.title')}</h2>
          <p className="text-sm text-foreground/70">{t('supplier.showcase.editor.services.hint')}</p>
        </div>

        {activeCount === 0 ? (
          <div className="space-y-3">
            <p className="text-sm">{t('supplier.showcase.editor.services.none')}</p>
            <Button asChild variant="outline">
              <Link to={SERVICES_PATH}>{t('supplier.showcase.editor.services.open')}</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="space-y-2" aria-label={t('supplier.showcase.editor.services.title')}>
              {plan.shown.map((service, index) => row(service, index))}
              {plan.hidden.map((service) => row(service, null))}
            </ul>
            {onlyOne ? <p className="text-sm text-foreground/70">{t('supplier.showcase.editor.services.keepOne')}</p> : null}
          </>
        )}
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>

        {plan.inactive.length > 0 ? (
          <div className="space-y-2 pt-2">
            <h3 className="text-base font-semibold">{t('supplier.showcase.editor.services.inactiveTitle')}</h3>
            <ul className="space-y-2">
              {plan.inactive.map((service) => (
                <li key={service.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed p-3 text-sm" data-testid={`supplier-showcase-service-${service.slug}`}>
                  <span className="min-w-0 flex-1 basis-40 break-words">
                    <span className="font-medium">{service.name}</span>
                    <span className="block text-foreground/70">{t(`supplier.showcase.editor.services.reason.${service.status}`)}</span>
                  </span>
                  <Link className="inline-flex min-h-11 items-center font-medium underline underline-offset-4" to={`${SERVICES_PATH}/${service.id}`}>
                    {t('supplier.showcase.editor.services.fix')}
                    <span className="sr-only"> {service.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t('supplier.showcase.editor.sections.title')}</h2>
          <p className="text-sm text-foreground/70">{t('supplier.showcase.editor.sections.hint')}</p>
        </div>
        <ul className="space-y-2">
          {SECTION_KEYS.map((key) => {
            const id = `showcase-section-${key}`;
            return (
              <li key={key} className="flex items-center gap-3 rounded-lg border p-3">
                <Switch id={id} checked={sections[key]} onCheckedChange={(on) => change({ sections: { ...sections, [key]: on } })} />
                <Label htmlFor={id} className="min-w-0 flex-1 cursor-pointer break-words text-base leading-snug">
                  {t(`supplier.showcase.editor.sections.${key}.name`)}
                  <span className="block text-sm font-normal text-foreground/70">{t(`supplier.showcase.editor.sections.${key}.hint`)}</span>
                </Label>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-foreground/70">{t('supplier.showcase.editor.sections.always')}</p>
      </section>
    </div>
  );
}
