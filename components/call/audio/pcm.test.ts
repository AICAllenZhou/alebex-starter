import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AUDIO_FORMAT } from './format';
import {
  decodePcm16Frame,
  encodePcm16Frame,
  floatToPcm16,
  pcm16ToFloat,
  resampleLinear,
} from './pcm';

describe('AUDIO_FORMAT', () => {
  it('describes 16 kHz mono PCM16 in 20 ms / 640-byte frames', () => {
    assert.equal(AUDIO_FORMAT.sampleRate, 16_000);
    assert.equal(AUDIO_FORMAT.channels, 1);
    assert.equal(AUDIO_FORMAT.frameDurationMs, 20);
    assert.equal(AUDIO_FORMAT.samplesPerFrame, 320);
    assert.equal(AUDIO_FORMAT.bytesPerFrame, 640);
  });
});

describe('resampleLinear', () => {
  it('is a no-op when rates match', () => {
    const input = Float32Array.from([0, 0.5, 1]);
    const out = resampleLinear(input, 16_000, 16_000);
    assert.deepEqual(Array.from(out), [0, 0.5, 1]);
  });

  it('downsamples 48 kHz to 16 kHz at a 3:1 ratio', () => {
    const input = new Float32Array(960);
    for (let i = 0; i < input.length; i += 1) input[i] = i / input.length;
    const out = resampleLinear(input, 48_000, 16_000);
    assert.equal(out.length, 320);
    assert.ok(Math.abs((out[0] ?? 0) - (input[0] ?? 0)) < 1e-9);
    assert.ok((out[out.length - 1] ?? 0) > 0.9);
  });

  it('returns an empty buffer for empty input', () => {
    assert.equal(resampleLinear(new Float32Array(0), 48_000, 16_000).length, 0);
  });
});

describe('pcm16 encode/decode', () => {
  it('round-trips a 20 ms frame to 640 bytes', () => {
    const samples = new Float32Array(AUDIO_FORMAT.samplesPerFrame);
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = Math.sin((2 * Math.PI * i) / samples.length) * 0.5;
    }
    const encoded = encodePcm16Frame(samples, AUDIO_FORMAT.samplesPerFrame);
    assert.equal(encoded.byteLength, AUDIO_FORMAT.bytesPerFrame);
    const decoded = decodePcm16Frame(encoded);
    assert.equal(decoded.length, AUDIO_FORMAT.samplesPerFrame);
    for (let i = 0; i < samples.length; i += 1) {
      assert.ok(Math.abs((decoded[i] ?? 0) - (samples[i] ?? 0)) < 2 / 0x7fff);
    }
  });

  it('clamps values outside [-1, 1]', () => {
    const encoded = floatToPcm16(Float32Array.from([2, -2, 1, -1]));
    assert.equal(encoded[0], 0x7fff);
    assert.equal(encoded[1], -0x8000);
    assert.equal(encoded[2], 0x7fff);
    assert.equal(encoded[3], -0x8000);
  });

  it('maps silence to zero', () => {
    const zeros = pcm16ToFloat(floatToPcm16(new Float32Array(8)));
    assert.deepEqual(Array.from(zeros), [0, 0, 0, 0, 0, 0, 0, 0]);
  });
});
