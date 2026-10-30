import { Info } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import { regionMapSvg } from '../engine/region';
import { townPoint } from '../engine/region/registry';
import { snapToLand } from '../engine/snap';
import { isPositionSet, projectPoint, publicPoint, unprojectPoint, type LatLon, type View } from '../engine/view';
import { isMappable } from '../load';
import { MapCard, type MapCardData } from './map-card';
import { MapCluster } from './map-cluster';
import { MapControls } from './map-controls';
import { MapPin } from './map-pin';
import { MapSkeleton } from './map-skeleton';
import { pillSize, placePins } from './place-pins';
import { SvgHost } from './svg-host';
import type { MapPinData, RegionMapProps } from './types';
import { useElementSize } from './use-element-size';
import { useMapData } from './use-map-data';
import { useMapView } from './use-map-view';

/** Touch screens and narrow ones: the card is a sheet and the pins are touched, not hovered. */
const PHONE = '(hover: none), (width < 64rem)';

function draw(lat: number, lon: number, spanKm: number, aspect: number, width: number, labels: RegionMapProps['labels'], highlight: string, version: number): string {
  void version; // the data a map draws are loaded on demand: the version only says that something new is there to draw
  return regionMapSvg({ lat, lon, spanKm, aspect }, { width, labels, highlight: highlight ? highlight.split('|') : [] });
}

function pinName(t: TFunction, pin: MapPinData): string {
  if (pin.available === false) return t('siteMap.pinLabelUnavailable', { name: pin.name, label: pin.label, note: pin.unavailableNote ?? t('siteMap.unavailable') });
  return t('siteMap.pinLabel', { name: pin.name, label: pin.label });
}

/** The map itself: loaded on demand by `RegionMap`, together with the engine and the data. */
export default function RegionMapCanvas(props: RegionMapProps) {
  const { pins, onSelect, onActiveChange, highlightIds, view: initial, labels = 'auto', highlightTowns, aspect } = props;
  const { t } = useTranslation();
  const hintId = useId();
  const phone = useMediaQuery(PHONE);
  const [box, size] = useElementSize<HTMLDivElement>();
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; dx: number; dy: number; moved: boolean } | null>(null);
  const [innerSelected, setInnerSelected] = useState<string | null>(null);
  const [innerActive, setInnerActive] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const selectedId = props.selectedId !== undefined ? props.selectedId : innerSelected;
  const activeId = props.activeId !== undefined ? props.activeId : innerActive;
  const select = (id: string | null) => {
    setInnerSelected(id);
    onSelect?.(id);
  };
  const setActive = (id: string | null) => {
    setInnerActive(id);
    onActiveChange?.(id);
  };

  // positions: rounded to two decimals (an exact one is refused in development), in Italy or Switzerland, pulled to land when the rounding put them in the sea.
  // A house whose host never gave a position (`0, 0`) is put at its comune, the town of that name in the data of the map (the data are in once the map draws).
  const placed = pins.flatMap((pin) => {
    const own = isPositionSet(pin.lat, pin.lon) ? publicPoint(pin) : null;
    const p = own && isMappable(own) ? own : townPoint(pin.place);
    return p ? [{ pin, p }] : [];
  });
  const frameAspect = size.h > 0 ? size.w / size.h : (aspect ?? 4 / 3);
  const mv = useMapView(placed.map((q) => q.p), frameAspect, initial);
  const data = useMapData(mv.view);
  const { lat, lon, spanKm } = mv.view;
  const drawWidth = Math.max(320, Math.min(1400, Math.round(size.w / 20) * 20));
  const highlightKey = (highlightTowns ?? []).join('|');
  const svg = useMemo(
    () => (data.status === 'ready' && size.w > 0 ? draw(lat, lon, spanKm, frameAspect, drawWidth, labels, highlightKey, data.version) : ''),
    [data.status, data.version, lat, lon, spanKm, frameAspect, drawWidth, labels, highlightKey, size.w],
  );

  const at = placed.map(({ pin, p }) => {
    const s = snapToLand(p);
    const xy = projectPoint(s.lat, s.lon, mv.view);
    return { pin, x: xy.x, y: xy.y };
  });
  const { shifts, group } = placePins(
    at.map((a) => ({ x: (a.x / 100) * size.w, y: (a.y / 100) * size.h, ...pillSize(a.pin.label), keep: a.pin.id === selectedId || a.pin.id === activeId || (highlightIds?.includes(a.pin.id) ?? false) })),
    { spanKm, widthPx: size.w },
  );
  const said = (v: View) => setAnnounce(t('siteMap.zoomAnnounce', { km: Math.round(v.spanKm) }));
  // pins that would sit on top of each other at this zoom are grouped in one bubble
  const groups = new Map<number, number[]>();
  group.forEach((rep, i) => groups.set(rep, [...(groups.get(rep) ?? []), i]));

  // pins in the order of the map, from the top to the bottom and from the left to the right: the order of the Tab key
  const order = at.map((_, i) => i).sort((a, b) => at[a].y - at[b].y || at[a].x - at[b].x);
  const selectedPin = at.find((a) => a.pin.id === selectedId)?.pin;
  const card: MapCardData | null =
    selectedPin && selectedPin.tone !== 'zone'
      ? {
          id: selectedPin.id,
          name: selectedPin.name,
          zone: selectedPin.card?.zone,
          photoUrl: selectedPin.card?.photoUrl,
          rating: selectedPin.card?.rating,
          priceLabel: selectedPin.card?.priceLabel ?? selectedPin.label,
          unavailableNote: selectedPin.available === false ? (selectedPin.unavailableNote ?? t('siteMap.unavailable')) : undefined,
          href: selectedPin.href,
        }
      : null;

  const zoomBy = (f: number, anchor?: LatLon) => {
    const next = mv.zoom(f, anchor);
    if (next) said(next);
  };

  /* --- the wheel zooms only with Ctrl or Cmd: the page keeps its scrolling --- */
  const { view } = mv;
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const anchor = unprojectPoint(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100, view);
      zoomBy(e.deltaY < 0 ? 1.25 : 0.8, anchor);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  /* --- dragging with the pointer (mouse, pen and, on a map that fills its parent, touch) --- */
  const touchPan = aspect === undefined;
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as Element).closest('button, a, [data-map-ui]')) return;
    if (e.pointerType === 'touch' && !touchPan) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.dx = e.clientX - d.x;
    d.dy = e.clientY - d.y;
    if (Math.abs(d.dx) + Math.abs(d.dy) > 4) d.moved = true;
    if (d.moved && stage.current) stage.current.style.transform = `translate(${d.dx}px, ${d.dy}px)`;
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (stage.current) stage.current.style.transform = '';
    if (cancelled) return;
    if (d.moved) {
      mv.pan(-d.dx / Math.max(1, size.w), -d.dy / Math.max(1, size.h));
    } else if (selectedId) {
      select(null);
    }
  };

  /* --- keyboard: arrows move the map when it has the focus, + and - zoom, 0 fits, Esc lets go of the selection --- */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && selectedId) {
      e.stopPropagation();
      select(null);
      return;
    }
    if (e.target !== e.currentTarget) return;
    const step = 0.2;
    if (e.key === 'ArrowLeft') mv.pan(-step, 0);
    else if (e.key === 'ArrowRight') mv.pan(step, 0);
    else if (e.key === 'ArrowUp') mv.pan(0, -step);
    else if (e.key === 'ArrowDown') mv.pan(0, step);
    else if (e.key === '+' || e.key === '=') zoomBy(2);
    else if (e.key === '-' || e.key === '_') zoomBy(0.5);
    else if (e.key === '0') {
      mv.fit();
      setAnnounce(t('siteMap.fitAnnounce'));
    } else return;
    e.preventDefault();
  };

  const noPosition = pins.length > 0 && placed.length === 0;
  return (
    <div
      ref={box}
      role="group"
      aria-label={t('siteMap.mapLabel')}
      aria-describedby={hintId}
      tabIndex={0}
      data-testid="region-map"
      className={`absolute inset-0 select-none overflow-hidden bg-[#cfe3e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--cz-public-primary-text,#1d4ed8)] ${touchPan ? 'touch-none' : 'touch-pan-y'} cursor-grab active:cursor-grabbing`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e, false)}
      onPointerCancel={(e) => endDrag(e, true)}
      onKeyDown={onKeyDown}
    >
      <span id={hintId} className="sr-only">
        {t('siteMap.keyboardHint')}
      </span>
      {data.status === 'error' ? (
        <div role="alert" data-map-ui className="absolute inset-0 grid place-content-center justify-items-center gap-3 p-6 text-center">
          <p className="font-semibold text-[var(--cz-public-text,#111)]">{t('siteMap.error')}</p>
          <Button type="button" variant="outline" onClick={data.retry}>
            {t('siteMap.retry')}
          </Button>
        </div>
      ) : data.status === 'loading' || size.w === 0 ? (
        <MapSkeleton />
      ) : (
        <>
          <div data-map-ui className="absolute right-3 top-3 z-40">
            <MapControls
              canZoomIn={mv.canZoomIn}
              canZoomOut={mv.canZoomOut}
              onZoomIn={() => zoomBy(2)}
              onZoomOut={() => zoomBy(0.5)}
              onFit={() => {
                mv.fit();
                setAnnounce(t('siteMap.fitAnnounce'));
              }}
              announcement={announce}
            />
          </div>
          <p
            data-map-ui
            className="absolute left-3 top-3 z-40 flex max-w-[calc(100%-5rem)] items-center gap-1.5 rounded-full bg-[var(--cz-public-surface,#fff)]/90 px-3 py-1.5 text-xs text-[var(--cz-public-muted,#555)] shadow-sm"
          >
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {noPosition ? t('siteMap.noPosition') : t('siteMap.approximateNote')}
          </p>
          <div ref={stage} className="absolute inset-0 will-change-transform">
            <SvgHost svg={svg} />
            <ul aria-label={t('siteMap.pinsLabel')} className="absolute inset-0 m-0 list-none p-0">
              {order.map((i) => {
                const { pin, x, y } = at[i];
                if (x < -4 || x > 104 || y < -6 || y > 106 || group[i] !== i) return null;
                const members = groups.get(i) ?? [i];
                if (members.length > 1) {
                  return (
                    <MapCluster
                      key={`cluster-${pin.id}`}
                      count={members.length}
                      x={x}
                      y={y}
                      dx={shifts[i].dx}
                      dy={shifts[i].dy}
                      onZoom={() => said(mv.focus(members.map((m) => at[m].pin)))}
                    />
                  );
                }
                return (
                  <MapPin
                    key={pin.id}
                    id={pin.id}
                    label={pin.label}
                    accessibleName={pinName(t, pin)}
                    x={x}
                    y={y}
                    dx={shifts[i].dx}
                    dy={shifts[i].dy}
                    selected={pin.id === selectedId}
                    active={pin.id === activeId}
                    highlighted={highlightIds?.includes(pin.id) ?? false}
                    available={pin.available !== false}
                    onSelect={(id) => select(id === selectedId ? null : id)}
                    onActiveChange={setActive}
                  />
                );
              })}
            </ul>
          </div>
          <div data-map-ui>
            <MapCard data={card} phone={phone} onClose={() => select(null)} />
          </div>
        </>
      )}
    </div>
  );
}
