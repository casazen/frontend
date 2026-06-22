import { useCallback, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Building2, FileText, Shield, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { AppContextKey } from '@/config/route-manifest';
import { useWorkspace } from '@/hooks/use-workspace';

type WorkspaceSwitcherLayout = 'sidebar' | 'drawer';

interface WorkspaceSwitcherProps {
  layout?: WorkspaceSwitcherLayout;
  className?: string;
}

const CONTEXT_ICONS: Record<AppContextKey, LucideIcon> = {
  'short-rent': Building2,
  'long-rent': FileText,
  admin: Shield,
  supplier: Wrench,
};

export function WorkspaceSwitcher({ layout = 'sidebar', className }: WorkspaceSwitcherProps) {
  const { t } = useTranslation();
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
        {t('shell.workspaceLabel')}
      </p>
      <div
        role="tablist"
        aria-label={t('shell.workspaceContext')}
        className={cn(
          'flex gap-1 rounded-lg border bg-muted p-1',
          isDrawer ? 'mx-4' : 'mx-2',
        )}
        onKeyDown={handleKeyDown}
      >
        {contexts.map((context, index) => {
          const Icon = CONTEXT_ICONS[context.contextKey];
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
              aria-label={context.displayName}
              title={context.displayName}
              tabIndex={isSelected ? 0 : -1}
              className={cn(
                'group relative flex min-h-10 min-w-10 flex-1 items-center justify-center rounded-md transition-colors',
                isSelected
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
              )}
              onClick={() => setActiveContext(context.contextKey)}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
