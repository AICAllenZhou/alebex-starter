import { normalizeEndedReason } from '../audio/format';
import type { ErrorCode, RelayEvent, RelayState } from './types';
import { ERROR_CODES, RELAY_STATES } from './types';

export function parseRelayEvent(data: unknown): RelayEvent | null {
  let raw = data;
  if (typeof data === 'string') {
    try {
      raw = JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object') return null;
  const message = raw as { type?: unknown; state?: unknown; code?: unknown; reason?: unknown };
  const reason = typeof message.reason === 'string' ? message.reason : undefined;

  if (message.type === 'error' && isErrorCode(message.code)) {
    return { type: 'error', code: message.code };
  }

  if (message.type === 'ended') {
    return { type: 'ended', reason: normalizeEndedReason(reason) ?? reason };
  }

  if (message.type === 'state' && isRelayState(message.state)) {
    if (message.state === 'error') {
      const code = isErrorCode(message.code) ? message.code : 'upstream_closed';
      return { type: 'error', code };
    }
    if (message.state === 'ended') {
      return { type: 'ended', reason: normalizeEndedReason(reason) ?? reason };
    }
    return { type: 'state', state: message.state };
  }

  return null;
}

function isRelayState(value: unknown): value is RelayState {
  return typeof value === 'string' && (RELAY_STATES as readonly string[]).includes(value);
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}
