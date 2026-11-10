import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PLAYBACK } from './format';
import {
  MarkHold,
  advanceCursor,
  nextScheduleTime,
  shouldEchoImmediately,
} from './markHold';

describe('nextScheduleTime', () => {
  it('starts the first chunk ~180 ms ahead', () => {
    assert.equal(PLAYBACK.leadSeconds, 0.18);
    assert.equal(nextScheduleTime(1, 0), 1.18);
  });

  it('schedules subsequent chunks back-to-back when the cursor is ahead', () => {
    const first = advanceCursor(1, 0, 0.2);
    assert.equal(first.startAt, 1.18);
    assert.equal(first.nextTime, 1.38);
    const second = advanceCursor(1.02, first.nextTime, 0.2);
    assert.equal(second.startAt, first.nextTime);
    assert.ok(Math.abs(second.nextTime - 1.58) < 1e-12);
  });

  it('re-applies the lead after an underrun', () => {
    assert.equal(nextScheduleTime(3, 1.58), 3.18);
  });
});

describe('MarkHold', () => {
  it('holds a mark until queued audio has finished', () => {
    const marks = new MarkHold();
    marks.hold('{"type":"mark","name":"audio_end"}', 1.38);
    assert.equal(marks.size, 1);
    assert.deepEqual(marks.releaseDue(1.2), []);
    assert.equal(marks.size, 1);
    const due = marks.releaseDue(1.38);
    assert.equal(due.length, 1);
    assert.equal(due[0]?.raw, '{"type":"mark","name":"audio_end"}');
    assert.equal(marks.size, 0);
  });

  it('echoes immediately when no audio is queued', () => {
    assert.equal(shouldEchoImmediately(1, 0), true);
    assert.equal(shouldEchoImmediately(1, 1), true);
    assert.equal(shouldEchoImmediately(1, 1.38), false);
  });

  it('releases several marks that share the same audio horizon', () => {
    const marks = new MarkHold();
    marks.hold('{"type":"mark","name":"a"}', 2);
    marks.hold('{"type":"mark","name":"b"}', 2);
    marks.hold('{"type":"mark","name":"c"}', 3);
    const due = marks.releaseDue(2);
    assert.deepEqual(
      due.map((mark) => mark.raw),
      ['{"type":"mark","name":"a"}', '{"type":"mark","name":"b"}'],
    );
    assert.equal(marks.size, 1);
  });
});

describe('clear_audio flush', () => {
  it('returns every held mark immediately and empties the list', () => {
    const marks = new MarkHold();
    marks.hold('{"type":"mark","name":"one"}', 5);
    marks.hold('{"type":"mark","name":"two"}', 9);
    const flushed = marks.flush();
    assert.equal(flushed.length, 2);
    assert.deepEqual(
      flushed.map((mark) => mark.raw),
      ['{"type":"mark","name":"one"}', '{"type":"mark","name":"two"}'],
    );
    assert.equal(marks.size, 0);
    assert.deepEqual(marks.flush(), []);
  });
});
