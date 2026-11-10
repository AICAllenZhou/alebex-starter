/**
 * Pure PCM / resample helpers. Safe to unit-test in Node; the AudioWorklets
 * use the same algorithms (see workletSource.ts).
 */
export function resampleLinear(
  input: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (input.length === 0) return new Float32Array(0);
  if (fromRate === toRate || fromRate <= 0 || toRate <= 0) {
    return new Float32Array(input);
  }
  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLength);
  const last = input.length - 1;
  for (let i = 0; i < outLength; i += 1) {
    const src = i * ratio;
    const i0 = Math.min(Math.floor(src), last);
    const i1 = Math.min(i0 + 1, last);
    const frac = src - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

export function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return out;
}

export function pcm16ToFloat(input: Int16Array): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = input[i] ?? 0;
    out[i] = sample < 0 ? sample / 0x8000 : sample / 0x7fff;
  }
  return out;
}

export function encodePcm16Frame(
  samples: Float32Array,
  frameSamples: number,
): ArrayBuffer {
  const frame = new Float32Array(frameSamples);
  frame.set(samples.subarray(0, frameSamples));
  const pcm = floatToPcm16(frame);
  return Uint8Array.from(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)).buffer;
}

export function decodePcm16Frame(buffer: ArrayBuffer): Float32Array {
  return pcm16ToFloat(new Int16Array(buffer));
}
