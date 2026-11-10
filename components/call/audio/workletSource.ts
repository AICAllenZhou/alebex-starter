import { AUDIO_FORMAT, PLAYBACK } from './format';

/**
 * Worklet source is built from the shared format constants so a contract
 * change in format.ts is picked up automatically. The resample / PCM
 * loops are deliberately inlined: AudioWorklets cannot import app modules.
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

export function playbackWorkletSource(): string {
  return `
const SOURCE_RATE = ${AUDIO_FORMAT.sampleRate};
const MIN_FRAMES = ${PLAYBACK.jitterMinFrames};
const MAX_FRAMES = ${PLAYBACK.jitterMaxFrames};

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

function pcm16ToFloat(input) {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = input[i];
    out[i] = sample < 0 ? sample / 0x8000 : sample / 0x7fff;
  }
  return out;
}

class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.current = null;
    this.offset = 0;
    this.started = false;
    this.port.onmessage = (event) => {
      const buffer = event.data;
      if (!(buffer instanceof ArrayBuffer)) return;
      const samples = pcm16ToFloat(new Int16Array(buffer));
      const resampled = resampleLinear(samples, SOURCE_RATE, sampleRate);
      this.queue.push(resampled);
      while (this.queue.length > MAX_FRAMES) this.queue.shift();
      if (!this.started && this.queue.length >= MIN_FRAMES) this.started = true;
    };
  }

  process(_inputs, outputs) {
    const channel = outputs[0] && outputs[0][0];
    if (!channel) return true;
    if (!this.started) {
      channel.fill(0);
      return true;
    }
    let written = 0;
    while (written < channel.length) {
      if (!this.current || this.offset >= this.current.length) {
        this.current = this.queue.shift() || null;
        this.offset = 0;
        if (!this.current) {
          channel.fill(0, written);
          this.started = false;
          break;
        }
      }
      const take = Math.min(channel.length - written, this.current.length - this.offset);
      channel.set(this.current.subarray(this.offset, this.offset + take), written);
      this.offset += take;
      written += take;
    }
    return true;
  }
}

registerProcessor('playback-processor', PlaybackProcessor);
`;
}
