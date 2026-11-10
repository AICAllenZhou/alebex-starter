'use client';

import { useSearchParams } from 'next/navigation';
import { AnimatedContent, ClickSpark, FadeContent } from './motion';
import { isLiveCallState, isRecoverableState, statusText } from './statusCopy';
import type { LiveCaption, TranscriptTurn } from './transport/types';
import { parseEndedReasonParam, parseErrorCode, parseMockState, useCallSession } from './useCallSession';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export default function CallPage() {
  const searchParams = useSearchParams();
  const forceMock = searchParams.get('mock') === '1';
  const initialState = parseMockState(searchParams.get('mockState'));
  const initialErrorCode = parseErrorCode(searchParams.get('errorCode'));
  const initialEndedReason = parseEndedReasonParam(searchParams.get('endedReason'));
  const reducedMotion = usePrefersReducedMotion();

  const session = useCallSession({
    forceMock,
    initialState,
    initialErrorCode,
    initialEndedReason,
  });

  const live = isLiveCallState(session.state, session.inCall);
  const recoverable = isRecoverableState(session.state);
  const ready = session.state === 'idle' && !session.inCall;
  const label = statusText(session.state, {
    inCall: session.inCall,
    errorCode: session.errorCode,
    endedReason: session.endedReason,
  });

  const primaryLabel = recoverable ? '重新开始' : '开始通话';
  const showPrimary = ready || recoverable;
  const showEnd = live;
  const hasCaptions = session.turns.length > 0 || session.liveCaption !== null;

  return (
    <main
      className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-16 text-center"
      data-call-state={session.state}
      data-in-call={session.inCall ? 'true' : 'false'}
      data-error-code={session.errorCode ?? ''}
      data-ended-reason={session.endedReason ?? ''}
      data-captions={hasCaptions ? 'true' : 'false'}
      data-mock={forceMock || session.mode === 'mock' ? 'true' : 'false'}
    >
      <FadeContent trigger="mount" duration={0.7} blur={false}>
        <h1 className="text-2xl font-medium tracking-tight text-stone-900 sm:text-3xl">
          这是一次语音通话测试
        </h1>
      </FadeContent>

      <AnimatedContent
        key={`${session.state}-${session.inCall}-${session.errorCode ?? ''}-${session.endedReason ?? ''}`}
        trigger="mount"
        distance={16}
        duration={0.45}
        className="mt-6"
      >
        <p
          role="status"
          aria-live="polite"
          className="text-base text-stone-600 sm:text-lg"
          data-status-text
        >
          {label}
        </p>
      </AnimatedContent>

      <div className="mt-10 flex flex-col items-center gap-4">
        {showPrimary ? (
          <ClickSpark
            sparkColor="#c2410c"
            sparkCount={10}
            sparkRadius={28}
            sparkSize={12}
            duration={450}
            disabled={reducedMotion}
            className="inline-flex h-auto w-auto"
          >
            <button
              type="button"
              onClick={() => {
                void (recoverable ? session.restart() : session.start());
              }}
              className="rounded-full bg-orange-700 px-8 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-orange-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 disabled:opacity-60"
            >
              {primaryLabel}
            </button>
          </ClickSpark>
        ) : null}

        {showEnd ? (
          <button
            type="button"
            onClick={session.end}
            className="rounded-full border border-stone-300 bg-white px-8 py-3 text-base font-medium text-stone-800 shadow-sm transition-colors hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400"
          >
            结束通话
          </button>
        ) : null}
      </div>

      {hasCaptions ? (
        <Captions turns={session.turns} live={session.liveCaption} />
      ) : null}
    </main>
  );
}

function Captions({
  turns,
  live,
}: {
  turns: TranscriptTurn[];
  live: LiveCaption | null;
}) {
  return (
    <section
      className="mt-10 w-full max-w-md text-left"
      aria-label="通话字幕"
      data-captions-panel
    >
      {turns.length > 0 ? (
        <ol className="space-y-2" data-caption-turns>
          {turns.map((turn) => (
            <li key={turn.id} className="text-sm leading-6 text-stone-700">
              <span className="mr-2 font-medium text-stone-500">{roleLabel(turn.role)}：</span>
              <span>{turn.text}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {live ? (
        <p
          className="mt-2 text-sm italic leading-6 text-stone-500"
          aria-live="polite"
          data-caption-live
        >
          <span className="mr-2 font-medium not-italic">{roleLabel(live.role)}：</span>
          {live.text}
        </p>
      ) : null}
    </section>
  );
}

function roleLabel(role?: string): string {
  const value = (role ?? '').toLowerCase();
  if (value === 'user' || value === 'caller' || value === 'human') return '你';
  if (value === 'agent' || value === 'assistant' || value === 'ai' || value === 'bot') return '客服';
  return role ? `${role}` : '客服';
}
