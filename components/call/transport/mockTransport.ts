import type { ErrorCode, RelayState, SessionTransport } from './types';

export interface MockTransportOptions {
  /** If set, emit this state once (used by ?mockState= for screenshots). */
  pinnedState?: Exclude<RelayState, 'error'>;
  pinnedError?: ErrorCode;
  /** Used with pinnedState "ended", or on its own, to emit { type: "ended", reason }. */
  pinnedEndedReason?: string;
}

/**
 * In-page event source used when ?mock=1 is set, or when /api/session returns
 * mode: "mock" because RELAY_URL is unset. Drives every agreed relay state,
 * including { type: "ended", reason } for both user_hangup and duration_limit,
 * without a network or a microphone.
 */
export function createMockTransport(
  options: MockTransportOptions = {},
): SessionTransport {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let stopped = false;

  const later = (ms: number, fn: () => void) => {
    timers.push(setTimeout(fn, ms));
  };

  return {
    start({ onEvent }) {
      stopped = false;

      if (options.pinnedError) {
        onEvent({ type: 'error', code: options.pinnedError });
        return;
      }

      if (options.pinnedState === 'ended' || options.pinnedEndedReason) {
        onEvent({
          type: 'ended',
          reason: options.pinnedEndedReason,
        });
        return;
      }

      if (options.pinnedState) {
        onEvent({ type: 'state', state: options.pinnedState });
        return;
      }

      onEvent({ type: 'state', state: 'connecting' });
      later(500, () => {
        if (stopped) return;
        onEvent({ type: 'state', state: 'idle' });
      });
      later(1400, () => {
        if (stopped) return;
        onEvent({ type: 'state', state: 'listening' });
      });
      later(2400, () => {
        if (stopped) return;
        onEvent({ type: 'state', state: 'speaking' });
      });
    },

    stop() {
      stopped = true;
      while (timers.length) {
        clearTimeout(timers.pop());
      }
    },
  };
}

/** Helpers so tests / demos can emit both ended reasons from the mock source. */
export function mockEndedEvent(reason: 'user_hangup' | 'duration_limit') {
  return { type: 'ended' as const, reason };
}
