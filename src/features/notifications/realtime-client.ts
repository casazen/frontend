import { apiConfig } from '@/config/api.config';

/** What the server pushes on `notificationsChanged`: the new count and what changed (both may be null). */
export interface NotificationsChange {
  unreadCount: number;
  type: string | null;
  entityId: string | null;
}

export type RealtimeState = 'disconnected' | 'connecting' | 'connected';

/** The slice of the SignalR `HubConnection` the client uses, so that a test hands in a fake one. */
export interface HubConnectionLike {
  on(method: string, handler: (payload: unknown) => void): void;
  onreconnecting(handler: () => void): void;
  onreconnected(handler: () => void): void;
  onclose(handler: () => void): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export type HubConnectionFactory = () => Promise<HubConnectionLike>;

export interface RealtimeClient {
  /** Opens the channel (idempotent). Resolves when the first attempt ends; failures retry by themselves. */
  connect(): void;
  /** Closes it for good (logout, unmount) and cancels any retry. */
  disconnect(): void;
  getState(): RealtimeState;
  /** Called after every state change; returns the unsubscribe. */
  onState(listener: (state: RealtimeState) => void): () => void;
  /** Called for every `notificationsChanged`; returns the unsubscribe. */
  onChange(listener: (change: NotificationsChange) => void): () => void;
}

export const HUB_PATH = '/hubs/notifications';
export const HUB_METHOD = 'notificationsChanged';

/** Waits between attempts, in ms; the last one repeats for ever (the safety-net poll covers the gap). */
export const RECONNECT_DELAYS_MS = [0, 2_000, 5_000, 10_000, 30_000] as const;

export function reconnectDelay(attempt: number): number {
  return RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
}

/** The hub lives at the origin of the API (`VITE_API_BASE_URL` ends with `/api`). */
export function hubUrl(baseUrl: string = apiConfig.baseURL): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  return new URL(HUB_PATH, new URL(baseUrl, origin)).toString();
}

/** A payload that is not the contract is ignored, never thrown: the server is not trusted to be on the same version. */
export function parseChange(payload: unknown): NotificationsChange | null {
  if (!payload || typeof payload !== 'object') return null;
  const { unreadCount, type, entityId } = payload as Record<string, unknown>;
  if (typeof unreadCount !== 'number' || !Number.isFinite(unreadCount)) return null;
  return {
    unreadCount: Math.max(0, Math.floor(unreadCount)),
    type: typeof type === 'string' ? type : null,
    entityId: typeof entityId === 'string' ? entityId : null,
  };
}

/**
 * The real SignalR connection, loaded on demand so that the library stays out of the first bundle. WebSockets first, with the
 * fallbacks of the negotiation (server-sent events, long polling); the access token is asked at every (re)connection, so a
 * refreshed token is the one used. Automatic reconnect is off: the client below owns the retries, and its backoff.
 */
export function createSignalrFactory(getAccessToken: () => Promise<string | undefined>, url: string = hubUrl()): HubConnectionFactory {
  return async () => {
    const { HubConnectionBuilder, LogLevel } = await import('@microsoft/signalr');
    return new HubConnectionBuilder()
      .withUrl(url, { accessTokenFactory: async () => (await getAccessToken()) ?? '' })
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (context) => reconnectDelay(context.previousRetryCount + 1) })
      .configureLogging(LogLevel.None)
      .build();
  };
}

interface Timers {
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

const REAL_TIMERS: Timers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * The connection manager: one channel, its state, and the retries. The first `start` can fail (server down, token not ready):
 * SignalR does not retry that, so the client does, with {@link RECONNECT_DELAYS_MS}. After a start that worked, SignalR reconnects
 * by itself (same backoff); when it gives up (`onclose`) the client starts again. `disconnect` stops everything.
 */
export function createRealtimeClient(factory: HubConnectionFactory, timers: Timers = REAL_TIMERS): RealtimeClient {
  let state: RealtimeState = 'disconnected';
  let wanted = false;
  let generation = 0;
  let connection: HubConnectionLike | null = null;
  let retryHandle: unknown = null;
  const stateListeners = new Set<(state: RealtimeState) => void>();
  const changeListeners = new Set<(change: NotificationsChange) => void>();

  const setState = (next: RealtimeState) => {
    if (state === next) return;
    state = next;
    stateListeners.forEach((listener) => listener(next));
  };

  const scheduleRetry = (attempt: number, run: number) => {
    if (!wanted || run !== generation) return;
    setState('connecting');
    retryHandle = timers.setTimeout(() => {
      retryHandle = null;
      void open(attempt + 1, run);
    }, reconnectDelay(attempt + 1));
  };

  const open = async (attempt: number, run: number): Promise<void> => {
    if (!wanted || run !== generation) return;
    setState('connecting');
    let hub: HubConnectionLike;
    try {
      hub = await factory();
    } catch {
      scheduleRetry(attempt, run);
      return;
    }
    if (!wanted || run !== generation) return;
    hub.on(HUB_METHOD, (payload) => {
      const change = parseChange(payload);
      if (change && run === generation) changeListeners.forEach((listener) => listener(change));
    });
    hub.onreconnecting(() => {
      if (run === generation) setState('connecting');
    });
    hub.onreconnected(() => {
      if (run === generation) setState('connected');
    });
    hub.onclose(() => {
      if (run !== generation || !wanted) return;
      connection = null;
      scheduleRetry(0, run);
    });
    connection = hub;
    try {
      await hub.start();
    } catch {
      connection = null;
      if (run === generation) scheduleRetry(attempt, run);
      return;
    }
    if (!wanted || run !== generation) {
      void hub.stop().catch(() => undefined);
      return;
    }
    setState('connected');
  };

  return {
    connect() {
      if (wanted) return;
      wanted = true;
      generation += 1;
      void open(0, generation);
    },
    disconnect() {
      wanted = false;
      generation += 1;
      if (retryHandle !== null) timers.clearTimeout(retryHandle);
      retryHandle = null;
      const hub = connection;
      connection = null;
      setState('disconnected');
      if (hub) void hub.stop().catch(() => undefined);
    },
    getState: () => state,
    onState(listener) {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    onChange(listener) {
      changeListeners.add(listener);
      return () => changeListeners.delete(listener);
    },
  };
}
