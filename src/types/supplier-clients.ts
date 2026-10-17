/** How to reach a customer: only once a job of theirs was taken (decision D9); `null` before, and for a removed customer. */
export interface SupplierClientContact {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

/**
 * A customer of the supplier (`GET /supplier/clients`, SP-16a): a host of CasaZen or a private customer of its public showcase, with
 * what they did together. The private data follow the line of the inbox: "Nome C." until a job of theirs is taken, the contact only then.
 */
export interface SupplierClient {
  /** The id the requests carry: `GET /supplier/inbox?clientId=` lists this customer's requests, for a host and for a private customer. */
  id: string;
  /** `host` or `private`: an open set. */
  kind: string;
  /** `casazen` or `showcase`. */
  source: string;
  /** The name the supplier may see; `null` when the customer was removed by the retention of the personal data (`anonymized`). */
  label: string | null;
  anonymized: boolean;
  /** Requests the supplier took and that are still jobs (taken, in progress, completed or paid). */
  jobsAccepted: number;
  /** Of those, completed or paid. */
  jobsCompleted: number;
  /** The latest job already begun (UTC instant); `null` when none. */
  lastJobAt?: string | null;
  /** The first request still ahead; `null` when none. */
  nextJobAt?: string | null;
  /** The total of the jobs marked paid, in cents: what the payer paid (a refund does not reduce it). */
  grossPaidCents: number;
  /** A regular customer: at least three jobs taken (the threshold of the automatic acceptance). */
  regular: boolean;
  contact?: SupplierClientContact | null;
}

/** A page of `GET /supplier/clients`: the customer with the latest activity first. */
export interface SupplierClientsResponse {
  items: SupplierClient[];
  /** How many customers the filter selects, whatever the page. */
  total: number;
  page: number;
  pageSize: number;
}

/** One of the latest requests of a customer (`GET /supplier/clients/{id}`); `requestId` is the id of `GET /supplier/inbox/{id}`. */
export interface SupplierClientJob {
  requestId: string;
  serviceName?: string | null;
  category: string;
  /** The status of the request, by name: an open set. */
  status: string;
  /** The phase of the console (`phase` of the inbox): an open set. */
  phase: string;
  scheduledStart?: string | null;
  completedAt?: string | null;
  /** The price to show: the final total, else the quote, else the estimate; empty is "da concordare". */
  amountCents?: number | null;
}

/** `GET /supplier/clients/{id}`: the customer and its latest six requests that are open or taken. */
export interface SupplierClientDetail extends SupplierClient {
  recentJobs: SupplierClientJob[];
}
