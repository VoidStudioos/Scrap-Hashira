import { branchFolder } from '../engines/semantics/branch';
import { applyCooldown } from './cooldown';
import { db, log } from '../storage/db';
import type { Job, ResourceTask } from '../types';
import { hasOrigin, offscreenCall } from './browser';
import { sha256, errorText } from '../utils/core';
import { safeFilename } from '../security/policy';
import { readBounded, sniffMime, extensionFor } from '../engines/images/verify';
import { retryAfter, retryDelay, robotsAllows } from '../engines/crawler/policy';
export async function saveResource(task: ResourceTask, job: Job) {
  if (!task.hash) return;
  const current = await db.jobs.get(job.id);
  if (current?.state !== 'RUNNING') return;
  const blobUrl = await offscreenCall<string>('URL', { hash: task.hash, id: task.id });
  const record = task.recordIds[0] ? await db.records.get(task.recordIds[0]) : undefined;
  const productName = safeFilename(
    String(record?.fields.product_code || record?.fields.name || 'unassigned'),
  );
  const folder = task.branchPath?.length ? branchFolder(task.branchPath) + '/' : '';
  const filename =
    task.filename ||
    `Hashira/${safeFilename(job.name).slice(0, 40)}_${job.id.slice(0, 8)}/${task.kind === 'image' ? 'images' : 'documents'}/${folder}${productName.slice(0, 48)}/${task.id.split(':').pop()?.slice(0, 24)}.${extensionFor(task.mime || '')}`;
  await db.resources.update(task.id, { state: 'SAVING', filename, blobUrl, error: undefined });
  try {
    const downloadId = await chrome.downloads.download({
      url: blobUrl,
      filename,
      conflictAction: 'overwrite',
      saveAs: false,
    });
    await db.resources.update(task.id, { downloadId });
    await reconcileDownload(task.id);
  } catch (e) {
    await db.resources.update(task.id, {
      state: 'FETCHED',
      blobUrl: undefined,
      nextAt: Date.now() + 30000,
      error: errorText(e),
      attempts: task.attempts + 1,
    });
    await offscreenCall('REVOKE', { id: task.id });
    if (task.attempts >= job.config.retries)
      await db.resources.update(task.id, { state: 'FAILED' });
  }
}
export async function fetchResource(task: ResourceTask, job: Job, owner: string) {
  await db.resources.update(task.id, {
    state: 'FETCHING',
    owner,
    leaseUntil: Date.now() + job.config.timeoutMs + 5000,
  });
  try {
    if (!task.url.startsWith('data:')) {
      const origin = new URL(task.url).origin;
      if (
        (origin !== job.origin && !job.config.approvedResourceOrigins.includes(origin)) ||
        !(await hasOrigin(origin))
      ) {
        await db.resources.update(task.id, {
          state: 'BLOCKED',
          error: `Grant and approve resource origin ${origin} in Images / Jobs.`,
        });
        return;
      }
    }
    if (task.url.startsWith(job.origin + '/') && !robotsAllows(job.robots?.text || '', task.url)) {
      await db.resources.update(task.id, {
        state: 'BLOCKED',
        error: 'Image/document URL is disallowed by robots.txt',
      });
      return;
    }
    const response = await fetch(task.url, {
      credentials: task.url.startsWith(job.origin + '/') ? 'include' : 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(job.config.timeoutMs),
    });
    if (response.status === 429) {
      const delay = retryAfter(response.headers.get('retry-after'));
      await applyCooldown(job.id, delay, {
        downloadLimit: Math.max(
          1,
          Math.floor((job.downloadLimit || job.config.downloadConcurrency) / 2),
        ),
        pageLimit: 1,
      });
      throw new Error('HTTP 429: origin cooling down');
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await readBounded(response, job.config.maxResourceMB * 1024 * 1024);
    const bytes = new Uint8Array(await blob.slice(0, 2048).arrayBuffer());
    const mime = sniffMime(bytes, response.headers.get('content-type') || '');
    if (
      !mime ||
      (task.kind === 'image' && !mime.startsWith('image/')) ||
      (task.kind === 'document' && mime !== 'application/pdf')
    )
      throw new Error('MIME signature does not match a supported image or PDF');
    const typed = new Blob([blob], { type: mime });
    const hash = await sha256(typed);
    await db.blobs.put({ hash, blob: typed, mime, size: typed.size });
    const dimensions = await offscreenCall<{ width: number; height: number }>('VERIFY', { hash });
    await db.resources.update(task.id, {
      state: 'FETCHED',
      hash,
      mime,
      size: typed.size,
      ...dimensions,
      owner: undefined,
      leaseUntil: undefined,
      error: undefined,
    });
    const duplicate = await db.resources
      .where('hash')
      .equals(hash)
      .filter((r) => r.id !== task.id && r.jobId === job.id && r.state === 'COMPLETED')
      .first();
    if (duplicate && duplicate.downloadId !== undefined) {
      const found = await chrome.downloads.search({ id: duplicate.downloadId });
      if (found[0]?.exists) {
        await db.resources.update(task.id, {
          state: 'COMPLETED',
          filename: duplicate.filename,
          downloadId: duplicate.downloadId,
        });
        return;
      }
    }
    const latest = await db.resources.get(task.id);
    if (latest) await saveResource(latest, job);
  } catch (e) {
    const message = errorText(e);
    const permanent = /HTTP (400|401|403|404|410)|MIME|decode|SVG|byte limit/.test(message);
    const attempts = task.attempts + 1;
    await db.resources.update(task.id, {
      state: permanent || attempts > job.config.retries ? 'FAILED' : 'PENDING',
      attempts,
      nextAt: Date.now() + retryDelay(attempts),
      error: message,
      owner: undefined,
      leaseUntil: undefined,
    });
    await log(job.id, 'error', 'RESOURCE', message, task.url);
  }
}
export async function reconcileDownload(id: string) {
  const task = await db.resources.get(id);
  if (!task || task.state !== 'SAVING') return;
  let found: chrome.downloads.DownloadItem[] = [];
  if (task.downloadId !== undefined) found = await chrome.downloads.search({ id: task.downloadId });
  else if (task.blobUrl) found = await chrome.downloads.search({ url: task.blobUrl });
  const item = found[0];
  if (!item) {
    await db.resources.update(id, {
      state: 'FETCHED',
      downloadId: undefined,
      nextAt: Date.now() + 1000,
    });
    return;
  }
  if (task.downloadId === undefined) await db.resources.update(id, { downloadId: item.id });
  if (item.state === 'complete' && item.exists) {
    await db.resources.update(id, { state: 'COMPLETED', error: undefined, blobUrl: undefined });
    await offscreenCall('REVOKE', { id });
    await log(
      task.jobId,
      'info',
      'DOWNLOAD_COMPLETE',
      `Chrome confirmed ${item.filename}`,
      task.url,
    );
  } else if (item.state === 'interrupted' || (item.state === 'complete' && !item.exists)) {
    const job = await db.jobs.get(task.jobId);
    await db.resources.update(id, {
      state: task.attempts < (job?.config.retries || 0) ? 'FETCHED' : 'FAILED',
      attempts: task.attempts + 1,
      nextAt: Date.now() + retryDelay(task.attempts + 1),
      error: item.error || 'Downloaded file missing',
      blobUrl: undefined,
    });
    await offscreenCall('REVOKE', { id });
  }
}
export async function reconcileDownloads() {
  for (const r of await db.resources.filter((t) => t.state === 'SAVING').toArray())
    await reconcileDownload(r.id);
}
