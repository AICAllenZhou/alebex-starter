import { PLAYBACK } from './format';
import { MarkHold, nextScheduleTime, shouldEchoImmediately } from './markHold';
import { decodeBase64Pcm16 } from './pcm';

/**
 * Schedules downlink {type:"audio"} chunks on AudioBufferSourceNodes.
 * The first chunk starts ~180 ms ahead; later chunks are gapless.
 * Marks are echoed only after audio queued before them has finished.
 * clear_audio stops every scheduled/playing source, then flushes marks.
 */
export class DownlinkPlayer {
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private marks = new MarkHold();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly context: AudioContext,
    private readonly onEchoMark: (raw: string) => void,
  ) {}

  enqueue(data: string, sampleRate: number): void {
    if (this.stopped) return;
    if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) return;
    const samples = decodeBase64Pcm16(data);
    if (samples.length === 0) return;

    const buffer = this.context.createBuffer(1, samples.length, sampleRate);
    const channel = new Float32Array(samples.length);
    channel.set(samples);
    buffer.copyToChannel(channel, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);

    const now = this.context.currentTime;
    const startAt = nextScheduleTime(now, this.nextTime, PLAYBACK.leadSeconds);
    this.nextTime = startAt + buffer.duration;
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      this.flushDueMarks();
    };
    try {
      source.start(startAt);
    } catch {
      this.sources.delete(source);
    }
    this.armTimer();
  }

  holdMark(raw: string): void {
    if (this.stopped) return;
    const now = this.context.currentTime;
    if (shouldEchoImmediately(now, this.nextTime)) {
      this.onEchoMark(raw);
      return;
    }
    this.marks.hold(raw, this.nextTime);
    this.armTimer();
  }

  /** Stop every source (playing or scheduled) and echo all held marks now. */
  clearAudio(): void {
    this.stopAllSources();
    this.nextTime = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const flushed = this.marks.flush();
    for (const mark of flushed) this.onEchoMark(mark.raw);
  }

  stop(): void {
    this.stopped = true;
    this.stopAllSources();
    this.nextTime = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.marks.flush();
  }

  private stopAllSources(): void {
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      try {
        source.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.sources.clear();
  }

  private flushDueMarks(): void {
    if (this.stopped) return;
    const due = this.marks.releaseDue(this.context.currentTime);
    for (const mark of due) this.onEchoMark(mark.raw);
    this.armTimer();
  }

  private armTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.stopped || this.marks.size === 0) return;
    const next = this.marks.peek()[0];
    if (!next) return;
    const delayMs = Math.max(0, (next.releaseAt - this.context.currentTime) * 1000) + 5;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flushDueMarks();
    }, delayMs);
  }
}
