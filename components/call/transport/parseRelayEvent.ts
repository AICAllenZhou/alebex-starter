import { normalizeEndedReason } from '../audio/format';
import type { ErrorCode, RelayEvent, RelayState } from './types';
import { ERROR_CODES, RELAY_STATES } from './types';

export function parseRelayEvent(data: unknown): RelayEvent | null {
  const original = typeof data === 'string' ? data : null;
  let raw: unknown = data;
  if (typeof data === 'string') {
    try {
      raw = JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object') return null;
  const message = raw as Record<string, unknown>;
  const type = message.type;
  const rawText = original ?? JSON.stringify(message);

  if (type === 'error' && isErrorCode(message.code)) {
    return { type: 'error', code: message.code };
  }

  if (type === 'ended') {
    const reason = typeof message.reason === 'string' ? message.reason : undefined;
    return { type: 'ended', reason: normalizeEndedReason(reason) ?? reason };
  }

  if (type === 'state' && isRelayState(message.state)) {
    if (message.state === 'error') {
      const code = isErrorCode(message.code) ? message.code : 'upstream_closed';
      return { type: 'error', code };
    }
    if (message.state === 'ended') {
      const reason = typeof message.reason === 'string' ? message.reason : undefined;
      return { type: 'ended', reason: normalizeEndedReason(reason) ?? reason };
    }
    return { type: 'state', state: message.state };
  }

  if (type === 'call_started') {
    const callId = asString(message.call_id ?? message.callId);
    return { type: 'call_started', callId };
  }

  if (type === 'call_ended') {
    return { type: 'ended', reason: mapCallEndedReason(message) };
  }

  if (type === 'audio') {
    const dataValue = asString(message.data);
    const sampleRate = asPositiveNumber(message.sample_rate ?? message.sampleRate);
    if (!dataValue || sampleRate === null) return null;
    const format = asString(message.format) ?? undefined;
    return { type: 'audio', data: dataValue, format, sampleRate };
  }

  if (type === 'mark') {
    return {
      type: 'mark',
      name: asString(message.name) ?? undefined,
      raw: rawText,
    };
  }

  if (type === 'clear_audio') {
    return { type: 'clear_audio', raw: rawText };
  }

  if (type === 'transcript') {
    const text = asString(message.text ?? message.content);
    if (!text) return null;
    return {
      type: 'transcript',
      role: asString(message.role) ?? undefined,
      text,
      isFinal: asBoolean(message.is_final ?? message.isFinal) === true,
    };
  }

  if (type === 'conversation_message' || type === 'conversationMessage') {
    const parsed = parseConversationMessage(message);
    if (!parsed) return null;
    return parsed;
  }

  return null;
}

function parseConversationMessage(
  message: Record<string, unknown>,
): Extract<RelayEvent, { type: 'conversation_message' }> | null {
  const nested =
    message.message && typeof message.message === 'object'
      ? (message.message as Record<string, unknown>)
      : null;
  const role = asString(message.role ?? nested?.role ?? message.speaker);
  const timestamp = asString(message.timestamp ?? message.time ?? nested?.timestamp);
  const content = coerceText(message.content ?? message.text ?? nested?.content ?? nested?.text);
  if (!content) return null;
  return { type: 'conversation_message', role, content, timestamp };
}

function coerceText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return asString((part as { text?: unknown }).text) ?? '';
        }
        return '';
      })
      .join('')
      .trim();
    return joined || undefined;
  }
  if (value && typeof value === 'object' && 'text' in value) {
    return asString((value as { text?: unknown }).text);
  }
  return undefined;
}

function mapCallEndedReason(message: Record<string, unknown>): string | undefined {
  const reason = asString(message.reason);
  const endedBy = asString(message.ended_by ?? message.endedBy);
  const combined = `${reason ?? ''} ${endedBy ?? ''}`.toLowerCase();
  if (combined.includes('limit') || combined.includes('duration')) return 'duration_limit';
  if (combined.includes('user') || combined.includes('hangup') || combined.includes('hang_up')) {
    return 'user_hangup';
  }
  return normalizeEndedReason(reason) ?? reason ?? undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function isRelayState(value: unknown): value is RelayState {
  return typeof value === 'string' && (RELAY_STATES as readonly string[]).includes(value);
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}
