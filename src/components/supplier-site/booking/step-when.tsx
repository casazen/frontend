import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, CircleAlert, FileText, Zap } from 'lucide-react';
import type { PublicSlot, PublicSlotDay } from '@/api/public-supplier.api';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { buildInquiryPath } from '@/lib/supplier-site/booking-params';
import { dayPartOf, slotClock, type DayPart } from '@/lib/supplier-site/booking-flow';
import { formatStayDate } from '@/lib/stay-dates';

const DAYS_PER_WEEK = 7;
const PARTS: readonly DayPart[] = ['morning', 'afternoon', 'evening'];

interface StepWhenProps {
  supplierSlug: string;
  serviceSlug: string;
  comuneIstat: string | null;
  slots: { isLoading: boolean; isError: boolean; days: PublicSlotDay[]; onRetry: () => void };
  /** The slot chosen (`startUtc`), if it is still among the free ones. */
  chosen: string | null;
  onChoose: (startUtc: string) => void;
  /** The day the finder of the home was asked, if any. */
  preferredDay: string | null;
  urgent: { offered: boolean; on: boolean; surchargeCents: number; onToggle: (on: boolean) => void };
  /** The person went on without a time, or the one it had went to somebody else. */
  problem: 'required' | 'taken' | null;
}

/** The slot of a day grouped by the part of the day it is in. */
function groupByPart(slots: PublicSlot[]): Array<[DayPart, PublicSlot[]]> {
  return PARTS.map((part): [DayPart, PublicSlot[]] => [part, slots.filter((slot) => dayPartOf(slot) === part)]).filter(([, list]) => list.length > 0);
}

/**
 * Step 3, "Quando": four weeks of days, seven at a time, with how many free times each has; then the free times of the day picked, by
 * morning, afternoon and evening. The times are exactly those the server planned (the clock of Rome); a time shown is not a promise, the
 * booking checks it again and the page says so when it went. Urgent: only today and tomorrow, with the surcharge said before.
 */
export function StepWhen({ supplierSlug, serviceSlug, comuneIstat, slots, chosen, onChoose, preferredDay, urgent, problem }: StepWhenProps) {
  const { t, i18n } = useTranslation();
  // The day and the week the person picked count for the kind of times they were picked in (normal or urgent): changing it starts over.
  const [pick, setPick] = useState<{ urgent: boolean; day: string | null; week: number | null }>({ urgent: urgent.on, day: null, week: null });
  const current = pick.urgent === urgent.on ? pick : { urgent: urgent.on, day: null, week: null };
  const { day: pickedDay, week: pagedWeek } = current;
  const setPickedDay = (day: string) => setPick({ ...current, day });
  const setPagedWeek = (week: number) => setPick({ ...current, week });

  const { days } = slots;
  const withSlots = days.filter((day) => day.available && day.slots.length > 0);
  const chosenDay = chosen ? (days.find((day) => day.slots.some((slot) => slot.startUtc === chosen))?.date ?? null) : null;
  const preferred = preferredDay && withSlots.some((day) => day.date === preferredDay) ? preferredDay : null;
  const selectedDay = pickedDay ?? chosenDay ?? preferred ?? withSlots[0]?.date ?? null;
  const selectedIndex = selectedDay ? days.findIndex((day) => day.date === selectedDay) : 0;
  const weekCount = Math.max(1, Math.ceil(days.length / DAYS_PER_WEEK));
  const week = Math.min(pagedWeek ?? Math.floor(Math.max(selectedIndex, 0) / DAYS_PER_WEEK), weekCount - 1);
  const visible = days.slice(week * DAYS_PER_WEEK, (week + 1) * DAYS_PER_WEEK);
  const selected = days.find((day) => day.date === selectedDay);

  const urgentBlock = urgent.offered ? (
    <label className={`vb-urgent${urgent.on ? ' is-on' : ''}`}>
      <input type="checkbox" checked={urgent.on} onChange={(event) => urgent.onToggle(event.target.checked)} />
      <span className="vb-urgent__i" aria-hidden="true">
        <Zap />
      </span>
      <span className="vb-urgent__t">
        <strong>{t('supplierSite.booking.when.urgentTitle')}</strong>
        <small>
          {urgent.surchargeCents > 0
            ? t('supplierSite.booking.when.urgentText', { amount: formatMoney(urgent.surchargeCents, i18n.language) })
            : t('supplierSite.booking.when.urgentTextFree')}
        </small>
      </span>
    </label>
  ) : null;

  let body: ReactNode;
  if (slots.isLoading) {
    body = (
      <p className="vb-note" role="status">
        {t('supplierSite.booking.when.loading')}
      </p>
    );
  } else if (slots.isError) {
    body = (
      <div className="vb-note vb-note--warn" role="alert">
        <span>{t('supplierSite.booking.when.error')}</span>
        <button type="button" className="vz-linkbtn" onClick={slots.onRetry}>
          {t('shared.errorState.retry')}
        </button>
      </div>
    );
  } else if (withSlots.length === 0) {
    body = (
      <div className="vb-empty">
        <p>{urgent.on ? t('supplierSite.booking.when.noneUrgent') : t('supplierSite.booking.when.none')}</p>
        <div className="vb-empty__a">
          {urgent.on ? (
            <button type="button" className="vz-btn vz-btn--secondary" onClick={() => urgent.onToggle(false)}>
              {t('supplierSite.booking.when.urgentOff')}
            </button>
          ) : null}
          <Link className="vz-btn vz-btn--secondary" to={buildInquiryPath(supplierSlug, { service: serviceSlug, comune: comuneIstat ?? undefined })}>
            <FileText aria-hidden="true" />
            <span>{t('supplierSite.cta.inquiry')}</span>
          </Link>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <div className="vb-week">
          <button type="button" className="vb-week__nav" onClick={() => setPagedWeek(week - 1)} disabled={week === 0} aria-label={t('supplierSite.booking.when.prevWeek')}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <fieldset className="vb-days">
            <legend className="sr-only">{t('supplierSite.booking.when.dayLegend')}</legend>
            {visible.map((day) => {
              const free = day.available && day.slots.length > 0;
              return (
                <label key={day.date} className={`vb-day${free ? '' : ' is-off'}`}>
                  <input type="radio" name="day" value={day.date} checked={selectedDay === day.date} disabled={!free} onChange={() => setPickedDay(day.date)} />
                  <span className="vb-day__in">
                    <small>{formatStayDate(day.date, i18n.language, { weekday: 'short' })}</small>
                    <strong>{Number(day.date.slice(8, 10))}</strong>
                    <small>{formatStayDate(day.date, i18n.language, { month: 'short' })}</small>
                    <em>{free ? t('supplierSite.booking.when.slotsCount', { count: day.slots.length }) : t('supplierSite.booking.when.dayOff')}</em>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <button type="button" className="vb-week__nav" onClick={() => setPagedWeek(week + 1)} disabled={week >= weekCount - 1} aria-label={t('supplierSite.booking.when.nextWeek')}>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>

        {selected && selected.slots.length > 0 ? (
          <div className="vb-slots">
            <h3>{t('supplierSite.booking.when.pickTime', { day: formatStayDate(selected.date, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }) })}</h3>
            {groupByPart(selected.slots).map(([part, list]) => (
              <div key={part} className="vb-slotgrp">
                <p className="vb-slotgrp__t">{t(`supplierSite.booking.when.parts.${part}`)}</p>
                <ul>
                  {list.map((slot) => (
                    <li key={slot.startUtc}>
                      <label className="vb-slot">
                        <input type="radio" name="slot" value={slot.startUtc} checked={chosen === slot.startUtc} onChange={() => onChoose(slot.startUtc)} />
                        <span>
                          <strong>{slotClock(slot)}</strong>
                          <small>{t('supplierSite.booking.when.until', { time: slot.endLocal.slice(11, 16) })}</small>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="vb-step-when">
      {urgentBlock}
      {body}
      {problem ? (
        <p className="vb-error" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{problem === 'taken' ? t('supplierSite.booking.problems.slot.taken') : t('supplierSite.booking.problems.slot.required')}</span>
        </p>
      ) : null}
    </div>
  );
}
