import { useProperty } from '@/queries/use-properties';

/**
 * The name of the property the wizard is about, for the screens that say which property the sender is changed for: the header of the page, the summary before the change and the
 * result. It is asked only once the sender of the property was read (`enabled`): a property that the caller does not reach answers 403 to every read, and a 403 on a read sends the
 * whole app to the no-access page, so the name of such a property is never asked. It comes from the cache when the page of the property (or the list) already read it, and a name that
 * cannot be read is left out: the wizard works without it.
 */
export function useSenderPropertyName(propertyId: string, enabled: boolean): string | undefined {
  const property = useProperty(enabled ? propertyId : '');
  const name = property.data?.name?.trim();
  return name ? name : undefined;
}
