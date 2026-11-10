/**
 * Browser-voice audio format and close-code constants.
 *
 * Uplink (mic -> relay) is raw PCM16 LE, 16 kHz mono, 20 ms frames.
 * Downlink sample_rate is read from each {type:"audio"} frame — do not
 * hardcode it. Playback lead and mark-hold timing live here so tests and
 * the scheduler stay in lockstep.
 */
const sampleRate = 16_000;
const channels = 1;
const frameDurationMs = 20;
const bytesPerSample = 2;
const samplesPerFrame = (sampleRate * frameDurationMs) / 1000;
const bytesPerFrame = samplesPerFrame * bytesPerSample;

export const AUDIO_FORMAT = {
  /** PCM signed 16-bit little-endian, mono, 16 kHz (uplink). */
  encoding: 'pcm16' as const,
  sampleRate,
  channels,
  frameDurationMs,
  samplesPerFrame,
  bytesPerSample,
  bytesPerFrame,
} as const;

export const PLAYBACK = {
  /** First downlink chunk starts this far ahead of AudioContext.currentTime. */
  leadSeconds: 0.18,
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
