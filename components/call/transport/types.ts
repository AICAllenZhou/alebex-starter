/**
 * Shared call-session contract between the page and the transport layer.
 *
 * Relay events use the six states agreed with Alebex Engineer, plus an
 * explicit { type: "ended", reason } frame. Microphone denial and a dropped
 * network are frontend-only.
 *
 * Auth: after the WebSocket opens, the client sends
 * { type: "auth", token } as the first frame. The token is never placed in
 * the URL. Close code 4401 (and/or { type: "error", code: "token_expired" })
 * is the expired-token signal.
 */

export const RELAY_STATES = [
  'connecting',
  'idle',
  'listening',
  'speaking',
  'ended',
  'error',
] as const;

export type RelayState = (typeof RELAY_STATES)[number];

export const ERROR_CODES = [
  'token_expired',
  'invalid_config',
  'upstream_closed',
  'limit_reached',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type FrontendOnlyState = 'mic_denied' | 'disconnected';

export type CallUiState = RelayState | FrontendOnlyState;

export type RelayEvent =
  | { type: 'state'; state: Exclude<RelayState, 'error' | 'ended'> }
  | { type: 'ended'; reason?: string }
  | { type: 'error'; code: ErrorCode };

export type SessionMode = 'mock' | 'relay';

export interface SessionResponse {
  relayUrl: string;
  token: string;
  mode: SessionMode;
  expiresInSeconds?: number;
}

export interface SessionTransport {
  /**
   * Open a session. Implementations must never receive or store ALEBEX_API_KEY.
   * `token` is one-time and valid for 60 seconds; send it in the first
   * WebSocket frame after open, not in the URL.
   * `mediaStream` is the already-granted microphone; the adapter owns it
   * and must stop tracks (and close AudioContext) on end or error.
   */
  start(options: {
    relayUrl: string;
    token: string;
    mediaStream?: MediaStream;
    onEvent: (event: RelayEvent) => void;
    onDisconnected: () => void;
  }): void;

  /** Close the connection. A user-initiated end should not surface as disconnected. */
  stop(): void;
}
