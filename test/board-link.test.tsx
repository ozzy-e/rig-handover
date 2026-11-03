import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board digest links', () => {
  it('links each night with its counts', async () => {
    const html = await (await createApp(config).request('/')).text();
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a> · 10 ok · 4 retry · 1 fail');
    expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a> · 7 ok · 0 retry · 0 fail');
  });
});
