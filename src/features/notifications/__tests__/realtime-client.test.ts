import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRealtimeClient,
  hubUrl,
  parseChange,
  reconnectDelay,
  type HubConnectionLike,
  type NotificationsChange,
} from '../realtime-client';

class FakeHub implements HubConnectionLike {
  handlers = new Map<string, (payload: unknown) => void>();
  reconnecting: () => void = () => undefined;
  reconnected: () => void = () => undefined;
  closed: () => void = () => undefined;
  start = vi.fn<() => Promise<void>>(async () => undefined);
  stop = vi.fn<() => Promise<void>>(async () => undefined);
  on(method: string, handler: (payload: unknown) => void) {
    this.handlers.set(method, handler);
  }
  onreconnecting(handler: () => void) {
    this.reconnecting = handler;
  }
  onreconnected(handler: () => void) {
    this.reconnected = handler;
  }
  onclose(handler: () => void) {
    this.closed = handler;
  }
}

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

describe('notifications real-time client', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('connect_StartSucceeds_BecomesConnectedAndDeliversChanges', async () => {
    const hub = new FakeHub();
    const client = createRealtimeClient(async () => hub);
    const states: string[] = [];
    const changes: NotificationsChange[] = [];
    client.onState((state) => states.push(state));
    client.onChange((change) => changes.push(change));

    client.connect();
    await flush();
    hub.handlers.get('notificationsChanged')?.({ unreadCount: 3, type: 'guest-message', entityId: 'b-1' });
    hub.handlers.get('notificationsChanged')?.({ nonsense: true });

    expect(states).toEqual(['connecting', 'connected']);
    expect(changes).toEqual([{ unreadCount: 3, type: 'guest-message', entityId: 'b-1' }]);
  });

  it('connect_CalledTwice_OpensOneConnection', async () => {
    const factory = vi.fn(async () => new FakeHub());
    const client = createRealtimeClient(factory);
    client.connect();
    client.connect();
    await flush();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('connect_FirstStartFails_RetriesWithBackoffUntilItWorks', async () => {
    const hub = new FakeHub();
    hub.start.mockRejectedValueOnce(new Error('down')).mockRejectedValueOnce(new Error('down'));
    const client = createRealtimeClient(async () => hub);

    client.connect();
    await flush();
    expect(client.getState()).toBe('connecting');
    expect(hub.start).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(reconnectDelay(1) + 1);
    expect(hub.start).toHaveBeenCalledTimes(2);
    expect(client.getState()).toBe('connecting');

    await vi.advanceTimersByTimeAsync(reconnectDelay(2) + 1);
    expect(hub.start).toHaveBeenCalledTimes(3);
    expect(client.getState()).toBe('connected');
  });

  it('reconnectDelay_ManyAttempts_GrowsAndStopsAtTheLastDelay', () => {
    expect([0, 1, 2, 3, 4, 5, 50].map(reconnectDelay)).toEqual([0, 2000, 5000, 10000, 30000, 30000, 30000]);
  });

  it('state_SignalrReconnects_FollowsReconnectingAndReconnected', async () => {
    const hub = new FakeHub();
    const client = createRealtimeClient(async () => hub);
    client.connect();
    await flush();

    hub.reconnecting();
    expect(client.getState()).toBe('connecting');
    hub.reconnected();
    expect(client.getState()).toBe('connected');
  });

  it('onclose_ConnectionGivesUp_StartsAgain', async () => {
    const hubs = [new FakeHub(), new FakeHub()];
    const factory = vi.fn(async () => hubs.shift()!);
    const client = createRealtimeClient(factory);
    client.connect();
    await flush();

    const first = factory.mock.results[0];
    expect(first).toBeDefined();
    // The closed hub: the client builds a new connection.
    const closedHub = (await first.value) as FakeHub;
    closedHub.closed();
    await vi.advanceTimersByTimeAsync(reconnectDelay(1) + 1);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(client.getState()).toBe('connected');
  });

  it('disconnect_WhileConnected_StopsTheHubAndIgnoresLateEvents', async () => {
    const hub = new FakeHub();
    const client = createRealtimeClient(async () => hub);
    const listener = vi.fn();
    client.onChange(listener);
    client.connect();
    await flush();

    client.disconnect();
    hub.handlers.get('notificationsChanged')?.({ unreadCount: 1, type: null, entityId: null });
    hub.closed();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(hub.stop).toHaveBeenCalledTimes(1);
    expect(client.getState()).toBe('disconnected');
    expect(listener).not.toHaveBeenCalled();
  });

  it('disconnect_WhileRetrying_CancelsThePendingAttempt', async () => {
    const hub = new FakeHub();
    hub.start.mockRejectedValue(new Error('down'));
    const factory = vi.fn(async () => hub);
    const client = createRealtimeClient(factory);
    client.connect();
    await flush();
    client.disconnect();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('disconnect_ThenConnect_OpensAFreshConnection', async () => {
    const factory = vi.fn(async () => new FakeHub());
    const client = createRealtimeClient(factory);
    client.connect();
    await flush();
    client.disconnect();
    client.connect();
    await flush();
    expect(factory).toHaveBeenCalledTimes(2);
    expect(client.getState()).toBe('connected');
  });
});

describe('parseChange', () => {
  it('parseChange_ValidPayload_ReturnsIt', () => {
    expect(parseChange({ unreadCount: 2.9, type: 'new-booking', entityId: 'x' })).toEqual({ unreadCount: 2, type: 'new-booking', entityId: 'x' });
    expect(parseChange({ unreadCount: 0, type: null, entityId: null })).toEqual({ unreadCount: 0, type: null, entityId: null });
  });

  it.each([null, undefined, 'x', {}, { unreadCount: 'a' }, { unreadCount: Number.NaN }])('parseChange_%j_ReturnsNull', (payload) => {
    expect(parseChange(payload)).toBeNull();
  });
});

describe('hubUrl', () => {
  it('hubUrl_ApiBaseWithPath_PointsAtTheOriginOfTheApi', () => {
    expect(hubUrl('https://api.example.com/api')).toBe('https://api.example.com/hubs/notifications');
    expect(hubUrl('http://localhost:5000/api')).toBe('http://localhost:5000/hubs/notifications');
  });

  it('hubUrl_RelativeBase_UsesThePageOrigin', () => {
    expect(hubUrl('/api')).toBe(`${window.location.origin}/hubs/notifications`);
  });
});
