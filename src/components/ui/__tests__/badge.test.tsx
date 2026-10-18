import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

const classesOf = (variant?: ComponentProps<typeof Badge>['variant']) => {
  render(<Badge variant={variant}>label</Badge>);
  return screen.getByText('label').className.split(/\s+/);
};

describe('Badge (UI-01: semantic colors under the redesign, the same look without it)', () => {
  it.each([
    ['success', ['bg-green-500', 'text-white', 'hover:bg-green-600'], ['v2:bg-success-soft', 'v2:text-success-foreground', 'v2:border-success-border']],
    ['warning', ['bg-yellow-500', 'text-white', 'hover:bg-yellow-600'], ['v2:bg-warning-soft', 'v2:text-warning-foreground', 'v2:border-warning-border']],
  ] as const)('Badge_%s_KeepsItsClassesAndAddsTheRedesignOnes', (variant, legacy, redesign) => {
    const classes = classesOf(variant);
    // Without data-ui="v2" the `v2:` classes match nothing, so the badge is the one of today.
    for (const name of legacy) expect(classes).toContain(name);
    for (const name of redesign) expect(classes).toContain(name);
  });

  it.each([
    ['default', 'bg-primary'],
    ['secondary', 'bg-secondary'],
    ['destructive', 'bg-destructive'],
    ['outline', 'text-foreground'],
  ] as const)('Badge_%s_UsesTokensAlreadyAndHasNoRedesignOverride', (variant, token) => {
    const classes = classesOf(variant);
    expect(classes).toContain(token);
    expect(classes.filter((name) => name.startsWith('v2:'))).toEqual([]);
  });

  it('Badge_DefaultVariant_IsTheDefault', () => {
    expect(classesOf()).toContain('bg-primary');
  });

  it('Badge_CallerClassName_IsKept', () => {
    render(
      <Badge variant="warning" className="bg-orange-500 extra">
        label
      </Badge>,
    );
    const classes = screen.getByText('label').className.split(/\s+/);
    // The Alloggiati attention color still replaces the yellow one (its tests rely on it); the redesign classes stay.
    expect(classes).toContain('bg-orange-500');
    expect(classes).not.toContain('bg-yellow-500');
    expect(classes).toContain('extra');
    expect(classes).toContain('v2:bg-warning-soft');
  });
});
