import { Info } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import { regionMapSvg } from '../engine/region';
import { snapToLand } from '../engine/snap';
import { projectPoint, publicPoint, unprojectPoint, type LatLon, type View } from '../engine/view';
import { MapCard, type MapCardData } from './map-card';
import { MapControls } from './map-controls';
import { MapPin } from './map-pin';
import { MapSkeleton } from './map-skeleton';
import { pillSize, placePins } from './place-pins';
import { SvgHost } from './svg-host';
import type { MapPinData, RegionMapProps } from './types';
import { useElementSize } from './use-element-size';
import { useMapData } from './use-map-data';
import { useMapView } from './use-map-view';

/** Italy, with a little margin: a position outside it is a mistake of the data, not a place to show. */
const ITALY = { lat0: 35.3, lat1: 47.3, lon0: 6.4, lon1: 18.9 };
const inItaly = (p: LatLon): boolean => p.lat >= ITALY.lat0 && p.lat <= ITALY.lat1 && p.lon >= ITALY.lon0 && p.lon <= ITALY.lon1;
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

  // positions: rounded to two decimals (an exact one is refused in development), inside Italy, pulled to land when the rounding put them in the sea
  const placed = pins.flatMap((pin) => {
    if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lon)) return [];
    const p = publicPoint(pin);
    return inItaly(p) ? [{ pin, p }] : [];
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
  const shifts = placePins(
    at.map((a) => ({ x: (a.x / 100) * size.w, y: (a.y / 100) * size.h, ...pillSize(a.pin.label) })),
    { spanKm, widthPx: size.w },
  );

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

  const said = (v: View) => setAnnounce(t('siteMap.zoomAnnounce', { km: Math.round(v.spanKm) }));
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
          <div ref={stage} className="absolute inset-0 will-change-transform">
            <SvgHost svg={svg} />
            <ul aria-label={t('siteMap.pinsLabel')} className="absolute inset-0 m-0 list-none p-0">
              {at.map(({ pin, x, y }, i) => {
                if (x < -4 || x > 104 || y < -6 || y > 106) return null;
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
          <div data-map-ui>
            <MapCard data={card} phone={phone} onClose={() => select(null)} />
          </div>
        </>
      )}
    </div>
  );
}
