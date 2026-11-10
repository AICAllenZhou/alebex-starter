/**
 * Shared call-session contract between the page and the transport layer.
 *
 * Our frames: auth (first text frame after open, token never in the URL),
 * state / error / ended. Close code 4401 or error token_expired is expired token.
 *
 * Alebex frames the relay forwards unchanged:
 *   call_started, audio (JSON base64 PCM16 + sample_rate), mark, clear_audio,
 *   transcript, conversation_message, call_ended, end_call (client hangup).
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
  | { type: 'state'; state: Exclude<RelayState, 'error' | 'ended'>; derived?: boolean }
  | { type: 'ended'; reason?: string }
  | { type: 'error'; code: ErrorCode }
  | { type: 'call_started'; callId?: string }
  | { type: 'audio'; data: string; format?: string; sampleRate: number }
  | { type: 'mark'; name?: string; raw: string }
  | { type: 'clear_audio'; raw: string }
  | { type: 'transcript'; role?: string; text: string; isFinal: boolean }
  | { type: 'conversation_message'; role?: string; content: string; timestamp?: string };

export type SessionMode = 'mock' | 'relay';

export interface SessionResponse {
  relayUrl: string;
  token: string;
  mode: SessionMode;
  expiresInSeconds?: number;
}

export interface TranscriptTurn {
  id: string;
  role?: string;
  text: string;
  source: 'transcript' | 'conversation';
}

export interface LiveCaption {
  role?: string;
  text: string;
  isFinal: boolean;
}

export interface SessionTransport {
  /**
   * Open a session. Implementations must never receive or store ALEBEX_API_KEY.
   * `token` is one-time and valid for 60 seconds; send it in the first
   * WebSocket frame after open, not in the URL.
   * `audioContext` must be created in the user's click handler.
   * `mediaStream` is the already-granted microphone; uplink starts only after
   * `call_started`. The adapter stops tracks and sources on end or error.
   * The caller closes the AudioContext it created.
   */
  start(options: {
    relayUrl: string;
    token: string;
    audioContext?: AudioContext;
    mediaStream?: MediaStream;
    onEvent: (event: RelayEvent) => void;
    onDisconnected: () => void;
  }): void;

  /** Send {type:"end_call"} if the socket is open, then close. */
  stop(): void;
}
