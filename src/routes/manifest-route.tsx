import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { ROUTE_MANIFEST, type RouteManifestEntry } from '@/config/route-manifest';
import { LoadingScreen } from '@/components/shared/loading-screen';

const LAZY_ROUTE_COMPONENTS: Record<string, LazyExoticComponent<ComponentType>> = Object.fromEntries(
  ROUTE_MANIFEST.map((entry) => [entry.path, lazy(entry.component)]),
);

export function ManifestRoute({ entry }: { entry: RouteManifestEntry }) {
  const Component = LAZY_ROUTE_COMPONENTS[entry.path];
  return (
    // Inside the content region of the shell (it scrolls with the window): the spinner fills it, not the viewport.
    <Suspense fallback={<LoadingScreen className="h-auto flex-1" />}>
      <Component />
    </Suspense>
  );
}
