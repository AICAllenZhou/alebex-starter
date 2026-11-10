import { captureWorkletSource } from './workletSource';

export interface UplinkCapture {
  stop(): Promise<void>;
}

/**
 * Mic capture only, started after `call_started`. Uses the AudioContext
 * created in the user's click handler. Does not close that context.
 */
export async function startUplinkCapture(
  context: AudioContext,
  stream: MediaStream,
  onUplinkFrame: (frame: ArrayBuffer) => void,
): Promise<UplinkCapture> {
  const captureUrl = URL.createObjectURL(
    new Blob([captureWorkletSource()], { type: 'application/javascript' }),
  );

  const stopTracks = () => {
    stream.getTracks().forEach((track) => track.stop());
  };

  try {
    await context.audioWorklet.addModule(captureUrl);
    const source = context.createMediaStreamSource(stream);
    const capture = new AudioWorkletNode(context, 'capture-processor');
    capture.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (event.data instanceof ArrayBuffer) onUplinkFrame(event.data);
    };
    source.connect(capture);
    if (context.state === 'suspended') await context.resume();

    let stopped = false;
    return {
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
        stopTracks();
        URL.revokeObjectURL(captureUrl);
      },
    };
  } catch (error) {
    stopTracks();
    URL.revokeObjectURL(captureUrl);
    throw error;
  }
}
