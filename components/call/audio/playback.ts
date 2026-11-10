import { PLAYBACK } from './format';
import { nextScheduleTime } from './markHold';
import { decodeBase64Pcm16 } from './pcm';

/**
 * Schedules downlink {type:"audio"} chunks on AudioBufferSourceNodes,
 * following the official Alebex browser playback sample:
 *  - first chunk starts ~180 ms ahead; later chunks are gapless (playhead);
 *  - a mark is held and echoed only when nothing is playing
 *    (playing.size === 0), either on arrival or when the last source ends;
 *  - clear_audio stops every source, resets the playhead to 0, then echoes
 *    every held mark.
 */
export class DownlinkPlayer {
  private playhead = 0;
  private playing = new Set<AudioBufferSourceNode>();
  private heldMarks: string[] = [];
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

    const startAt = nextScheduleTime(this.context.currentTime, this.playhead, PLAYBACK.leadSeconds);
    this.playhead = startAt + buffer.duration;
    this.playing.add(source);
    source.onended = () => {
      this.playing.delete(source);
      if (this.playing.size === 0) this.sendHeldMarks();
    };
    try {
      source.start(startAt);
    } catch {
      this.playing.delete(source);
      if (this.playing.size === 0) this.sendHeldMarks();
    }
  }

  holdMark(raw: string): void {
    if (this.stopped) return;
    this.heldMarks.push(raw);
    if (this.playing.size === 0) this.sendHeldMarks();
  }

  /** Stop every source, reset the playhead to 0, and echo all held marks. */
  clearAudio(): void {
    this.stopAllSources();
    this.playhead = 0;
    this.sendHeldMarks();
  }

  stop(): void {
    this.stopped = true;
    this.stopAllSources();
    this.playhead = 0;
    this.heldMarks = [];
  }

  private sendHeldMarks(): void {
    if (this.stopped) return;
    while (this.heldMarks.length) this.onEchoMark(this.heldMarks.shift() as string);
  }

  private stopAllSources(): void {
    for (const source of this.playing) {
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
    this.playing.clear();
  }
}
