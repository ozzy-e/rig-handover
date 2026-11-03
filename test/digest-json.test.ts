import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

const app = createApp({ adapter: 'test', installed: 'test', beatEverySeconds: 60, runsDir: 'runs' });

describe('GET /api/digest/:night', () => {
  it('returns readNight output as JSON, rows sorted by job', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: { job: string }[] };
    expect(body).toEqual(readNight('runs', '2026-10-28'));
    expect(body.rows.map((r) => r.job)).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);
  });

  it('404s on a missing or malformed night', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night', night: '2026-01-01' });
    expect((await app.request('/api/digest/..%2Frig')).status).toBe(404);
  });
});
