/** Routes of the requests to a supplier of Affitti lunghi (LR-08b): the list, and the page of one request. */
export const LONG_RENT_REQUESTS_PATH = '/app/long-rent/service-requests';

export const longRentRequestPath = (id: string) => `${LONG_RENT_REQUESTS_PATH}/${encodeURIComponent(id)}`;
