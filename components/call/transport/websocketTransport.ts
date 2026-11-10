import { RELAY_CLOSE } from '../audio/format';
import { DownlinkPlayer } from '../audio/playback';
import { startUplinkCapture, type UplinkCapture } from '../audio/session';
import { parseRelayEvent } from './parseRelayEvent';
import type { RelayEvent, SessionTransport } from './types';

/**
 * Live mid-tier adapter. Confirmed contract:
 *  - Connect to relayUrl as given; do not put the token in the URL.
 *  - After the socket opens, send {"type":"auth","token":"..."} as the first frame.
 *  - Our events: {type:"state",state}, {type:"error",code}, {type:"ended",reason}.
 *  - Close code 4401 (and/or error code token_expired) means the token is dead.
 *  - Uplink: binary PCM16 LE 16 kHz mono 20 ms, only after call_started.
 *  - Downlink: JSON {type:"audio",data,format,sample_rate}; read sample_rate
 *    per frame; schedule AudioBufferSourceNodes (180 ms lead, then gapless).
 *  - Marks are held until preceding audio finishes, then echoed unchanged.
 *  - clear_audio stops every source, then echoes all held marks immediately.
 *  - Hang up sends {type:"end_call"} then closes.
 *
 * Never import, read, or send ALEBEX_API_KEY from this module.
 */
export function createWebSocketTransport(): SessionTransport {
  let socket: WebSocket | null = null;
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let player: DownlinkPlayer | null = null;
  let uplink: UplinkCapture | null = null;
  let closedByUser = false;
  let settled = false;
  let callStarted = false;
  let uplinkStarted = false;

  const releaseStream = () => {
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  };

  const stopAudio = () => {
    player?.stop();
    player = null;
    const currentUplink = uplink;
    uplink = null;
    uplinkStarted = false;
    void currentUplink?.stop();
    releaseStream();
    audioContext = null;
  };

  const settle = () => {
    settled = true;
    stopAudio();
  };

  const sendRaw = (raw: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(raw);
  };

  const maybeDerive = (state: 'idle' | 'listening' | 'speaking', onEvent: (event: RelayEvent) => void) => {
    if (settled || closedByUser) return;
    onEvent({ type: 'state', state, derived: true });
  };

  const ensurePlayer = (onEvent: (event: RelayEvent) => void) => {
    if (player || !audioContext) return;
    player = new DownlinkPlayer(audioContext, (raw) => {
      sendRaw(raw);
      maybeDerive('listening', onEvent);
    });
    if (audioContext.state === 'suspended') void audioContext.resume();
  };

  const ensureUplink = () => {
    if (uplinkStarted || !callStarted || !audioContext || !mediaStream) return;
    uplinkStarted = true;
    const stream = mediaStream;
    const context = audioContext;
    void startUplinkCapture(context, stream, (frame) => {
      if (!callStarted || settled || closedByUser) return;
      if (socket && socket.readyState === WebSocket.OPEN) socket.send(frame);
    }).then((session) => {
      if (settled || closedByUser) {
        void session.stop();
        return;
      }
      uplink = session;
    }).catch(() => {
      // Keep the call up so downlink and captions can still run.
      uplinkStarted = false;
    });
  };

  return {
    start({ relayUrl, token, audioContext: context, mediaStream: stream, onEvent, onDisconnected }) {
      closedByUser = false;
      settled = false;
      callStarted = false;
      uplinkStarted = false;
      mediaStream = stream ?? null;
      audioContext = context ?? null;
      player = null;
      uplink = null;

      let url: URL;
      try {
        url = new URL(relayUrl);
      } catch {
        onEvent({ type: 'error', code: 'invalid_config' });
        stopAudio();
        return;
      }
      if (url.searchParams.has('token')) {
        url.searchParams.delete('token');
      }

      try {
        socket = new WebSocket(url.toString());
      } catch {
        stopAudio();
        onDisconnected();
        return;
      }

      socket.binaryType = 'arraybuffer';
      ensurePlayer(onEvent);

      socket.addEventListener('open', () => {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({ type: 'auth', token }));
      });

      socket.addEventListener('message', (event) => {
        // Downlink is JSON audio; ignore unexpected binary inbound.
        if (typeof event.data !== 'string') return;

        const parsed = parseRelayEvent(event.data);
        if (!parsed) return;

        if (parsed.type === 'error') {
          settle();
          onEvent(parsed);
          closeSocket();
          return;
        }

        if (parsed.type === 'ended') {
          settle();
          onEvent(parsed);
          closeSocket();
          return;
        }

        if (parsed.type === 'state') {
          onEvent(parsed);
          return;
        }

        if (parsed.type === 'call_started') {
          callStarted = true;
          ensureUplink();
          onEvent(parsed);
          maybeDerive('idle', onEvent);
          return;
        }

        if (parsed.type === 'audio') {
          ensurePlayer(onEvent);
          player?.enqueue(parsed.data, parsed.sampleRate);
          maybeDerive('speaking', onEvent);
          return;
        }

        if (parsed.type === 'mark') {
          ensurePlayer(onEvent);
          player?.holdMark(parsed.raw);
          return;
        }

        if (parsed.type === 'clear_audio') {
          ensurePlayer(onEvent);
          player?.clearAudio();
          maybeDerive('listening', onEvent);
          return;
        }

        if (parsed.type === 'transcript' || parsed.type === 'conversation_message') {
          onEvent(parsed);
        }
      });

      socket.addEventListener('error', () => {
        // The subsequent `close` event decides the UI outcome.
      });

      socket.addEventListener('close', (event) => {
        socket = null;
        if (closedByUser) {
          stopAudio();
          return;
        }
        if (event.code === RELAY_CLOSE.tokenExpired) {
          if (!settled) {
            settled = true;
            stopAudio();
            onEvent({ type: 'error', code: 'token_expired' });
          } else {
            stopAudio();
          }
          return;
        }
        if (settled) {
          stopAudio();
          return;
        }
        stopAudio();
        onDisconnected();
      });
    },

    stop() {
      closedByUser = true;
      settled = true;
      if (socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ type: 'end_call' }));
        } catch {
          /* already closing */
        }
      }
      closeSocket();
      stopAudio();
    },
  };

  function closeSocket() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      socket.close();
    }
    socket = null;
  }
}
