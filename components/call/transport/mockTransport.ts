import { mockAudioFrame, silencePcm16Base64, sinePcm16Base64 } from '../audio/mockAudio';
import { DownlinkPlayer } from '../audio/playback';
import type { ErrorCode, RelayEvent, RelayState, SessionTransport } from './types';

const MOCK_DOWNLINK_RATE = 24_000;

export interface MockTransportOptions {
  /** If set, emit this state once (used by ?mockState= for screenshots). */
  pinnedState?: Exclude<RelayState, 'error'>;
  pinnedError?: ErrorCode;
  /** Used with pinnedState "ended", or on its own, to emit { type: "ended", reason }. */
  pinnedEndedReason?: string;
  /** When pinning speaking, also emit demo captions. Default true. */
  pinCaptions?: boolean;
}

/**
 * In-page event source used when ?mock=1 is set, or when /api/session returns
 * mode: "mock". Emits state plus Alebex-style audio / mark / clear_audio /
 * transcript / conversation_message frames so the flow is demoable without
 * a network or a microphone.
 */
export function createMockTransport(
  options: MockTransportOptions = {},
): SessionTransport {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let stopped = false;
  let player: DownlinkPlayer | null = null;

  const later = (ms: number, fn: () => void) => {
    timers.push(setTimeout(fn, ms));
  };

  return {
    start({ audioContext, onEvent }) {
      stopped = false;
      if (audioContext && audioContext.state === 'suspended') {
        void audioContext.resume();
      }
      player = audioContext
        ? new DownlinkPlayer(audioContext, () => {
            if (!stopped) onEvent({ type: 'state', state: 'listening', derived: true });
          })
        : null;
      const emit = (event: RelayEvent) => {
        if (stopped) return;
        if (event.type === 'audio') {
          player?.enqueue(event.data, event.sampleRate);
          onEvent({ type: 'state', state: 'speaking', derived: true });
          return;
        }
        if (event.type === 'mark') {
          player?.holdMark(event.raw);
          return;
        }
        if (event.type === 'clear_audio') {
          player?.clearAudio();
          onEvent({ type: 'state', state: 'listening', derived: true });
          return;
        }
        onEvent(event);
      };

      if (options.pinnedError) {
        emit({ type: 'error', code: options.pinnedError });
        return;
      }

      if (options.pinnedState === 'ended' || options.pinnedEndedReason) {
        emit({
          type: 'ended',
          reason: options.pinnedEndedReason,
        });
        return;
      }

      if (options.pinnedState) {
        emit({ type: 'state', state: options.pinnedState });
        if (options.pinnedState === 'speaking' && options.pinCaptions !== false) {
          emitDemoCaptions(emit);
        }
        return;
      }

      runDemoSequence(emit, later, () => stopped);
    },

    stop() {
      stopped = true;
      player?.stop();
      while (timers.length) {
        clearTimeout(timers.pop());
      }
    },
  };
}

export function mockEndedEvent(reason: 'user_hangup' | 'duration_limit') {
  return { type: 'ended' as const, reason };
}

export function emitDemoCaptions(onEvent: (event: RelayEvent) => void): void {
  onEvent({
    type: 'conversation_message',
    role: 'user',
    content: '伯爵茶戚风蛋糕要提前多久订？',
  });
  onEvent({
    type: 'transcript',
    role: 'assistant',
    text: '需要提前 48 小时预订。',
    isFinal: false,
  });
}

function runDemoSequence(
  onEvent: (event: RelayEvent) => void,
  later: (ms: number, fn: () => void) => void,
  isStopped: () => boolean,
): void {
  const sine = sinePcm16Base64({
    sampleRate: MOCK_DOWNLINK_RATE,
    durationMs: 200,
    frequencyHz: 440,
  });
  const silence = silencePcm16Base64(MOCK_DOWNLINK_RATE, 80);
  const audio = (data: string): RelayEvent =>
    mockAudioFrame({ data, sampleRate: MOCK_DOWNLINK_RATE });

  onEvent({ type: 'state', state: 'connecting' });

  later(200, () => {
    if (isStopped()) return;
    onEvent({ type: 'call_started', callId: 'mock-public-1' });
    onEvent({ type: 'state', state: 'idle' });
  });

  later(400, () => {
    if (isStopped()) return;
    onEvent({
      type: 'transcript',
      role: 'assistant',
      text: '您好，我是枫巷面包坊的助理…',
      isFinal: false,
    });
    onEvent(audio(sine));
  });

  later(600, () => {
    if (isStopped()) return;
    onEvent(audio(sine));
  });

  later(800, () => {
    if (isStopped()) return;
    onEvent(audio(silence));
    onEvent({
      type: 'transcript',
      role: 'assistant',
      text: '您好，我是枫巷面包坊的助理，需要帮忙吗？',
      isFinal: true,
    });
    onEvent({
      type: 'conversation_message',
      role: 'assistant',
      content: '您好，我是枫巷面包坊的助理，需要帮忙吗？',
    });
  });

  later(1100, () => {
    if (isStopped()) return;
    onEvent({ type: 'mark', name: 'audio_end', raw: '{"type":"mark","name":"audio_end"}' });
  });

  later(2500, () => {
    if (isStopped()) return;
    onEvent(audio(sine));
  });

  later(2600, () => {
    if (isStopped()) return;
    onEvent({ type: 'clear_audio', raw: '{"type":"clear_audio"}' });
    onEvent({
      type: 'transcript',
      role: 'assistant',
      text: '请说，我在听。',
      isFinal: true,
    });
  });
}
