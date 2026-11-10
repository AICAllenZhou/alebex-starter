import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GET } from './route';

describe('/api/health', () => {
  it('returns ok:true and service alebex-demo-studio-trial', async () => {
    const response = await GET();
    const body = (await response.json()) as {
      ok: boolean;
      service: string;
      commit: string;
      time: string;
    };
    assert.equal(body.ok, true);
    assert.equal(body.service, 'alebex-demo-studio-trial');
  });

  it('includes a commit field', async () => {
    const response = await GET();
    const body = (await response.json()) as { commit: unknown };
    assert.ok(
      typeof body.commit === 'string' && body.commit.length > 0,
      'commit should be a non-empty string',
    );
  });

  it('sets Cache-Control: no-store header', async () => {
    const response = await GET();
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  });
});
