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
