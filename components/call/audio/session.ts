import { captureWorkletSource, playbackWorkletSource } from './workletSource';

export interface CallAudio {
  playDownlink(frame: ArrayBuffer): void;
  stop(): Promise<void>;
}

/**
 * Captures getUserMedia audio through an AudioWorklet (resampled to the
 * shared 16 kHz / 20 ms PCM16 format) and plays downlink frames of the same
 * format through a second worklet with a small jitter buffer.
 */
export async function startCallAudio(
  stream: MediaStream,
  onUplinkFrame: (frame: ArrayBuffer) => void,
): Promise<CallAudio> {
  const context = new AudioContext();
  const captureUrl = URL.createObjectURL(
    new Blob([captureWorkletSource()], { type: 'application/javascript' }),
  );
  const playbackUrl = URL.createObjectURL(
    new Blob([playbackWorkletSource()], { type: 'application/javascript' }),
  );

  const disposeUrls = () => {
    URL.revokeObjectURL(captureUrl);
    URL.revokeObjectURL(playbackUrl);
  };

  const stopTracks = () => {
    stream.getTracks().forEach((track) => track.stop());
  };

  try {
    await context.audioWorklet.addModule(captureUrl);
    await context.audioWorklet.addModule(playbackUrl);

    const source = context.createMediaStreamSource(stream);
    const capture = new AudioWorkletNode(context, 'capture-processor');
    const playback = new AudioWorkletNode(context, 'playback-processor');

    capture.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (event.data instanceof ArrayBuffer) onUplinkFrame(event.data);
    };

    source.connect(capture);
    playback.connect(context.destination);
    if (context.state === 'suspended') await context.resume();

    let stopped = false;
    return {
      playDownlink(frame: ArrayBuffer) {
        if (stopped) return;
        const copy = frame.slice(0);
        playback.port.postMessage(copy, [copy]);
      },
      async stop() {
        if (stopped) return;
        stopped = true;
        capture.port.onmessage = null;
        try {
          source.disconnect();
        } catch {
          /* already disconnected */
        }
        try {
          capture.disconnect();
        } catch {
          /* already disconnected */
        }
        try {
          playback.disconnect();
        } catch {
          /* already disconnected */
        }
        stopTracks();
        if (context.state !== 'closed') await context.close();
        disposeUrls();
      },
    };
  } catch (error) {
    stopTracks();
    if (context.state !== 'closed') await context.close();
    disposeUrls();
    throw error;
  }
}
