import { db, log } from '../../storage/db';
import type { JobState } from '../../types';
export async function recover(owner: string, browserRestart = false) {
  const pages = await db.pages
    .where('state')
    .equals('LEASED')
    .toArray()
    .catch(() => db.pages.filter((p) => p.state === 'LEASED').toArray());
  for (const page of pages) {
    if (page.owner !== owner || Number(page.leaseUntil) < Date.now()) {
      if (page.tabId) {
        try {
          await chrome.tabs.remove(page.tabId);
        } catch {
          /* already gone */
        }
      }
      await db.pages.update(page.id, {
        state: 'PENDING',
        owner: undefined,
        leaseUntil: undefined,
        tabId: undefined,
      });
    }
  }
  for (const task of await db.resources.filter((r) => r.state === 'FETCHING').toArray()) {
    if (task.owner !== owner || Number(task.leaseUntil) < Date.now())
      await db.resources.update(task.id, {
        state: task.hash ? 'FETCHED' : 'PENDING',
        owner: undefined,
        leaseUntil: undefined,
      });
  }
  for (const resource of await db.resources.filter((r) => r.state === 'COMPLETED').toArray()) {
    const job = await db.jobs.get(resource.jobId);
    if (!job || ['COMPLETED', 'CANCELLED'].includes(job.state)) continue;
    const item =
      resource.downloadId !== undefined
        ? (await chrome.downloads.search({ id: resource.downloadId }))[0]
        : undefined;
    if (!item?.exists)
      await db.resources.update(resource.id, {
        state: resource.hash && (await db.blobs.get(resource.hash)) ? 'FETCHED' : 'PENDING',
        downloadId: undefined,
        nextAt: 0,
        error: 'Previously completed file is missing; local bytes will be reused when available.',
      });
  }
  if (browserRestart)
    for (const job of await db.jobs.where('state').equals('RUNNING').toArray()) {
      await db.jobs.update(job.id, {
        state: 'INTERRUPTED',
        updatedAt: Date.now(),
        lastError: 'Browser restarted. Review this job and choose Resume.',
      });
      await log(
        job.id,
        'warning',
        'BROWSER_RESTART',
        'Queues restored; waiting for explicit resume.',
      );
    }
}
export async function setJobState(id: string, state: JobState) {
  const job = await db.jobs.get(id);
  if (!job) throw new Error('Job not found');
  if (state === 'RUNNING') {
    if (job.state === 'CANCELLED' || job.state === 'COMPLETED')
      throw new Error('Create a new job to repeat a finished crawl');
    await db.pages
      .where('jobId')
      .equals(id)
      .filter((p) => p.state === 'BLOCKED')
      .modify({ state: 'PENDING', error: undefined });
    await db.resources
      .where('jobId')
      .equals(id)
      .filter((r) => r.state === 'BLOCKED')
      .modify({ state: 'PENDING', error: undefined });
  }
  if (state === 'PAUSED' || state === 'CANCELLED' || state === 'RUNNING')
    for (const resource of await db.resources
      .where('jobId')
      .equals(id)
      .filter((r) => r.state === 'SAVING')
      .toArray()) {
      if (resource.downloadId === undefined) continue;
      try {
        if (state === 'PAUSED') await chrome.downloads.pause(resource.downloadId);
        else if (state === 'CANCELLED') await chrome.downloads.cancel(resource.downloadId);
        else {
          const item = (await chrome.downloads.search({ id: resource.downloadId }))[0];
          if (item?.paused) await chrome.downloads.resume(resource.downloadId);
        }
      } catch {
        /* completion may race the state change */
      }
    }
  await db.jobs.update(id, {
    state,
    updatedAt: Date.now(),
    lastError: state === 'RUNNING' ? undefined : job.lastError,
  });
  await log(id, 'info', 'STATE', state);
}
