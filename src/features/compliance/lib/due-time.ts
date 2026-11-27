/** The time of a deadline in ms, or +Infinity when there is none or it is not a date: what has no deadline sorts after what has one. */
export const dueTime = (dueAt: string | null): number => {
  const time = dueAt ? new Date(dueAt).getTime() : Number.NaN;
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};
