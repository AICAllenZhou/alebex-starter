import { PLAYBACK } from './format';

export type HeldMark = {
  raw: string;
  releaseAt: number;
};

/**
 * Hold mark frames until all audio that was already queued when the mark
 * arrived has finished playing. clear_audio flushes every held mark at once.
 *
 * Times are in the same unit as the clock passed to releaseDue (AudioContext
 * currentTime in production, a fake clock in tests).
 */
export class MarkHold {
  private held: HeldMark[] = [];

  hold(raw: string, releaseAt: number): void {
    this.held.push({ raw, releaseAt });
  }

  releaseDue(now: number, epsilon = 1e-4): HeldMark[] {
    const due: HeldMark[] = [];
    const rest: HeldMark[] = [];
    for (const mark of this.held) {
      if (mark.releaseAt <= now + epsilon) due.push(mark);
      else rest.push(mark);
    }
    this.held = rest;
    return due;
  }

  /** Return every held mark and empty the list (clear_audio). */
  flush(): HeldMark[] {
    const all = this.held;
    this.held = [];
    return all;
  }

  get size(): number {
    return this.held.length;
  }

  peek(): HeldMark[] {
    return this.held.slice();
  }
}

/**
 * First chunk starts `lead` seconds ahead of `now`. Later chunks are
 * scheduled back-to-back at `cursor` unless the cursor has fallen behind,
 * in which case we re-apply the lead to avoid starting in the past.
 */
export function nextScheduleTime(
  now: number,
  cursor: number,
  lead = PLAYBACK.leadSeconds,
): number {
  if (cursor < now + lead) return now + lead;
  return cursor;
}

export function advanceCursor(
  now: number,
  cursor: number,
  duration: number,
  lead = PLAYBACK.leadSeconds,
): { startAt: number; nextTime: number } {
  const startAt = nextScheduleTime(now, cursor, lead);
  return { startAt, nextTime: startAt + duration };
}

/** Whether a mark should be echoed immediately (no audio is still queued). */
export function shouldEchoImmediately(
  now: number,
  queuedAudioEndsAt: number,
  epsilon = 1e-4,
): boolean {
  return queuedAudioEndsAt <= now + epsilon;
}
