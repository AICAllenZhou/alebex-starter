import { AUDIO_FORMAT } from './format';

/**
 * Mic-capture worklet only. Downlink is scheduled with AudioBufferSourceNodes
 * (see playback.ts), not a worklet. Constants are inlined from AUDIO_FORMAT.
 */
export function captureWorkletSource(): string {
  return `
const TARGET_RATE = ${AUDIO_FORMAT.sampleRate};
const FRAME_SAMPLES = ${AUDIO_FORMAT.samplesPerFrame};
const FRAME_MS = ${AUDIO_FORMAT.frameDurationMs};

function resampleLinear(input, fromRate, toRate) {
  if (input.length === 0) return new Float32Array(0);
  if (fromRate === toRate || fromRate <= 0 || toRate <= 0) return new Float32Array(input);
  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLength);
  const last = input.length - 1;
  for (let i = 0; i < outLength; i++) {
    const src = i * ratio;
    const i0 = Math.min(Math.floor(src), last);
    const i1 = Math.min(i0 + 1, last);
    const frac = src - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

function floatToPcm16(input) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    out[i] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return out;
}

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = new Float32Array(0);
    this.inputRate = sampleRate;
    this.frameInSamples = Math.max(1, Math.round(sampleRate * FRAME_MS / 1000));
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel || channel.length === 0) return true;
    const merged = new Float32Array(this.pending.length + channel.length);
    merged.set(this.pending);
    merged.set(channel, this.pending.length);
    this.pending = merged;
    while (this.pending.length >= this.frameInSamples) {
      const slice = this.pending.subarray(0, this.frameInSamples);
      this.pending = this.pending.slice(this.frameInSamples);
      let resampled = resampleLinear(slice, this.inputRate, TARGET_RATE);
      if (resampled.length !== FRAME_SAMPLES) {
        const frame = new Float32Array(FRAME_SAMPLES);
        frame.set(resampled.subarray(0, FRAME_SAMPLES));
        resampled = frame;
      }
      const pcm = floatToPcm16(resampled);
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
`;
}
