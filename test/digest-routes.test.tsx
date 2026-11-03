import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
const app = createApp({ adapter: 'test', installed: 'test', beatEverySeconds: 60, runsDir: dir });

const line = (job: string, status: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ at: '2026-10-30T02:00:00+02:00', job, status, owner: 'ops', ...extra });

const GOOD = '2026-10-30';
const EMPTY = '2026-10-31';
const BAD = '2026-11-01';
const MISSING = '2026-01-01';

type Body = { rows: { job: string }[]; badLines: number };

beforeAll(() => {
  writeFileSync(
    join(dir, `${GOOD}.jsonl`),
    [
      line('zeta/ok', 'ok'),
      line('alpha/retry', 'retry'),
      line('alpha/retry', 'retry'),
      line('alpha/retry', 'retry'),
      line('alpha/retry', 'ok'),
      line('mid/fail', 'fail', { error: 'boom' }),
    ].join('\n') + '\n',
  );
  writeFileSync(join(dir, `${EMPTY}.jsonl`), '');
  writeFileSync(join(dir, `${BAD}.jsonl`), [line('good/job', 'ok'), '{not json', ''].join('\n'));
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('digest page and JSON routes', () => {
  it('200 for a night with valid lines', async () => {
    const page = await app.request(`/digest/${GOOD}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('alpha/retry');
    expect(html).toContain('zeta/ok');
    const json = await app.request(`/api/digest/${GOOD}`);
    expect(json.status).toBe(200);
    const body = (await json.json()) as Body;
    expect(body.rows).toHaveLength(3);
    expect(body.badLines).toBe(0);
  });

  it('404 for a night with no file', async () => {
    expect((await app.request(`/digest/${MISSING}`)).status).toBe(404);
    expect((await app.request(`/api/digest/${MISSING}`)).status).toBe(404);
  });

  it('empty night: page says nothing ran, JSON has no rows', async () => {
    const page = await app.request(`/digest/${EMPTY}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    const json = await app.request(`/api/digest/${EMPTY}`);
    expect(json.status).toBe(200);
    expect(((await json.json()) as Body).rows).toEqual([]);
  });

  it('bad line: still 200, counted, good rows kept', async () => {
    const page = await app.request(`/digest/${BAD}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toMatch(/1 line couldn(&#39;|')t be read/);
    expect(html).toContain('good/job');
    const json = await app.request(`/api/digest/${BAD}`);
    expect(json.status).toBe(200);
    const body = (await json.json()) as Body;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['good/job']);
  });

  it('marks rows with retries >= 3 or a fail status as warn', async () => {
    const html = await (await app.request(`/digest/${GOOD}`)).text();
    const rows = html.match(/<tr[^>]*>.*?<\/tr>/gs) ?? [];
    const rowFor = (job: string) => rows.find((r) => r.includes(job));
    expect(rowFor('alpha/retry')).toContain('class="warn"');
    expect(rowFor('mid/fail')).toContain('class="warn"');
    expect(rowFor('zeta/ok')).not.toContain('warn');
  });

  it('JSON job order equals page job order', async () => {
    const html = await (await app.request(`/digest/${GOOD}`)).text();
    const pageJobs = [...html.matchAll(/<tr[^>]*><td>([^<]*)<\/td>/g)].map((m) => m[1]);
    const body = (await (await app.request(`/api/digest/${GOOD}`)).json()) as Body;
    expect(pageJobs).toEqual(body.rows.map((r) => r.job));
    expect(pageJobs).toEqual(['alpha/retry', 'mid/fail', 'zeta/ok']);
  });
});
