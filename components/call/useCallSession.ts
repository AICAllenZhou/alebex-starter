'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createTransport } from './transport/createTransport';
import type {
  CallUiState,
  ErrorCode,
  SessionMode,
  SessionResponse,
  SessionTransport,
} from './transport/types';
import { ERROR_CODES, RELAY_STATES } from './transport/types';

export interface CallSession {
  state: CallUiState;
  inCall: boolean;
  errorCode: ErrorCode | null;
  endedReason: string | null;
  mode: SessionMode | null;
  start: () => Promise<void>;
  end: () => void;
  restart: () => Promise<void>;
}

interface Options {
  forceMock: boolean;
  /** When set, render this state immediately (screenshot / review hooks). */
  initialState?: CallUiState;
  initialErrorCode?: ErrorCode;
  initialEndedReason?: string;
}

export function useCallSession(options: Options): CallSession {
  const initial = normalizeInitial(
    options.initialState,
    options.initialErrorCode,
    options.initialEndedReason,
  );
  const [state, setState] = useState<CallUiState>(initial.state);
  const [inCall, setInCall] = useState(initial.inCall);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(initial.errorCode);
  const [endedReason, setEndedReason] = useState<string | null>(initial.endedReason);
  const [mode, setMode] = useState<SessionMode | null>(initial.mode);
  const transportRef = useRef<SessionTransport | null>(null);
  const optionsRef = useRef(options);

  const tearDown = useCallback(() => {
    transportRef.current?.stop();
    transportRef.current = null;
  }, []);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => () => tearDown(), [tearDown]);

  const start = useCallback(async () => {
    tearDown();
    setErrorCode(null);
    setEndedReason(null);
    setState('connecting');
    setInCall(true);

    const forceMock = optionsRef.current.forceMock;
    const useRealMic = !forceMock;
    let mediaStream: MediaStream | undefined;

    if (useRealMic) {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setState('error');
        setErrorCode('invalid_config');
        setInCall(false);
        return;
      }
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (error) {
        const name = error instanceof Error ? error.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setState('mic_denied');
          setInCall(false);
          return;
        }
        setState('error');
        setErrorCode('invalid_config');
        setInCall(false);
        return;
      }
    }

    const releaseIfUnused = () => {
      mediaStream?.getTracks().forEach((track) => track.stop());
      mediaStream = undefined;
    };

    let session: SessionResponse;
    try {
      const response = await fetch('/api/session', { method: 'POST' });
      if (!response.ok) {
        releaseIfUnused();
        setState('error');
        setErrorCode('invalid_config');
        setInCall(false);
        return;
      }
      session = (await response.json()) as SessionResponse;
    } catch {
      releaseIfUnused();
      setState('disconnected');
      setInCall(false);
      return;
    }

    const sessionMode: SessionMode =
      session.mode === 'relay' && !forceMock ? 'relay' : 'mock';
    setMode(sessionMode);

    if (sessionMode === 'mock') {
      releaseIfUnused();
    }

    const transport = createTransport({
      mode: sessionMode,
      forceMock,
      mock: {},
    });
    transportRef.current = transport;

    transport.start({
      relayUrl: session.relayUrl,
      token: session.token,
      mediaStream,
      onEvent: (event) => {
        if (event.type === 'error') {
          setErrorCode(event.code);
          setEndedReason(null);
          setState('error');
          setInCall(false);
          tearDown();
          return;
        }
        if (event.type === 'ended') {
          setEndedReason(event.reason ?? null);
          setErrorCode(null);
          setState('ended');
          setInCall(false);
          tearDown();
          return;
        }
        setState(event.state);
        setInCall(true);
      },
      onDisconnected: () => {
        setState('disconnected');
        setInCall(false);
        setEndedReason(null);
        tearDown();
      },
    });
  }, [tearDown]);

  const end = useCallback(() => {
    tearDown();
    setState('ended');
    setInCall(false);
    setErrorCode(null);
    setEndedReason('user_hangup');
  }, [tearDown]);

  const restart = useCallback(async () => {
    setErrorCode(null);
    setEndedReason(null);
    // Always goes through POST /api/session again so an expired token is replaced.
    await start();
  }, [start]);

  return { state, inCall, errorCode, endedReason, mode, start, end, restart };
}

function normalizeInitial(
  initialState: CallUiState | undefined,
  initialErrorCode: ErrorCode | undefined,
  initialEndedReason: string | undefined,
): {
  state: CallUiState;
  inCall: boolean;
  errorCode: ErrorCode | null;
  endedReason: string | null;
  mode: SessionMode | null;
} {
  if (!initialState) {
    return {
      state: 'idle',
      inCall: false,
      errorCode: null,
      endedReason: null,
      mode: null,
    };
  }

  const errorCode =
    initialState === 'error' ? (initialErrorCode ?? 'token_expired') : null;

  // A pinned "idle" from ?mockState=idle is the in-call idle state. The
  // landing page (no mockState) stays as pre-call idle, inCall false.
  const inCall =
    initialState === 'connecting' ||
    initialState === 'listening' ||
    initialState === 'speaking' ||
    initialState === 'idle';

  return {
    state: initialState,
    inCall,
    errorCode,
    endedReason: initialState === 'ended' ? (initialEndedReason ?? null) : null,
    mode: 'mock',
  };
}

export function parseMockState(value: string | null): CallUiState | undefined {
  if (!value) return undefined;
  if (
    (RELAY_STATES as readonly string[]).includes(value) ||
    value === 'mic_denied' ||
    value === 'disconnected'
  ) {
    return value as CallUiState;
  }
  return undefined;
}

export function parseErrorCode(value: string | null): ErrorCode | undefined {
  if (value && (ERROR_CODES as readonly string[]).includes(value)) {
    return value as ErrorCode;
  }
  return undefined;
}

export function parseEndedReasonParam(value: string | null): string | undefined {
  return value && value.length > 0 ? value : undefined;
}
