/**
 * Provisional browser-voice audio format and close-code constants.
 *
 * Keep every tunable value here so the worklets, encoder, and tests stay in
 * lockstep when the mid-tier changes the contract.
 */
const sampleRate = 16_000;
const channels = 1;
const frameDurationMs = 20;
const bytesPerSample = 2;
const samplesPerFrame = (sampleRate * frameDurationMs) / 1000;
const bytesPerFrame = samplesPerFrame * bytesPerSample;

export const AUDIO_FORMAT = {
  /** PCM signed 16-bit little-endian, mono, 16 kHz. */
  encoding: 'pcm16' as const,
  sampleRate,
  channels,
  frameDurationMs,
  samplesPerFrame,
  bytesPerSample,
  bytesPerFrame,
} as const;

export const PLAYBACK = {
  /** Start rendering once this many 20 ms frames are queued (~60 ms). */
  jitterMinFrames: 3,
  /** Drop oldest frames if the queue grows past this (~200 ms). */
  jitterMaxFrames: 10,
} as const;

/** Mid-tier WebSocket close codes. */
export const RELAY_CLOSE = {
  tokenExpired: 4401,
} as const;

export const ENDED_REASONS = ['user_hangup', 'duration_limit'] as const;
export type EndedReason = (typeof ENDED_REASONS)[number];

export function normalizeEndedReason(reason?: string | null): EndedReason | null {
  if (!reason) return null;
  if (reason === 'user_hangup' || reason === 'duration_limit') return reason;
  return null;
}
