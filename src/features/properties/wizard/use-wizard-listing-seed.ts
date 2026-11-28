import { usePropertyRooms, useStayDiscounts } from '@/queries/use-listing-data';
import { usePropertyPhotoMeta, useSiteProfile } from '@/queries/use-site-profile';
import type { WizardListingSeed } from './property-wizard-model';

export function useWizardListingSeed(propertyId: string, enabled: boolean) {
  const target = enabled ? propertyId : undefined;
  const rooms = usePropertyRooms(target, { fresh: true });
  const stayDiscounts = useStayDiscounts(target, { fresh: true });
  const siteProfile = useSiteProfile(target, { fresh: true });
  const photoMeta = usePropertyPhotoMeta(target, { fresh: true });

  const all = [rooms, stayDiscounts, siteProfile, photoMeta];
  const failed = all.find((query) => query.isError && query.data === undefined);
  const seed: WizardListingSeed | null =
    rooms.data && stayDiscounts.data && siteProfile.data && photoMeta.data
      ? { rooms: rooms.data, stayDiscounts: stayDiscounts.data, siteProfile: siteProfile.data, photoMeta: photoMeta.data }
      : null;

  return {
    seed,
    failed: failed !== undefined,
    error: failed?.error ?? null,
    retry: () => {
      for (const query of all) if (query.isError) void query.refetch();
    },
  };
}
