import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RELAY_CLOSE } from '../audio/format';
import { parseRelayEvent } from './parseRelayEvent';

describe('parseRelayEvent', () => {
  it('parses state events', () => {
    assert.deepEqual(parseRelayEvent('{"type":"state","state":"listening"}'), {
      type: 'state',
      state: 'listening',
    });
  });

  it('parses error events including token_expired', () => {
    assert.deepEqual(parseRelayEvent({ type: 'error', code: 'token_expired' }), {
      type: 'error',
      code: 'token_expired',
    });
  });

  it('parses ended events and keeps known reasons', () => {
    assert.deepEqual(parseRelayEvent({ type: 'ended', reason: 'user_hangup' }), {
      type: 'ended',
      reason: 'user_hangup',
    });
    assert.deepEqual(parseRelayEvent({ type: 'ended', reason: 'duration_limit' }), {
      type: 'ended',
      reason: 'duration_limit',
    });
  });

  it('keeps unknown ended reasons for generic UI text', () => {
    assert.deepEqual(parseRelayEvent({ type: 'ended', reason: 'network_glitch' }), {
      type: 'ended',
      reason: 'network_glitch',
    });
    assert.deepEqual(parseRelayEvent({ type: 'ended' }), {
      type: 'ended',
      reason: undefined,
    });
  });

  it('normalizes {type:state,state:ended} into an ended event', () => {
    assert.deepEqual(
      parseRelayEvent({ type: 'state', state: 'ended', reason: 'duration_limit' }),
      { type: 'ended', reason: 'duration_limit' },
    );
  });

  it('parses call_started and call_ended', () => {
    assert.deepEqual(parseRelayEvent({ type: 'call_started', call_id: 'public-1' }), {
      type: 'call_started',
      callId: 'public-1',
    });
    assert.deepEqual(parseRelayEvent({ type: 'call_ended', reason: 'call_limit' }), {
      type: 'ended',
      reason: 'duration_limit',
    });
    assert.deepEqual(parseRelayEvent({ type: 'call_ended', ended_by: 'user' }), {
      type: 'ended',
      reason: 'user_hangup',
    });
  });

  it('parses audio frames and reads sample_rate from each frame', () => {
    const parsed = parseRelayEvent({
      type: 'audio',
      data: 'AAA=',
      format: 'pcm16',
      sample_rate: 24000,
    });
    assert.deepEqual(parsed, {
      type: 'audio',
      data: 'AAA=',
      format: 'pcm16',
      sampleRate: 24000,
    });
    const otherRate = parseRelayEvent({
      type: 'audio',
      data: 'AAA=',
      sampleRate: '16000',
    });
    assert.equal(otherRate && otherRate.type === 'audio' && otherRate.sampleRate, 16000);
    assert.equal(parseRelayEvent({ type: 'audio', data: 'AAA=' }), null);
  });

  it('keeps mark and clear_audio raw text unchanged', () => {
    const mark = '{"type":"mark","name":"audio_end"}';
    assert.deepEqual(parseRelayEvent(mark), {
      type: 'mark',
      name: 'audio_end',
      raw: mark,
    });
    const clear = '{"type":"clear_audio"}';
    assert.deepEqual(parseRelayEvent(clear), { type: 'clear_audio', raw: clear });
  });

  it('parses transcripts and conversation_message defensively', () => {
    assert.deepEqual(
      parseRelayEvent({ type: 'transcript', role: 'agent', text: '你好', is_final: false }),
      { type: 'transcript', role: 'agent', text: '你好', isFinal: false },
    );
    assert.deepEqual(
      parseRelayEvent({
        type: 'conversation_message',
        role: 'user',
        content: [{ text: '提前多久订？' }],
        timestamp: '2026-11-10T12:00:00Z',
      }),
      {
        type: 'conversation_message',
        role: 'user',
        content: '提前多久订？',
        timestamp: '2026-11-10T12:00:00Z',
      },
    );
    assert.deepEqual(
      parseRelayEvent({
        type: 'conversationMessage',
        message: { role: 'assistant', content: '48 小时。' },
      }),
      {
        type: 'conversation_message',
        role: 'assistant',
        content: '48 小时。',
        timestamp: undefined,
      },
    );
  });

  it('ignores the auth frame shape and unknown messages', () => {
    assert.equal(parseRelayEvent({ type: 'auth', token: 'secret' }), null);
    assert.equal(parseRelayEvent('not-json'), null);
  });
});

describe('RELAY_CLOSE', () => {
  it('uses 4401 for an expired token', () => {
    assert.equal(RELAY_CLOSE.tokenExpired, 4401);
  });
});
