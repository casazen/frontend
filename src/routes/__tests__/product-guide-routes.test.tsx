import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { appRoutes } from '@/routes';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { ContextRouteGuard } from '@/components/auth/context-route-guard';

describe('Product guide route boundaries', () => {
  for (const area of ['short-rent', 'long-rent', 'account', 'admin', 'supplier']) {
    it(`keeps ${area} guide inside both login and area guards`, () => {
      const matches = matchRoutes(appRoutes, `/app/${area}/help`)!;
      expect(matches.some(({ route }) => isValidElement(route.element) && route.element.type === ProtectedRoute)).toBe(true);
      const leaf = matches.at(-1)!.route.element;
      expect(isValidElement(leaf) && leaf.type === ContextRouteGuard).toBe(true);
      expect(isValidElement<{ contextKey: string }>(leaf) && leaf.props.contextKey).toBe(area);
    });
  }
});
