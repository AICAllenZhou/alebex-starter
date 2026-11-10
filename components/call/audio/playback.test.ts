import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DownlinkPlayer } from './playback';

type FakeSource = {
  buffer: { duration: number } | null;
  onended: (() => void) | null;
  startedAt?: number;
  stopped: boolean;
  connect(): void;
  disconnect(): void;
  start(t: number): void;
  stop(): void;
};

function fakeContext() {
  const sources: FakeSource[] = [];
  const ctx = {
    currentTime: 0,
    destination: {},
    createBuffer(_c: number, length: number, rate: number) {
      return { duration: length / rate, copyToChannel() {} };
    },
    createBufferSource() {
      const s: FakeSource = {
        buffer: null,
        onended: null,
        stopped: false,
        connect() {},
        disconnect() {},
        start(t) {
          s.startedAt = t;
        },
        stop() {
          s.stopped = true;
        },
      };
      sources.push(s);
      return s;
    },
  };
  return { ctx: ctx as unknown as AudioContext, raw: ctx, sources };
}

// 2400 samples of silence at 24 kHz = 100 ms
const chunk = Buffer.alloc(4800).toString('base64');

describe('DownlinkPlayer (official sample semantics)', () => {
  it('echoes a mark at once when nothing is playing', () => {
    const { ctx } = fakeContext();
    const echoed: string[] = [];
    const p = new DownlinkPlayer(ctx, (m) => echoed.push(m));
    p.holdMark('m1');
    assert.deepEqual(echoed, ['m1']);
  });

  it('holds a mark until playing.size === 0, including audio queued after it', () => {
    const { ctx, sources } = fakeContext();
    const echoed: string[] = [];
    const p = new DownlinkPlayer(ctx, (m) => echoed.push(m));
    p.enqueue(chunk, 24000);
    p.holdMark('m1');
    p.enqueue(chunk, 24000);
    sources[0].onended?.();
    assert.deepEqual(echoed, []);
    sources[1].onended?.();
    assert.deepEqual(echoed, ['m1']);
  });

  it('schedules gapless chunks with ~180 ms lead', () => {
    const { ctx, sources } = fakeContext();
    const p = new DownlinkPlayer(ctx, () => {});
    p.enqueue(chunk, 24000);
    p.enqueue(chunk, 24000);
    assert.ok(Math.abs((sources[0].startedAt ?? 0) - 0.18) < 1e-9);
    assert.ok(Math.abs((sources[1].startedAt ?? 0) - 0.28) < 1e-9);
  });

  it('clear_audio stops all, resets playhead to 0, and echoes held marks', () => {
    const { ctx, raw, sources } = fakeContext();
    const echoed: string[] = [];
    const p = new DownlinkPlayer(ctx, (m) => echoed.push(m));
    p.enqueue(chunk, 24000);
    p.holdMark('m1');
    p.holdMark('m2');
    p.clearAudio();
    assert.ok(sources[0].stopped);
    assert.deepEqual(echoed, ['m1', 'm2']);
    raw.currentTime = 0.05;
    p.enqueue(chunk, 24000);
    assert.ok(Math.abs((sources[1].startedAt ?? 0) - 0.23) < 1e-9);
  });
});
