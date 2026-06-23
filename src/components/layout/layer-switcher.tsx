import { useAppLayerContext } from '@/hooks/use-app-layer-context';
import type { AppLayer } from '@/hooks/use-app-layer';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useCallback, useRef } from 'react';

export function LayerSwitcher() {
  const { t } = useTranslation();
  const { activeLayer, setLayer, canSwitchLayer } = useAppLayerContext();

  const LAYERS: { value: AppLayer; key: string }[] = [
    { value: 'short-stay', key: 'shell.layerShortStay' },
    { value: 'long-term', key: 'shell.layerLongTerm' },
  ];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = LAYERS.findIndex((layer) => layer.value === activeLayer);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % LAYERS.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + LAYERS.length) % LAYERS.length;
      } else {
        return;
      }

      event.preventDefault();
      const nextLayer = LAYERS[nextIndex].value;
      setLayer(nextLayer);
      tabRefs.current[nextIndex]?.focus();
    },
    [activeLayer, setLayer]
  );

  if (!canSwitchLayer) {
    return null;
  }

  return (
    <div
      role="tablist"
      aria-label="Application layer"
      className="ml-2 flex rounded-lg border bg-muted p-0.5"
      onKeyDown={handleKeyDown}
    >
      {LAYERS.map((layer, index) => {
        const isSelected = activeLayer === layer.value;
        return (
          <button
            key={layer.value}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              isSelected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setLayer(layer.value)}
          >
            {t(layer.key)}
          </button>
        );
      })}
    </div>
  );
}
