import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type NightCounts = { ok: number; retry: number; fail: number };

// Per log line, not per job. null when runs/<night>.jsonl doesn't exist.
export function countNight(runsDir: string, night: string): NightCounts | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    let v: unknown;
    try {
      v = JSON.parse(raw);
    } catch {
      continue;
    }
    if (typeof v !== 'object' || v === null) continue;
    const s = (v as Record<string, unknown>).status;
    if (s === 'ok' || s === 'retry' || s === 'fail') counts[s]++;
  }
  return counts;
}
