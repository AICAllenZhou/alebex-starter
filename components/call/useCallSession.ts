'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createTransport } from './transport/createTransport';
import type {
  CallUiState,
  ErrorCode,
  LiveCaption,
  SessionMode,
  SessionResponse,
  SessionTransport,
  TranscriptTurn,
} from './transport/types';
import { ERROR_CODES, RELAY_STATES } from './transport/types';

const DEMO_TURNS: TranscriptTurn[] = [
  {
    id: 'demo-user',
    role: 'user',
    text: '伯爵茶戚风蛋糕要提前多久订？',
    source: 'conversation',
  },
];

const DEMO_LIVE: LiveCaption = {
  role: 'assistant',
  text: '需要提前 48 小时预订。',
  isFinal: false,
};

export interface CallSession {
  state: CallUiState;
  inCall: boolean;
  errorCode: ErrorCode | null;
  endedReason: string | null;
  mode: SessionMode | null;
  liveCaption: LiveCaption | null;
  turns: TranscriptTurn[];
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
  const [liveCaption, setLiveCaption] = useState<LiveCaption | null>(initial.liveCaption);
  const [turns, setTurns] = useState<TranscriptTurn[]>(initial.turns);
  const transportRef = useRef<SessionTransport | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const optionsRef = useRef(options);

  const tearDown = useCallback(() => {
    transportRef.current?.stop();
    transportRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== 'closed') {
      void context.close();
    }
  }, []);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => () => tearDown(), [tearDown]);

  const start = useCallback(async () => {
    tearDown();
    setErrorCode(null);
    setEndedReason(null);
    setLiveCaption(null);
    setTurns([]);
    setState('connecting');
    setInCall(true);

    // Create the AudioContext inside the click handler, before any await,
    // so the browser treats it as a user gesture.
    let audioContext: AudioContext | undefined;
    if (typeof AudioContext !== 'undefined') {
      try {
        audioContext = new AudioContext();
      } catch {
        audioContext = undefined;
      }
    }

    const closeContext = async () => {
      if (audioContext && audioContext.state !== 'closed') {
        try {
          await audioContext.close();
        } catch {
          /* already closed */
        }
      }
      audioContext = undefined;
    };

    const forceMock = optionsRef.current.forceMock;
    const useRealMic = !forceMock;
    let mediaStream: MediaStream | undefined;

    if (useRealMic) {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        await closeContext();
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
        await closeContext();
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
        await closeContext();
        setState('error');
        setErrorCode('invalid_config');
        setInCall(false);
        return;
      }
      session = (await response.json()) as SessionResponse;
    } catch {
      releaseIfUnused();
      await closeContext();
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
    audioContextRef.current = audioContext ?? null;

    transport.start({
      relayUrl: session.relayUrl,
      token: session.token,
      audioContext,
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
        if (event.type === 'transcript') {
          applyTranscript(event, setLiveCaption, setTurns);
          return;
        }
        if (event.type === 'conversation_message') {
          applyConversation(event, setLiveCaption, setTurns);
          return;
        }
        if (event.type === 'state') {
          setState(event.state);
          setInCall(true);
        }
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

  return {
    state,
    inCall,
    errorCode,
    endedReason,
    mode,
    liveCaption,
    turns,
    start,
    end,
    restart,
  };
}

function applyTranscript(
  event: { role?: string; text: string; isFinal: boolean },
  setLiveCaption: (caption: LiveCaption | null) => void,
  setTurns: (updater: (prev: TranscriptTurn[]) => TranscriptTurn[]) => void,
) {
  if (event.isFinal) {
    setLiveCaption(null);
    setTurns((prev) => appendTurn(prev, event.role, event.text, 'transcript'));
    return;
  }
  setLiveCaption({ role: event.role, text: event.text, isFinal: false });
}

function applyConversation(
  event: { role?: string; content: string },
  setLiveCaption: (caption: LiveCaption | null) => void,
  setTurns: (updater: (prev: TranscriptTurn[]) => TranscriptTurn[]) => void,
) {
  setLiveCaption(null);
  setTurns((prev) => appendTurn(prev, event.role, event.content, 'conversation'));
}

function appendTurn(
  prev: TranscriptTurn[],
  role: string | undefined,
  text: string,
  source: TranscriptTurn['source'],
): TranscriptTurn[] {
  const last = prev[prev.length - 1];
  if (last && last.text === text && last.role === role) return prev;
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `turn-${prev.length}-${Date.now()}`;
  return [...prev, { id, role, text, source }];
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
  liveCaption: LiveCaption | null;
  turns: TranscriptTurn[];
} {
  if (!initialState) {
    return {
      state: 'idle',
      inCall: false,
      errorCode: null,
      endedReason: null,
      mode: null,
      liveCaption: null,
      turns: [],
    };
  }

  const errorCode =
    initialState === 'error' ? (initialErrorCode ?? 'token_expired') : null;

  const inCall =
    initialState === 'connecting' ||
    initialState === 'listening' ||
    initialState === 'speaking' ||
    initialState === 'idle';

  const showDemoCaptions = initialState === 'speaking';

  return {
    state: initialState,
    inCall,
    errorCode,
    endedReason: initialState === 'ended' ? (initialEndedReason ?? null) : null,
    mode: 'mock',
    liveCaption: showDemoCaptions ? DEMO_LIVE : null,
    turns: showDemoCaptions ? DEMO_TURNS : [],
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
