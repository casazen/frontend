import { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/use-workspace';

type WorkspaceSwitcherLayout = 'sidebar' | 'drawer';

interface WorkspaceSwitcherProps {
  layout?: WorkspaceSwitcherLayout;
  className?: string;
}

export function WorkspaceSwitcher({ layout = 'sidebar', className }: WorkspaceSwitcherProps) {
  const { contexts, activeContext, setActiveContext } = useWorkspace();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = contexts.findIndex((ctx) => ctx.contextKey === activeContext);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % contexts.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + contexts.length) % contexts.length;
      } else {
        return;
      }

      event.preventDefault();
      const nextContext = contexts[nextIndex];
      setActiveContext(nextContext.contextKey);
      tabRefs.current[nextIndex]?.focus();
    },
    [activeContext, contexts, setActiveContext],
  );

  if (contexts.length <= 1) {
    return null;
  }

  const isDrawer = layout === 'drawer';

  return (
    <div className={cn('min-w-0', className)}>
      <p
        className={cn(
          'mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground',
          isDrawer ? 'px-4' : 'px-2',
        )}
      >
        Workspace
      </p>
      <div
        role="tablist"
        aria-label="Workspace context"
        className={cn(
          'flex gap-0.5 rounded-lg border bg-muted p-0.5',
          isDrawer ? 'mx-4' : 'mx-2',
          isDrawer && 'flex-col sm:flex-row',
        )}
        onKeyDown={handleKeyDown}
      >
        {contexts.map((context, index) => {
          const isSelected = activeContext === context.contextKey;
          return (
            <button
              key={context.contextKey}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              className={cn(
                'min-h-10 flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                'truncate text-center',
                isSelected
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveContext(context.contextKey)}
            >
              {context.displayName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
