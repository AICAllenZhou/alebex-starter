import { RELAY_CLOSE } from '../audio/format';
import { startCallAudio, type CallAudio } from '../audio/session';
import { parseRelayEvent } from './parseRelayEvent';
import type { SessionTransport } from './types';

/**
 * Live mid-tier adapter. Confirmed contract:
 *  - Connect to relayUrl as given; do not put the token in the URL.
 *  - After the socket opens, send {"type":"auth","token":"..."} as the first frame.
 *  - JSON events: {type:"state",state}, {type:"error",code}, {type:"ended",reason}.
 *  - Close code 4401 (and/or error code token_expired) means the token is dead.
 *  - Binary frames are provisional PCM16 mono 16 kHz, 20 ms (640 bytes).
 *
 * Never import, read, or send ALEBEX_API_KEY from this module.
 */
export function createWebSocketTransport(): SessionTransport {
  let socket: WebSocket | null = null;
  let audio: CallAudio | null = null;
  let mediaStream: MediaStream | null = null;
  let closedByUser = false;
  let settled = false;
  let audioStarted = false;

  const releaseStream = () => {
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  };

  const stopAudio = () => {
    const current = audio;
    audio = null;
    audioStarted = false;
    void current?.stop();
    releaseStream();
  };

  const settle = () => {
    settled = true;
    stopAudio();
  };

  const ensureAudio = (
    onUplink: (frame: ArrayBuffer) => void,
    onEvent: Parameters<SessionTransport['start']>[0]['onEvent'],
  ) => {
    if (audioStarted || !mediaStream) return;
    audioStarted = true;
    void startCallAudio(mediaStream, onUplink)
      .then((session) => {
        if (settled || closedByUser) {
          void session.stop();
          return;
        }
        audio = session;
      })
      .catch(() => {
        if (!settled && !closedByUser) {
          settled = true;
          stopAudio();
          onEvent({ type: 'error', code: 'invalid_config' });
        }
      });
  };

  return {
    start({ relayUrl, token, mediaStream: stream, onEvent, onDisconnected }) {
      closedByUser = false;
      settled = false;
      audioStarted = false;
      mediaStream = stream ?? null;

      let url: URL;
      try {
        url = new URL(relayUrl);
      } catch {
        onEvent({ type: 'error', code: 'invalid_config' });
        releaseStream();
        return;
      }
      // Token stays off the URL; it goes in the first frame after open.
      if (url.searchParams.has('token')) {
        url.searchParams.delete('token');
      }

      try {
        socket = new WebSocket(url.toString());
      } catch {
        releaseStream();
        onDisconnected();
        return;
      }

      socket.binaryType = 'arraybuffer';

      socket.addEventListener('open', () => {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({ type: 'auth', token }));
      });

      socket.addEventListener('message', (event) => {
        if (event.data instanceof ArrayBuffer) {
          audio?.playDownlink(event.data);
          return;
        }
        if (typeof Blob !== 'undefined' && event.data instanceof Blob) {
          void event.data.arrayBuffer().then((buffer) => audio?.playDownlink(buffer));
          return;
        }

        const parsed = parseRelayEvent(event.data);
        if (!parsed) return;

        if (parsed.type === 'error') {
          settle();
          onEvent(parsed);
          if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
            socket.close();
          }
          socket = null;
          return;
        }

        if (parsed.type === 'ended') {
          settle();
          onEvent(parsed);
          if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
            socket.close();
          }
          socket = null;
          return;
        }

        onEvent(parsed);
        ensureAudio((frame) => {
          if (socket && socket.readyState === WebSocket.OPEN) socket.send(frame);
        }, onEvent);
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
      stopAudio();
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
      socket = null;
    },
  };
}
