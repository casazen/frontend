import { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/use-workspace';

export function WorkspaceSwitcher() {
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

  return (
    <div
      role="tablist"
      aria-label="Workspace context"
      className="ml-2 flex rounded-lg border bg-muted p-0.5"
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
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              isSelected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveContext(context.contextKey)}
          >
            {context.displayName}
          </button>
        );
      })}
    </div>
  );
}
