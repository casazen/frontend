/**
 * The sales channels shown at once, in this order, in the Marketplace and in the connect wizard («i principali»): Booking, Airbnb, Expedia,
 * Vrbo, Agoda, HomeToGo and Holidu, by the code the channel manager gives each portal in its catalog. They are the channels of the channel
 * manager requirements plus the ones the channel manager itself marks as preferred. The names always come from the catalog, never from here.
 * Every other channel waits behind «Visualizza altri».
 */
export const MAIN_SALES_CHANNEL_CODES: readonly string[] = ['142', '274', '4', '235', '271', '369', '333'];

export interface MainChannelsSplit<T> {
  main: T[];
  others: T[];
}

export function splitMainChannels<T extends { code: string }>(
  entries: readonly T[],
  keep: (entry: T) => boolean = () => false,
): MainChannelsSplit<T> {
  const rank = new Map(MAIN_SALES_CHANNEL_CODES.map((code, index) => [code, index] as const));
  const mains = entries.filter((entry) => rank.has(entry.code)).sort((a, b) => (rank.get(a.code) ?? 0) - (rank.get(b.code) ?? 0));
  if (mains.length === 0) return { main: [...entries], others: [] };

  const rest = entries.filter((entry) => !rank.has(entry.code));
  return { main: [...mains, ...rest.filter((entry) => keep(entry))], others: rest.filter((entry) => !keep(entry)) };
}
