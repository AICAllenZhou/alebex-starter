/**
 * Pure PCM / resample / base64 helpers. Safe to unit-test in Node.
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

export function decodeBase64(data: string): Uint8Array {
  const trimmed = data.replace(/\s/g, '');
  if (typeof atob === 'function') {
    const bin = atob(trimmed);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }
  return Uint8Array.from(Buffer.from(trimmed, 'base64'));
}

export function encodeBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0);
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

/** Decode a base64 PCM16 LE mono payload into Float32 samples in [-1, 1]. */
export function decodeBase64Pcm16(data: string): Float32Array {
  const bytes = decodeBase64(data);
  const even = bytes.byteLength - (bytes.byteLength % 2);
  if (even <= 0) return new Float32Array(0);
  const aligned =
    bytes.byteOffset % 2 === 0 && even === bytes.byteLength
      ? bytes
      : bytes.slice(0, even);
  const samples = new Int16Array(aligned.buffer, aligned.byteOffset, even / 2);
  return pcm16ToFloat(samples);
}

export function encodeBase64Pcm16(samples: Float32Array): string {
  const pcm = floatToPcm16(samples);
  return encodeBase64(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
}
