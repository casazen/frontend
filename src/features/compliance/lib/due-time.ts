export const dueTime = (dueAt: string | null): number => {
  const time = dueAt ? new Date(dueAt).getTime() : Number.NaN;
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};
