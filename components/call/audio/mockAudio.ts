import { encodeBase64Pcm16 } from './pcm';

/** Build a base64 PCM16 mono payload (default 24 kHz) for the mock relay. */
export function sinePcm16Base64(options: {
  sampleRate: number;
  durationMs: number;
  frequencyHz?: number;
  amplitude?: number;
}): string {
  const { sampleRate, durationMs, frequencyHz = 440, amplitude = 0.2 } = options;
  const length = Math.max(0, Math.round((sampleRate * durationMs) / 1000));
  const samples = new Float32Array(length);
  if (frequencyHz > 0 && amplitude !== 0) {
    const step = (2 * Math.PI * frequencyHz) / sampleRate;
    for (let i = 0; i < length; i += 1) samples[i] = Math.sin(step * i) * amplitude;
  }
  return encodeBase64Pcm16(samples);
}

export function silencePcm16Base64(sampleRate: number, durationMs: number): string {
  return sinePcm16Base64({ sampleRate, durationMs, amplitude: 0 });
}

export function mockAudioFrame(options: {
  data: string;
  sampleRate: number;
  format?: 'pcm16';
}) {
  return {
    type: 'audio' as const,
    data: options.data,
    format: options.format ?? ('pcm16' as const),
    sampleRate: options.sampleRate,
  };
}
