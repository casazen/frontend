import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SupplierService } from '@/types/supplier-services';
import { SERVICES_PATH } from '../showcase-model';

/**
 * The services that cannot be shown yet (drafts and paused ones): each with the reason and the way to its page in "Servizi e prezzi",
 * where it is finished or turned back on. Nothing here can be chosen.
 */
export function InactiveServices({ services }: { services: readonly SupplierService[] }) {
  const { t } = useTranslation();
  if (services.length === 0) return null;
  return (
    <div className="space-y-2 pt-2">
      <h3 className="text-base font-semibold">{t('supplier.showcase.editor.services.inactiveTitle')}</h3>
      <ul className="space-y-2">
        {services.map((service) => (
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
  );
}
