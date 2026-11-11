import { it, expect, vi } from 'vitest';
import { sendContentCommand } from '../../src/background/browser';
it('enforces the analysis timeout and asks the content script to abort', async () => {
  vi.useFakeTimers();
  const send = vi.fn((_tab: number, msg: Record<string, unknown>) =>
    msg.op === 'ABORT' ? Promise.resolve({ ok: true }) : new Promise(() => undefined),
  );
  vi.stubGlobal('chrome', { tabs: { sendMessage: send } });
  try {
    const pending = sendContentCommand(7, { target: 'content', op: 'DETECT' }, 3000);
    const check = expect(pending).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(3000);
    await check;
    expect(
      send.mock.calls.some(([, msg]) => msg.op === 'ABORT' && typeof msg.requestId === 'string'),
    ).toBe(true);
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
