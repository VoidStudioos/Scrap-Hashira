import { it, expect } from 'vitest';
import { HashiraDB } from '../../src/storage/db';
import { DEFAULT_CONFIG } from '../../src/types';
it('commits a checkpoint atomically and retains jobs across reopen', async () => {
  const db = new HashiraDB('resume-test');
  await db.jobs.add({
    id: 'j',
    name: 'test',
    origin: 'https://s.test',
    startUrl: 'https://s.test',
    config: DEFAULT_CONFIG,
    state: 'RUNNING',
    createdAt: 0,
    updatedAt: 0,
    checkpoint: 0,
    blockedUntil: 0,
  });
  await expect(
    db.transaction('rw', db.jobs, db.pages, async () => {
      await db.jobs.update('j', { checkpoint: 1 });
      await db.pages.add({
        id: 'p',
        jobId: 'j',
        url: 'https://s.test',
        parentUrl: '',
        depth: 0,
        kind: 'page',
        state: 'DONE',
        attempts: 0,
        nextAt: 0,
      });
      throw new Error('simulated crash');
    }),
  ).rejects.toThrow('simulated crash');
  expect((await db.jobs.get('j'))?.checkpoint).toBe(0);
  expect(await db.pages.count()).toBe(0);
  await db.transaction('rw', db.jobs, db.pages, async () => {
    await db.pages.put({
      id: 'p',
      jobId: 'j',
      url: 'https://s.test',
      parentUrl: '',
      depth: 0,
      kind: 'page',
      state: 'DONE',
      attempts: 0,
      nextAt: 0,
    });
    await db.jobs.update('j', { checkpoint: 1 });
  });
  db.close();
  await db.open();
  expect((await db.jobs.get('j'))?.checkpoint).toBe(1);
  expect(await db.pages.count()).toBe(1);
  await db.delete();
});
