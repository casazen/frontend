import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { ROUTE_MANIFEST, type RouteManifestEntry } from '@/config/route-manifest';
import { LoadingScreen } from '@/components/shared/loading-screen';

const LAZY_ROUTE_COMPONENTS: Record<string, LazyExoticComponent<ComponentType>> = Object.fromEntries(
  ROUTE_MANIFEST.map((entry) => [entry.path, lazy(entry.component)]),
);

export function ManifestRoute({ entry }: { entry: RouteManifestEntry }) {
  const Component = LAZY_ROUTE_COMPONENTS[entry.path];
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Component />
    </Suspense>
  );
}
