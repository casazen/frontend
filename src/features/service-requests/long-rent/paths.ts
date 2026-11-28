export const LONG_RENT_REQUESTS_PATH = '/app/long-rent/service-requests';

export const longRentRequestPath = (id: string) => `${LONG_RENT_REQUESTS_PATH}/${encodeURIComponent(id)}`;
